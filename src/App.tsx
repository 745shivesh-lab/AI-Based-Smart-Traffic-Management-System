// ============================================================
// App.tsx — Main application, simulation loop
// ============================================================
// Changes in this version:
//   • AI-Driven mode: detections from AICamera update simulation demand
//     via aiDetectionBridge (smoothed EWMA, stale-detection timeout).
//   • Zone-mapping panel lets the user assign video zones to approaches.
//   • AIModeBadge shows mode, camera status and AI-derived demand.
//   • Manual mode preserved exactly as before.
//   • All existing simulation, controls and dashboard code preserved.

import React, {
  useState, useEffect, useRef, useCallback, lazy, Suspense,
} from 'react';
import { JunctionCanvas }  from './components/JunctionCanvas';
import { Dashboard }       from './components/Dashboard';
import { QueuePanel }      from './components/QueuePanel';
import { Controls }        from './components/Controls';
import { AIModeBadge }     from './components/AIModeBadge';
import { ZoneMappingPanel }from './components/ZoneMappingPanel';

// Lazy-load AICamera so TensorFlow.js is only fetched when the panel opens.
const AICamera = lazy(() => import('./ai-camera/AICamera'));

import {
  createSimEngine,
  DEFAULT_DEMAND,
} from './simulation/simulationEngine';
import type { SimSnapshot, SimEngine } from './simulation/simulationEngine';
import type { TrafficDemand, GreenDurations } from './simulation/types';
import { DEFAULT_GREEN_DURATIONS }   from './simulation/constants';
import {
  createBridgeState,
  processDetections,
  DEFAULT_ZONE_MAPPING,
  DEFAULT_BRIDGE_CONFIG,
} from './ai-camera/aiDetectionBridge';
import type {
  BridgeState,
  ZoneMapping,
  RawDetection,
} from './ai-camera/aiDetectionBridge';
import type { DetectionCallback } from './ai-camera/AICamera';

// ─── How often (real ms) we push AI demand into the engine ────────────────
// We don't update on every detection frame (~30 fps) because that would
// spawn vehicles faster than the sim can process them.  Instead we batch
// over DEMAND_UPDATE_INTERVAL_MS and only call engine.reset() when the
// demand has actually changed by more than DEMAND_CHANGE_THRESHOLD.
const DEMAND_UPDATE_INTERVAL_MS  = 3000;  // push demand every 3 real-seconds
const DEMAND_CHANGE_THRESHOLD    = 3;     // ignore tiny fluctuations

function demandChanged(a: TrafficDemand, b: TrafficDemand): boolean {
  return (['north', 'east', 'south', 'west'] as const).some(
    k => Math.abs(a[k] - b[k]) >= DEMAND_CHANGE_THRESHOLD
  );
}

