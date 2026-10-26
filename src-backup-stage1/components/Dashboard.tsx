// ============================================================
// Dashboard.tsx — Live metric cards
// ============================================================

import React from 'react';
import type { SimMetrics } from '../simulation/types';

interface Props {
  metrics: SimMetrics;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, color = '#4fc3f7' }) => (
  <div style={{
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${color}33`,
    borderRadius: 8,
    padding: '10px 14px',
    minWidth: 110,
    flex: '1 1 110px',
  }}>
    <div style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ color, fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>
      {value}
      {unit && <span style={{ fontSize: 12, color: '#aaa', marginLeft: 3 }}>{unit}</span>}
    </div>
  </div>
);

export const Dashboard: React.FC<Props> = ({ metrics }) => {
  const phaseLabel = (phase: string) => {
    if (phase === 'green') return '🟢 GREEN';
    if (phase === 'yellow') return '🟡 YELLOW';
    if (phase === 'allred') return '🔴 ALL-RED';
    return phase.toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ margin: '0 0 6px', color: '#4fc3f7', fontSize: 13, letterSpacing: 1 }}>
        📊 LIVE METRICS
      </h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <MetricCard label="Total Generated" value={metrics.totalGenerated} color="#4fc3f7" />
        <MetricCard label="Active / Waiting" value={`${metrics.totalGenerated - metrics.totalExited} / ${metrics.currentWaiting}`} color="#f39c12" />
        <MetricCard label="Exited" value={metrics.totalExited} color="#2ecc71" />
        <MetricCard label="Throughput" value={metrics.throughputPerMin.toFixed(1)} unit="veh/min" color="#9b59b6" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <MetricCard label="Avg Wait" value={metrics.avgWaitTime.toFixed(1)} unit="s" color="#e74c3c" />
        <MetricCard label="Total Wait" value={metrics.totalWaitTime.toFixed(0)} unit="s" color="#e67e22" />
        <MetricCard label="Sim Time" value={metrics.simTimeElapsed.toFixed(1)} unit="s" color="#1abc9c" />
      </div>

      {/* Signal status */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid #444',
        borderRadius: 8,
        padding: '10px 14px',
        marginTop: 2,
      }}>
        <div style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Current Signal Phase
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
            {metrics.activeSignal.toUpperCase()} — {phaseLabel(metrics.signalPhase)}
          </div>
          <div style={{
            background: '#333',
            borderRadius: 5,
            padding: '2px 10px',
            fontFamily: 'monospace',
            fontSize: 18,
            color: '#f1c40f',
            minWidth: 40,
            textAlign: 'center',
          }}>
            {Math.ceil(metrics.countdown)}s
          </div>
        </div>
      </div>
    </div>
  );
};
