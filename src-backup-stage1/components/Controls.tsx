// ============================================================
// Controls.tsx — Play, Pause, Resume, Reset, Speed, Demand, Presets
// ============================================================
// FIXED:
//  - Local demand/greenDurations state now syncs from parent props via useEffect,
//    so input boxes stay correct after an external preset reset.
//  - Removed unused DEFAULT_GREEN_DURATIONS / DEFAULT_DEMAND imports.

import React, { useState, useEffect } from 'react';
import type { TrafficDemand, GreenDurations, ApproachId } from '../simulation/types';

interface Props {
  running: boolean;
  speed: number;
  demand: TrafficDemand;
  greenDurations: GreenDurations;
  onPlay:           () => void;
  onPause:          () => void;
  onReset:          (demand: TrafficDemand, gd: GreenDurations) => void;
  onSpeedChange:    (s: number) => void;
  onDemandChange:   (d: TrafficDemand) => void;
  onGreenDurChange: (gd: GreenDurations) => void;
}

const PRESETS: Record<string, TrafficDemand> = {
  Low:     { north: 5,  south: 5,  east: 5,  west: 5  },
  Medium:  { north: 15, south: 12, east: 20, west: 10 },
  High:    { north: 30, south: 25, east: 45, west: 20 },
  Default: { north: 30, south: 12, east: 45, west: 8  },
};

function randomDemand(): TrafficDemand {
  return {
    north: Math.floor(Math.random() * 40) + 5,
    south: Math.floor(Math.random() * 40) + 5,
    east:  Math.floor(Math.random() * 40) + 5,
    west:  Math.floor(Math.random() * 40) + 5,
  };
}

const BTN: React.CSSProperties = {
  padding: '7px 14px',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.5,
};

const APPROACHES: ApproachId[] = ['north', 'east', 'south', 'west'];

export const Controls: React.FC<Props> = ({
  running, speed, demand, greenDurations,
  onPlay, onPause, onReset, onSpeedChange,
  onDemandChange, onGreenDurChange,
}) => {
  const [localDemand, setLocalDemand] = useState<TrafficDemand>(demand);
  const [localGD, setLocalGD]         = useState<GreenDurations>(greenDurations);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync local state when parent updates demand (e.g. after a preset reset)
  useEffect(() => { setLocalDemand(demand); }, [demand]);
  useEffect(() => { setLocalGD(greenDurations); }, [greenDurations]);

  const handleDemandInput = (approach: ApproachId, val: string) => {
    const n = Math.max(0, Math.min(100, parseInt(val) || 0));
    const updated = { ...localDemand, [approach]: n };
    setLocalDemand(updated);
    onDemandChange(updated);
  };

  const handleGDInput = (approach: ApproachId, val: string) => {
    const n = Math.max(5, Math.min(120, parseInt(val) || 10));
    const updated = { ...localGD, [approach]: n };
    setLocalGD(updated);
    onGreenDurChange(updated);
  };

  const applyPreset = (preset: TrafficDemand) => {
    setLocalDemand(preset);
    onDemandChange(preset);
    onReset(preset, localGD);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Playback controls */}
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#4fc3f7', fontSize: 13, letterSpacing: 1 }}>
          ▶ SIMULATION CONTROLS
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!running ? (
            <button style={{ ...BTN, background: '#2ecc71', color: '#000' }} onClick={onPlay}>
              ▶ Play
            </button>
          ) : (
            <button style={{ ...BTN, background: '#f39c12', color: '#000' }} onClick={onPause}>
              ⏸ Pause
            </button>
          )}
          <button
            style={{ ...BTN, background: '#3498db', color: '#fff' }}
            onClick={() => onReset(localDemand, localGD)}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Speed */}
      <div>
        <label style={{ color: '#aaa', fontSize: 11, letterSpacing: 0.5 }}>
          SPEED: <span style={{ color: '#fff', fontWeight: 700 }}>{speed}×</span>
        </label>
        <input
          type="range" min={0.25} max={5} step={0.25}
          value={speed}
          onChange={e => onSpeedChange(parseFloat(e.target.value))}
          style={{ width: '100%', marginTop: 4, accentColor: '#4fc3f7' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666' }}>
          <span>0.25×</span><span>1×</span><span>5×</span>
        </div>
      </div>

      {/* Traffic demand presets */}
      <div>
        <h3 style={{ margin: '0 0 8px', color: '#4fc3f7', fontSize: 13, letterSpacing: 1 }}>
          🚗 TRAFFIC DEMAND
        </h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.entries(PRESETS).map(([name, preset]) => (
            <button
              key={name}
              style={{ ...BTN, background: '#2c3e50', color: '#4fc3f7', border: '1px solid #4fc3f7' }}
              onClick={() => applyPreset(preset)}
            >
              {name}
            </button>
          ))}
          <button
            style={{ ...BTN, background: '#2c3e50', color: '#9b59b6', border: '1px solid #9b59b6' }}
            onClick={() => applyPreset(randomDemand())}
          >
            🎲 Random
          </button>
        </div>

        {/* Per-approach demand inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {APPROACHES.map(a => (
            <div key={a} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {a}
              </label>
              <input
                type="number" min={0} max={100}
                value={localDemand[a]}
                onChange={e => handleDemandInput(a, e.target.value)}
                style={{
                  background: '#2c3e50', color: '#fff', border: '1px solid #4fc3f7',
                  borderRadius: 4, padding: '4px 8px', fontSize: 13, width: '100%',
                }}
              />
            </div>
          ))}
        </div>
        <button
          style={{ ...BTN, background: '#27ae60', color: '#fff', marginTop: 8, width: '100%' }}
          onClick={() => onReset(localDemand, localGD)}
        >
          Apply & Reset
        </button>
      </div>

      {/* Advanced: green durations */}
      <div>
        <button
          style={{ ...BTN, background: 'transparent', color: '#aaa', border: '1px solid #555', fontSize: 11 }}
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? '▲' : '▼'} Signal Timing (Fixed-Time)
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {APPROACHES.map(a => (
              <div key={a} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {a} green (s)
                </label>
                <input
                  type="number" min={5} max={120}
                  value={localGD[a]}
                  onChange={e => handleGDInput(a, e.target.value)}
                  style={{
                    background: '#2c3e50', color: '#fff', border: '1px solid #2ecc71',
                    borderRadius: 4, padding: '4px 8px', fontSize: 13, width: '100%',
                  }}
                />
              </div>
            ))}
            <div style={{ gridColumn: 'span 2' }}>
              <button
                style={{ ...BTN, background: '#16a085', color: '#fff', width: '100%' }}
                onClick={() => onReset(localDemand, localGD)}
              >
                Apply Signal Timing & Reset
              </button>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <p style={{ color: '#888', fontSize: 10, margin: 0, lineHeight: 1.5 }}>
                ℹ Fixed-time mode: signals follow configured durations regardless of
                queue length. Yellow = 3s, All-red clearance = 2s are fixed.
                Adaptive control is prepared for Stage 2.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
