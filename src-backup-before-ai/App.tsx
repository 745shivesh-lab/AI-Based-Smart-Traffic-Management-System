// ============================================================
// App.tsx — Main application, simulation loop
// ============================================================
// FIXED:
//  - RAF duplicate loop: speed is stored in a ref so tick() is stable,
//    avoiding a new RAF chain on every speed-slider move.
//  - Controls local state re-syncs when parent resets demand/greenDurations.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { JunctionCanvas } from './components/JunctionCanvas';
import { Dashboard } from './components/Dashboard';
import { QueuePanel } from './components/QueuePanel';
import { Controls } from './components/Controls';
import { createSimEngine, DEFAULT_DEMAND } from './simulation/simulationEngine';
import type { SimSnapshot, SimEngine } from './simulation/simulationEngine';
import type { TrafficDemand, GreenDurations } from './simulation/types';
import { DEFAULT_GREEN_DURATIONS } from './simulation/constants';

const App: React.FC = () => {
  const [demand, setDemand] = useState<TrafficDemand>(DEFAULT_DEMAND);
  const [greenDurations, setGreenDurations] = useState<GreenDurations>(DEFAULT_GREEN_DURATIONS);
  const [speed, setSpeed] = useState<number>(1);
  const [running, setRunning] = useState(false);
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);

  const engineRef   = useRef<SimEngine | null>(null);
  const rafRef      = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  // Store speed in a ref so the RAF callback always reads the latest value
  // without needing to be recreated (prevents duplicate RAF chains).
  const speedRef    = useRef<number>(speed);

  // Keep speedRef in sync with state
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Initialize engine once on mount
  useEffect(() => {
    engineRef.current = createSimEngine(DEFAULT_DEMAND, DEFAULT_GREEN_DURATIONS);
    setSnapshot(engineRef.current.snapshot());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable tick — never recreated, always reads latest speed via ref
  const tick = useCallback((timestamp: number) => {
    if (!engineRef.current) return;
    if (lastTimeRef.current === null) {
      lastTimeRef.current = timestamp;
    }
    const realDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1); // cap at 100ms
    lastTimeRef.current = timestamp;

    const simDt = realDt * speedRef.current;
    const snap = engineRef.current.step(simDt);
    setSnapshot(snap);

    rafRef.current = requestAnimationFrame(tick);
  }, []); // stable — no dependencies needed

  // Start/stop the RAF loop when running changes
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

  const handlePlay = useCallback(() => setRunning(true), []);
  const handlePause = useCallback(() => setRunning(false), []);

  const handleReset = useCallback((newDemand: TrafficDemand, newGD: GreenDurations) => {
    // Stop any running loop first
    setRunning(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;

    setDemand(newDemand);
    setGreenDurations(newGD);

    if (engineRef.current) {
      const snap = engineRef.current.reset(newDemand, newGD);
      setSnapshot(snap);
    }
  }, []);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
    speedRef.current = s; // update ref immediately (state update is async)
  }, []);

  const handleDemandChange = useCallback((d: TrafficDemand) => {
    setDemand(d);
  }, []);

  const handleGreenDurChange = useCallback((gd: GreenDurations) => {
    setGreenDurations(gd);
    engineRef.current?.setGreenDurations(gd);
  }, []);

  if (!snapshot) {
    return (
      <div style={{ color: '#fff', padding: 40, fontFamily: 'monospace' }}>
        Initializing simulation…
      </div>
    );
  }

  return (
    <div style={{
      background: '#0d1117',
      minHeight: '100vh',
      color: '#e0e0e0',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: running ? '#2ecc71' : '#e74c3c',
          boxShadow: running ? '0 0 8px #2ecc71' : '0 0 8px #e74c3c',
        }} />
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#4fc3f7', letterSpacing: 0.5 }}>
          AI Smart Traffic Management System
        </h1>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 11, fontFamily: 'monospace' }}>
          Stage 1 · Four-Way Junction · Demand-Responsive Control
        </span>
        <span style={{
          background: running ? '#1a472a' : '#3d1f1f',
          color: running ? '#2ecc71' : '#e74c3c',
          border: `1px solid ${running ? '#2ecc71' : '#e74c3c'}`,
          borderRadius: 4,
          padding: '2px 10px',
          fontSize: 11,
          fontWeight: 700,
        }}>
          {running ? 'RUNNING' : 'PAUSED'}
        </span>
      </header>

      {/* Main layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 260px',
        gap: 16,
        padding: 16,
        flex: 1,
        alignItems: 'start',
      }}>
        {/* Left: Controls */}
        <div style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}>
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

        {/* Center: Junction canvas */}
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
            display: 'flex', gap: 20,
          }}>
            <span>⏱ Sim time: {snapshot.simTime.toFixed(1)}s</span>
            <span>⚡ Speed: {speed}×</span>
            <span>🚗 Active: {snapshot.vehicles.filter(v => !v.exited).length}</span>
            <span>✅ Exited: {snapshot.metrics.totalExited}</span>
          </div>
        </div>

        {/* Right: Dashboard + Queue */}
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
    </div>
  );
};

export default App;
