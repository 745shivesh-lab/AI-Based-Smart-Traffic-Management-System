// ============================================================
// JunctionCanvas.tsx — HTML Canvas renderer for the junction
// ============================================================
// FIXED:
//  - ctx.shadowColor / shadowBlur are now fully reset after each signal
//    light, preventing glow bleeding onto stop lines, text and road markings.
//  - Duplicate direction-arrow fillText calls removed (was drawing ↕ and ↔
//    on top of each other at the same coordinate).
//  - Stop line positions verified against STOP_POSITIONS coordinate space.
//  - Signal housing drawn with roundRect stroke so it's always visible.
//  - Countdown font size bumped to 11px for readability.

import React, { useRef, useEffect, useCallback } from 'react';
import type { Vehicle, SignalControllerState, ApproachId } from '../simulation/types';
import { vehicleCanvasCoords } from '../simulation/vehicleManager';
import {
  CANVAS_W, CANVAS_H,
  JUNCTION_X, JUNCTION_Y, JUNCTION_SIZE,
  LANE_WIDTH,
  STOP_POSITIONS,
} from '../simulation/constants';

interface Props {
  vehicles: Vehicle[];
  signals:  SignalControllerState;
}

const SIGNAL_COLORS: Record<string, string> = {
  green:  '#2ecc71',
  yellow: '#f1c40f',
  red:    '#e74c3c',
  allred: '#e74c3c',
};

const ASPHALT = '#3d3d3d';
const GRASS   = '#1a472a';

export const JunctionCanvas: React.FC<Props> = ({ vehicles, signals }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const jx       = JUNCTION_X;         // 320
    const jy       = JUNCTION_Y;         // 320
    const js       = JUNCTION_SIZE;      // 160
    const cx       = CANVAS_W / 2;       // 400
    const cy       = CANVAS_H / 2;       // 400
    const halfRoad = LANE_WIDTH * 2;     // 88  (two lanes)

    // ── Background ─────────────────────────────────────────────────────
    ctx.fillStyle = GRASS;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Road surfaces ───────────────────────────────────────────────────
    ctx.fillStyle = ASPHALT;
    ctx.fillRect(cx - halfRoad, 0, halfRoad * 2, CANVAS_H); // N-S road
    ctx.fillRect(0, cy - halfRoad, CANVAS_W, halfRoad * 2); // E-W road

    // Junction box (slightly lighter asphalt)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(jx, jy, js, js);

    // ── Lane centre dashes ──────────────────────────────────────────────
    ctx.save();
    ctx.setLineDash([18, 12]);
    ctx.strokeStyle = 'rgba(240,240,240,0.6)';
    ctx.lineWidth = 1.5;

    // N-S centre line (above and below junction)
    ctx.beginPath();
    ctx.moveTo(cx, 0);    ctx.lineTo(cx, jy);
    ctx.moveTo(cx, jy + js); ctx.lineTo(cx, CANVAS_H);
    ctx.stroke();

    // E-W centre line (left and right of junction)
    ctx.beginPath();
    ctx.moveTo(0, cy);    ctx.lineTo(jx, cy);
    ctx.moveTo(jx + js, cy); ctx.lineTo(CANVAS_W, cy);
    ctx.stroke();
    ctx.restore();

    // ── Road edge kerb lines ────────────────────────────────────────────
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // North approach edges
    ctx.moveTo(cx - halfRoad, 0);   ctx.lineTo(cx - halfRoad, jy);
    ctx.moveTo(cx + halfRoad, 0);   ctx.lineTo(cx + halfRoad, jy);
    // South approach edges
    ctx.moveTo(cx - halfRoad, jy + js); ctx.lineTo(cx - halfRoad, CANVAS_H);
    ctx.moveTo(cx + halfRoad, jy + js); ctx.lineTo(cx + halfRoad, CANVAS_H);
    // East approach edges
    ctx.moveTo(jx + js, cy - halfRoad); ctx.lineTo(CANVAS_W, cy - halfRoad);
    ctx.moveTo(jx + js, cy + halfRoad); ctx.lineTo(CANVAS_W, cy + halfRoad);
    // West approach edges
    ctx.moveTo(0, cy - halfRoad); ctx.lineTo(jx, cy - halfRoad);
    ctx.moveTo(0, cy + halfRoad); ctx.lineTo(jx, cy + halfRoad);
    ctx.stroke();

    // ── Junction box yellow border ──────────────────────────────────────
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(jx + 4, jy + 4, js - 8, js - 8);
    ctx.restore();

    // ── Stop lines ─────────────────────────────────────────────────────
    // Each stop line is drawn as a thick white line on the appropriate
    // side of the junction, in the correct lane.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    // North: travels downward → stop line is a horizontal line at
    // pixel-y = STOP_POSITIONS.north (from top)
    const northStopY = STOP_POSITIONS.north; // 314
    ctx.beginPath();
    ctx.moveTo(cx - halfRoad + 2, northStopY);
    ctx.lineTo(cx - 2,            northStopY);
    ctx.stroke();

    // South: travels upward → pixel-y = CANVAS_H - STOP_POSITIONS.south
    const southStopY = CANVAS_H - STOP_POSITIONS.south; // 486
    ctx.beginPath();
    ctx.moveTo(cx + 2,            southStopY);
    ctx.lineTo(cx + halfRoad - 2, southStopY);
    ctx.stroke();

    // East: travels leftward → pixel-x = CANVAS_W - STOP_POSITIONS.east
    const eastStopX = CANVAS_W - STOP_POSITIONS.east; // 486
    ctx.beginPath();
    ctx.moveTo(eastStopX, cy - halfRoad + 2);
    ctx.lineTo(eastStopX, cy - 2);
    ctx.stroke();

    // West: travels rightward → pixel-x = STOP_POSITIONS.west
    const westStopX = STOP_POSITIONS.west; // 314
    ctx.beginPath();
    ctx.moveTo(westStopX, cy + 2);
    ctx.lineTo(westStopX, cy + halfRoad - 2);
    ctx.stroke();

    // ── Direction arrows inside junction ───────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↕', cx - 20, cy);
    ctx.fillText('↔', cx + 20, cy);
    ctx.textBaseline = 'alphabetic';

    // ── Direction labels ────────────────────────────────────────────────
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#eee';
    ctx.textAlign = 'center';
    ctx.fillText('NORTH', cx, 16);
    ctx.fillText('SOUTH', cx, CANVAS_H - 5);

    ctx.save();
    ctx.translate(16, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('WEST', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(CANVAS_W - 16, cy);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('EAST', 0, 0);
    ctx.restore();

    // ── Traffic signals ─────────────────────────────────────────────────
    // Positions chosen to sit beside each approach's stop line, clearly visible.
    drawSignal(ctx, signals.signals.north, cx - halfRoad - 36, jy - 56, 'north');
    drawSignal(ctx, signals.signals.south, cx + halfRoad + 6,  jy + js + 8, 'south');
    drawSignal(ctx, signals.signals.east,  jx + js + 8,        cy - halfRoad - 56, 'east');
    drawSignal(ctx, signals.signals.west,  jx - 44,            cy + halfRoad + 6, 'west');

    // ── Vehicles ────────────────────────────────────────────────────────
    for (const v of vehicles) {
      if (v.exited) continue;
      const { x, y, w, h } = vehicleCanvasCoords(v);

      // Cull vehicles fully outside canvas
      if (x + w < 0 || x > CANVAS_W || y + h < 0 || y > CANVAS_H) continue;

      // Body
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();

      // Windshield highlight (front of vehicle)
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.fillRect(x + 2, y + 2, w - 4, Math.min(h * 0.28, 7));

      // Brake lights (rear of vehicle) when stopped
      if (v.stopped) {
        ctx.fillStyle = 'rgba(255,60,60,0.9)';
        ctx.fillRect(x, y + h - 4, w, 4);
      }
    }
  }, [vehicles, signals]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        border: '2px solid #34495e',
        borderRadius: '8px',
        display: 'block',
      }}
    />
  );
};

