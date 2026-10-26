// ============================================================
// ZoneMappingPanel.tsx
// Lets the user assign horizontal video zones (left / right)
// to the four simulation approaches.
// ============================================================

import React from 'react';
import type { ApproachId } from '../simulation/types';
import type { ZoneMapping } from '../ai-camera/aiDetectionBridge';

interface Props {
  mapping: ZoneMapping;
  onChange: (m: ZoneMapping) => void;
}

const APPROACHES: ApproachId[] = ['north', 'east', 'south', 'west'];

const SELECT_STYLE: React.CSSProperties = {
  background: '#0d1117',
  color: '#e0e0e0',
  border: '1px solid #4fc3f7',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 12,
  cursor: 'pointer',
  width: '100%',
};

export const ZoneMappingPanel: React.FC<Props> = ({ mapping, onChange }) => {
  const set = (key: keyof ZoneMapping, val: string) => {
    onChange({
      ...mapping,
      [key]: val === 'none' ? null : val as ApproachId,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#aaa', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        📐 Video Zone → Approach Mapping
      </div>

      {/* Diagram */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 4,
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: 6,
        fontSize: 10,
        textAlign: 'center',
        color: '#888',
      }}>
        <div style={{ background: '#1a3a5c', borderRadius: 4, padding: '4px 2px' }}>LEFT ZONE</div>
        <div style={{ background: '#1a3a2c', borderRadius: 4, padding: '4px 2px' }}>CENTRE</div>
        <div style={{ background: '#3a1a1a', borderRadius: 4, padding: '4px 2px' }}>RIGHT ZONE</div>
        <div style={{ color: '#4fc3f7', fontSize: 9 }}>≤ 33% width</div>
        <div style={{ color: '#4fc3f7', fontSize: 9 }}>33–67%</div>
        <div style={{ color: '#4fc3f7', fontSize: 9 }}>≥ 67% width</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Left zone */}
        <div>
          <label style={{ color: '#aaa', fontSize: 10 }}>Left zone →</label>
          <select
            value={mapping.leftApproach}
            onChange={e => set('leftApproach', e.target.value)}
            style={SELECT_STYLE}
          >
            {APPROACHES.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
          </select>
        </div>

        {/* Right zone */}
        <div>
          <label style={{ color: '#aaa', fontSize: 10 }}>Right zone →</label>
          <select
            value={mapping.rightApproach}
            onChange={e => set('rightApproach', e.target.value)}
            style={SELECT_STYLE}
          >
            {APPROACHES.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
          </select>
        </div>

        {/* Centre zone */}
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ color: '#aaa', fontSize: 10 }}>Centre zone → (optional)</label>
          <select
            value={mapping.centreApproach ?? 'none'}
            onChange={e => set('centreApproach', e.target.value)}
            style={SELECT_STYLE}
          >
            <option value="none">Split between left &amp; right</option>
            {APPROACHES.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <p style={{ color: '#666', fontSize: 10, margin: 0, lineHeight: 1.5 }}>
        ⓘ A single camera cannot identify compass directions automatically.
        Match the zones to your video: e.g. if traffic approaching from the
        West appears on the left side of the frame, set Left → WEST.
      </p>
    </div>
  );
};
