// ============================================================
// QueuePanel.tsx — Per-approach queue lengths
// ============================================================

import React from 'react';
import type { SimMetrics, ApproachId } from '../simulation/types';
import type { SignalControllerState } from '../simulation/types';

interface Props {
  metrics: SimMetrics;
  signals: SignalControllerState;
}

const APPROACH_ICONS: Record<ApproachId, string> = {
  north: '⬆',
  south: '⬇',
  east:  '➡',
  west:  '⬅',
};

const SIGNAL_DOT: Record<string, string> = {
  green:  '#2ecc71',
  yellow: '#f1c40f',
  red:    '#e74c3c',
  allred: '#e74c3c',
};

export const QueuePanel: React.FC<Props> = ({ metrics, signals }) => {
  const approaches: ApproachId[] = ['north', 'east', 'south', 'west'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h3 style={{ margin: '0 0 6px', color: '#4fc3f7', fontSize: 13, letterSpacing: 1 }}>
        🚦 APPROACH QUEUES
      </h3>
      {approaches.map(a => {
        const sigColor = signals.signals[a].color;
        const qLen = metrics.queueLengths[a];
        const maxBar = 20;
        const barWidth = Math.min(qLen / maxBar, 1) * 100;

        return (
          <div key={a} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid #333',
            borderRadius: 7,
            padding: '8px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {/* Signal dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: SIGNAL_DOT[sigColor] ?? '#888',
                  boxShadow: `0 0 6px ${SIGNAL_DOT[sigColor] ?? '#888'}`,
                }} />
                <span style={{ color: '#ddd', fontSize: 12, fontWeight: 600 }}>
                  {APPROACH_ICONS[a]} {a.toUpperCase()}
                </span>
              </div>
              <span style={{ color: '#f39c12', fontFamily: 'monospace', fontSize: 13 }}>
                {qLen} waiting
              </span>
            </div>
            {/* Queue bar */}
            <div style={{ background: '#333', borderRadius: 3, height: 5 }}>
              <div style={{
                background: qLen > 10 ? '#e74c3c' : qLen > 5 ? '#f39c12' : '#2ecc71',
                borderRadius: 3,
                height: 5,
                width: `${barWidth}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
