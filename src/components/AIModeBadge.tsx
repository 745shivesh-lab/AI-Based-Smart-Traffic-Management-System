// ============================================================
// AIModeBadge.tsx
// Dashboard panel showing:
//   • Current mode (Manual / AI-Driven)
//   • Camera active / stale status
//   • Per-approach AI-derived demand
//   • Detection bridge explanation
// ============================================================

import React from 'react';
import type { TrafficDemand, ApproachId } from '../simulation/types';
import type { BridgeState } from '../ai-camera/aiDetectionBridge';

interface Props {
  aiDriven: boolean;
  bridgeState: BridgeState | null;
  aiDemand: TrafficDemand | null;
  onToggle: () => void;
}

const APPROACHES: ApproachId[] = ['north', 'east', 'south', 'west'];

const ICON: Record<ApproachId, string> = {
  north: '⬆', east: '➡', south: '⬇', west: '⬅',
};

export const AIModeBadge: React.FC<Props> = ({ aiDriven, bridgeState, aiDemand, onToggle }) => {
  const cameraActive = bridgeState?.cameraActive ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, color: '#4fc3f7', fontSize: 13, letterSpacing: 1 }}>
          🤖 CONTROL MODE
        </h3>
        <button
          onClick={onToggle}
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            border: `1px solid ${aiDriven ? '#00ff88' : '#f39c12'}`,
            borderRadius: 5,
            background: aiDriven ? 'rgba(0,255,136,0.10)' : 'rgba(243,156,18,0.10)',
            color: aiDriven ? '#00ff88' : '#f39c12',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {aiDriven ? '🟢 AI-Driven' : '🟡 Manual'}
        </button>
      </div>

      {/* Mode description */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${aiDriven ? '#00ff8840' : '#f39c1240'}`,
        borderRadius: 7,
        padding: '8px 10px',
        fontSize: 11,
        color: '#aaa',
        lineHeight: 1.5,
      }}>
        {aiDriven ? (
          <>
            <span style={{ color: '#00ff88', fontWeight: 700 }}>AI-Driven mode active.</span>
            {' '}Vehicle detections from the camera panel update simulation demand.
            {!cameraActive && (
              <span style={{ color: '#e74c3c' }}>
                {' '}⚠ Camera inactive — open the AI Camera panel and upload a video or enable the webcam.
              </span>
            )}
          </>
        ) : (
          <>
            <span style={{ color: '#f39c12', fontWeight: 700 }}>Manual mode.</span>
            {' '}Traffic demand is set by the sliders and presets below.
            Click <em>AI-Driven</em> to connect camera detections.
          </>
        )}
      </div>

      {/* Camera status */}
      {aiDriven && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: '#888',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cameraActive ? '#2ecc71' : '#e74c3c',
            boxShadow: cameraActive ? '0 0 6px #2ecc71' : 'none',
            flexShrink: 0,
          }} />
          <span>
            Camera: {cameraActive ? 'Active — receiving detections' : 'Inactive / no detections'}
          </span>
        </div>
      )}

      {/* Per-approach AI demand */}
      {aiDriven && aiDemand && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            AI-derived demand (simulated vehicles)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {APPROACHES.map(a => (
              <div key={a} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #30363d',
                borderRadius: 5,
                padding: '5px 8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ color: '#aaa', fontSize: 11 }}>
                  {ICON[a]} {a.toUpperCase()}
                </span>
                <span style={{
                  color: aiDemand[a] > 20 ? '#e74c3c' : aiDemand[a] > 10 ? '#f39c12' : '#2ecc71',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 13,
                }}>
                  {aiDemand[a]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bridge explanation */}
      {aiDriven && bridgeState && (
        <div style={{
          background: 'rgba(79,195,247,0.05)',
          border: '1px solid #4fc3f730',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 10,
          color: '#78909c',
          lineHeight: 1.5,
        }}>
          <span style={{ color: '#4fc3f7' }}>ⓘ </span>
          {bridgeState.explanation}
        </div>
      )}

      {/* Limitation notice */}
      {aiDriven && (
        <p style={{ color: '#555', fontSize: 10, margin: 0, lineHeight: 1.5 }}>
          Limitation: COCO-SSD reports vehicles visible in each frame, not
          unique vehicles crossing a counting line. Demand is smoothed across
          frames to avoid spikes. Zone-to-approach mapping is configured manually.
        </p>
      )}
    </div>
  );
};