// ─── App ──────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  // ── Simulation state ──────────────────────────────────────────────────
  const [demand, setDemand]               = useState<TrafficDemand>(DEFAULT_DEMAND);
  const [greenDurations, setGreenDurations] = useState<GreenDurations>(DEFAULT_GREEN_DURATIONS);
  const [speed, setSpeed]                 = useState<number>(1);
  const [running, setRunning]             = useState(false);
  const [snapshot, setSnapshot]           = useState<SimSnapshot | null>(null);

  // ── AI integration state ──────────────────────────────────────────────
  const [showAICamera, setShowAICamera]   = useState(false);
  const [aiDriven, setAIDriven]           = useState(false);
  const [zoneMapping, setZoneMapping]     = useState<ZoneMapping>(DEFAULT_ZONE_MAPPING);
  const [bridgeState, setBridgeState]     = useState<BridgeState | null>(null);
  const [aiDemand, setAIDemand]           = useState<TrafficDemand | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────
  const engineRef           = useRef<SimEngine | null>(null);
  const rafRef              = useRef<number | null>(null);
  const lastTimeRef         = useRef<number | null>(null);
  const speedRef            = useRef<number>(speed);

  // Bridge refs (no re-render needed on every frame)
  const bridgeStateRef      = useRef<BridgeState>(createBridgeState());
  const zoneMappingRef      = useRef<ZoneMapping>(DEFAULT_ZONE_MAPPING);
  const aiDrivenRef         = useRef(false);
  const lastDemandPushRef   = useRef<number>(0);
  const lastAppliedDemandRef= useRef<TrafficDemand>(DEFAULT_DEMAND);

  // Keep refs in sync with state
  useEffect(() => { speedRef.current    = speed;       }, [speed]);
  useEffect(() => { zoneMappingRef.current = zoneMapping; }, [zoneMapping]);
  useEffect(() => { aiDrivenRef.current  = aiDriven;   }, [aiDriven]);

  // ── Engine initialisation ─────────────────────────────────────────────
  useEffect(() => {
    engineRef.current = createSimEngine(DEFAULT_DEMAND, DEFAULT_GREEN_DURATIONS);
    setSnapshot(engineRef.current.snapshot());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stable RAF tick ───────────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    if (!engineRef.current) return;
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;

    const realDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    // In AI-driven mode push a new demand batch periodically
    if (aiDrivenRef.current) {
      const nowMs = Date.now();
      if (nowMs - lastDemandPushRef.current >= DEMAND_UPDATE_INTERVAL_MS) {
        lastDemandPushRef.current = nowMs;
        const pending = computeAIDemand();
        if (pending && demandChanged(pending, lastAppliedDemandRef.current)) {
          lastAppliedDemandRef.current = pending;
          // Inject new vehicles for each approach that has grown
          engineRef.current.injectDemand(pending);
        }
      }
    }

    const simDt = realDt * speedRef.current;
    const snap  = engineRef.current.step(simDt);
    setSnapshot(snap);

    rafRef.current = requestAnimationFrame(tick);
  }, []); // stable

  function computeAIDemand(): TrafficDemand | null {
    const bs = bridgeStateRef.current;
    if (!bs.cameraActive) return null;
    // Derive from smoothed counts (already stored in bridge state)
    const cfg = DEFAULT_BRIDGE_CONFIG;
    const clamp = (v: number) => Math.min(cfg.maxDemand, Math.max(cfg.minDemand, v));
    return {
      north: clamp(Math.round(bs.approachStates.north.smoothedCount * cfg.countToDemandScale)),
      east:  clamp(Math.round(bs.approachStates.east.smoothedCount  * cfg.countToDemandScale)),
      south: clamp(Math.round(bs.approachStates.south.smoothedCount * cfg.countToDemandScale)),
      west:  clamp(Math.round(bs.approachStates.west.smoothedCount  * cfg.countToDemandScale)),
    };
  }

  // ── RAF start/stop ────────────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running, tick]);

  // ── Stale-detection watcher ────────────────────────────────────────────
  // Every 2 s check whether the bridge has gone stale and update the badge.
  useEffect(() => {
    if (!aiDriven) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - bridgeStateRef.current.lastDetectionMs) / 1000;
      if (bridgeStateRef.current.cameraActive && elapsed > DEFAULT_BRIDGE_CONFIG.staleTimeoutSec) {
        bridgeStateRef.current = {
          ...bridgeStateRef.current,
          cameraActive: false,
          explanation: `Camera inactive — no detections for ${Math.round(elapsed)}s.`,
        };
        setBridgeState({ ...bridgeStateRef.current });
      }
    }, 2000);
    return () => clearInterval(id);
  }, [aiDriven]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handlePlay  = useCallback(() => setRunning(true),  []);
  const handlePause = useCallback(() => setRunning(false), []);

  const handleReset = useCallback((newDemand: TrafficDemand, newGD: GreenDurations) => {
    setRunning(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
    lastDemandPushRef.current = 0;
    lastAppliedDemandRef.current = newDemand;

    setDemand(newDemand);
    setGreenDurations(newGD);

    if (engineRef.current) {
      const snap = engineRef.current.reset(newDemand, newGD);
      setSnapshot(snap);
    }
  }, []);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
    speedRef.current = s;
  }, []);

  const handleDemandChange = useCallback((d: TrafficDemand) => {
    setDemand(d);
  }, []);

  const handleGreenDurChange = useCallback((gd: GreenDurations) => {
    setGreenDurations(gd);
    engineRef.current?.setGreenDurations(gd);
  }, []);

  const handleToggleAI = useCallback(() => {
    setAIDriven(prev => {
      const next = !prev;
      aiDrivenRef.current = next;
      if (!next) {
        // Switching back to manual: reset bridge so stale data is cleared
        bridgeStateRef.current = createBridgeState();
        setBridgeState(null);
        setAIDemand(null);
      }
      return next;
    });
  }, []);

  // ── Detection callback (called by AICamera on every frame) ────────────
  const handleDetection: DetectionCallback = useCallback((detections, videoWidth) => {
    if (!aiDrivenRef.current) return; // ignore if manual mode

    const { state: newBridge, demand: newDemand } = processDetections(
      bridgeStateRef.current,
      detections as RawDetection[],
      videoWidth,
      zoneMappingRef.current,
      DEFAULT_BRIDGE_CONFIG,
      Date.now()
    );

    bridgeStateRef.current = newBridge;

    // Update React state for the badge (throttled to avoid hammering renders)
    const now = Date.now();
    if (now - lastDemandPushRef.current >= 500) {
      setBridgeState({ ...newBridge });
      setAIDemand({ ...newDemand });
    }
  }, []);

  if (!snapshot) {
    return (
      <div style={{ color: '#fff', padding: 40, fontFamily: 'monospace' }}>
        Initializing simulation…
      </div>
    );
  }

  const modeLabel = aiDriven ? 'AI-Driven' : 'Manual';

  return (
    <div style={{
      background: '#0d1117',
      minHeight: '100vh',
      color: '#e0e0e0',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: running ? '#2ecc71' : '#e74c3c',
          boxShadow: running ? '0 0 8px #2ecc71' : '0 0 8px #e74c3c',
          flexShrink: 0,
        }} />
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#4fc3f7', letterSpacing: 0.5 }}>
          AI Smart Traffic Management System
        </h1>

        {/* AI Camera toggle */}
        <button
          onClick={() => setShowAICamera(v => !v)}
          style={{
            marginLeft: 'auto',
            padding: '5px 14px',
            border: `1px solid ${showAICamera ? '#00ff88' : '#4fc3f7'}`,
            borderRadius: 6,
            background: showAICamera ? 'rgba(0,255,136,0.12)' : 'rgba(79,195,247,0.10)',
            color: showAICamera ? '#00ff88' : '#4fc3f7',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          📷 {showAICamera ? 'Hide AI Camera' : 'AI Vehicle Detection'}
        </button>

        <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>
          Four-Way Junction · {modeLabel} Control
        </span>
        <span style={{
          background: running ? '#1a472a' : '#3d1f1f',
          color:      running ? '#2ecc71' : '#e74c3c',
          border:     `1px solid ${running ? '#2ecc71' : '#e74c3c'}`,
          borderRadius: 4,
          padding: '2px 10px',
          fontSize: 11,
          fontWeight: 700,
        }}>
          {running ? 'RUNNING' : 'PAUSED'}
        </span>
      </header>

      {/* ── Main grid ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 260px',
        gap: 16,
        padding: 16,
        flex: 1,
        alignItems: 'start',
      }}>

        {/* LEFT — Controls */}
        <div style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}>
          {/* AI mode badge + toggle */}
          <AIModeBadge
            aiDriven={aiDriven}
            bridgeState={bridgeState}
            aiDemand={aiDemand}
            onToggle={handleToggleAI}
          />

          <hr style={{ border: 'none', borderTop: '1px solid #30363d', margin: '2px 0' }} />

          {/* Zone mapping (only shown in AI mode) */}
          {aiDriven && (
            <>
              <ZoneMappingPanel
                mapping={zoneMapping}
                onChange={m => {
                  setZoneMapping(m);
                  zoneMappingRef.current = m;
                }}
              />
              <hr style={{ border: 'none', borderTop: '1px solid #30363d', margin: '2px 0' }} />
            </>
          )}

          {/* Manual controls (always visible) */}
          <Controls
            running={running}
            speed={speed}
            demand={demand}
            greenDurations={greenDurations}
            onPlay={handlePlay}
            onPause={handlePause}
            onReset={handleReset}
            onSpeedChange={handleSpeedChange}
            onDemandChange={handleDemandChange}
            onGreenDurChange={handleGreenDurChange}
          />
        </div>

        {/* CENTRE — Junction canvas */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 10,
            padding: 12,
            display: 'inline-block',
          }}>
            <JunctionCanvas
              vehicles={snapshot.vehicles}
              signals={snapshot.signals}
            />
          </div>

          {/* Status bar */}
          <div style={{
            color: '#666', fontSize: 11, fontFamily: 'monospace',
            display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <span>⏱ {snapshot.simTime.toFixed(1)}s</span>
            <span>⚡ {speed}×</span>
            <span>🚗 Active: {snapshot.vehicles.filter(v => !v.exited).length}</span>
            <span>✅ Exited: {snapshot.metrics.totalExited}</span>
            <span style={{ color: aiDriven ? '#00ff88' : '#f39c12' }}>
              {aiDriven ? '🤖 AI-Driven' : '🖐 Manual'}
            </span>
          </div>
        </div>

        {/* RIGHT — Dashboard + Queue + Legend */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}>
          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 10,
            padding: 16,
          }}>
            <Dashboard metrics={snapshot.metrics} />
          </div>

          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 10,
            padding: 16,
          }}>
            <QueuePanel metrics={snapshot.metrics} signals={snapshot.signals} />
          </div>

          {/* Legend */}
          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 10,
            padding: 14,
            fontSize: 11,
            color: '#888',
          }}>
            <div style={{ color: '#4fc3f7', fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
              🔑 LEGEND
            </div>
            {[
              { color: '#e74c3c', label: 'Car (60%)' },
              { color: '#ffd93d', label: 'Motorcycle (25%)' },
              { color: '#f0a500', label: 'Bus (15%)' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 14, height: 14, background: color, borderRadius: 2 }} />
                <span>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, lineHeight: 1.7 }}>
              🔴 Stop at red/yellow<br />
              🟡 Prepare to stop<br />
              🟢 Clear to proceed<br />
              🔆 Brake lights = stopped
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Camera panel ────────────────────────────────────────── */}
      {showAICamera && (
        <div style={{
          padding: '0 16px 24px',
          borderTop: '1px solid #30363d',
          marginTop: 8,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 0 10px',
          }}>
            <span style={{
              background: '#00ff8820',
              border: '1px solid #00ff88',
              color: '#00ff88',
              borderRadius: 5,
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 700,
            }}>
              🎥 AI CAMERA
            </span>
            <span style={{ color: '#666', fontSize: 11 }}>
              {aiDriven
                ? '🤖 AI-Driven mode — detections are updating simulation demand'
                : 'Detections are displayed only · Enable AI-Driven mode to connect to simulation'}
            </span>
            <button
              onClick={() => setShowAICamera(false)}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: '1px solid #555',
                borderRadius: 5,
                color: '#888',
                cursor: 'pointer',
                padding: '3px 10px',
                fontSize: 11,
              }}
            >
              ✕ Close
            </button>
          </div>

          <Suspense fallback={
            <div style={{ color: '#4fc3f7', padding: 24, fontFamily: 'monospace', fontSize: 13 }}>
              ⏳ Loading AI detection module…
            </div>
          }>
            {/* Pass onDetection only when AI-Driven mode is active */}
            <AICamera onDetection={aiDriven ? handleDetection : undefined} />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default App;