// ── Signal drawing helper ─────────────────────────────────────────────────────
function drawSignal(
  ctx: CanvasRenderingContext2D,
  signal: { color: string; countdown: number },
  x: number,
  y: number,
  _approach: ApproachId
) {
  const boxW = 34;
  const boxH = 80;
  const r    = 10; // bulb radius

  // Housing
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 6);
  ctx.fill();
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Three bulbs: red (top), yellow (mid), green (bottom)
  const bulbs: Array<{ name: string; py: number }> = [
    { name: 'red',    py: y + 14 },
    { name: 'yellow', py: y + 40 },
    { name: 'green',  py: y + 66 },
  ];

  for (const { name, py } of bulbs) {
    const isActive =
      (name === 'red'    && (signal.color === 'red' || signal.color === 'allred')) ||
      (name === 'yellow' && signal.color === 'yellow') ||
      (name === 'green'  && signal.color === 'green');

    const bx = x + boxW / 2;

    // Always reset shadow before drawing anything
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    if (isActive) {
      ctx.shadowColor = SIGNAL_COLORS[name];
      ctx.shadowBlur  = 14;
    }

    ctx.fillStyle = isActive ? SIGNAL_COLORS[name] : '#1f2937';
    ctx.beginPath();
    ctx.arc(bx, py, r, 0, Math.PI * 2);
    ctx.fill();

    // Always clear shadow after each bulb so subsequent drawing is unaffected
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
  }

  // Countdown text below housing (only for non-red signals)
  if (signal.color !== 'red' && signal.countdown > 0) {
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(
      Math.ceil(signal.countdown).toString(),
      x + boxW / 2,
      y + boxH + 13
    );
  }
}
