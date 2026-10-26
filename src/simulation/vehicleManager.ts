// ============================================================
// vehicleManager.ts — Vehicle generation and movement
// ============================================================
// FIXED:
//  - Wait-time now accumulates for ANY stopped vehicle regardless of
//    whether it's stopped directly at the stop line or stuck behind
//    a queued vehicle.
//  - Vehicles past the stop line (inside/through junction) that are
//    gap-blocked by a vehicle ahead are no longer falsely marked stopped.
//  - vehicleCanvasCoords uses only CANVAS_W/CANVAS_H (removed unused
//    JUNCTION_X/Y/SIZE imports).

import type { Vehicle, ApproachId, VehicleType, SignalControllerState } from './types';
import {
  VEHICLE_SPEEDS,
  VEHICLE_SIZES,
  VEHICLE_COLORS,
  SPAWN_SPACING,
  MIN_GAP,
  STOP_POSITIONS,
  TRAVEL_THROUGH,
  CANVAS_W,
  CANVAS_H,
} from './constants';
import { isGreen } from './signalController';

let vehicleCounter = 0;

function randomType(): VehicleType {
  const r = Math.random();
  if (r < 0.6) return 'car';
  if (r < 0.85) return 'motorcycle';
  return 'bus';
}

function randomColor(type: VehicleType): string {
  const palette = VEHICLE_COLORS[type];
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Generates an initial queue of vehicles for an approach.
 * position=0 is the spawn edge; negative positions are off-screen further back.
 */
export function generateVehicles(approach: ApproachId, count: number): Vehicle[] {
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < count; i++) {
    const type = randomType();
    const [width, height] = VEHICLE_SIZES[type];
    const speed = VEHICLE_SPEEDS[type];
    const position = -(i * SPAWN_SPACING);
    vehicles.push({
      id:       `${approach}-${++vehicleCounter}`,
      approach,
      type,
      position,
      width,
      height,
      speed,
      exited:   false,
      waitTime: 0,
      stopped:  false,
      color:    randomColor(type),
    });
  }
  return vehicles;
}

function getStopPos(approach: ApproachId): number {
  return STOP_POSITIONS[approach];
}

function getExitPos(approach: ApproachId): number {
  return getStopPos(approach) + TRAVEL_THROUGH;
}

/**
 * Steps all vehicles forward by dt simulation-seconds.
 *
 * Movement rules (in priority order):
 *  1. If signal is red/yellow AND vehicle hasn't crossed the stop line,
 *     clamp advance so the vehicle front doesn't exceed the stop position.
 *  2. Maintain a minimum gap (MIN_GAP) from the vehicle immediately ahead.
 *  3. Any vehicle whose final advance is effectively zero is marked stopped
 *     and accumulates waitTime regardless of cause.
 */
export function stepVehicles(
  vehicles: Vehicle[],
  signals: SignalControllerState,
  dt: number
): Vehicle[] {
  const approaches: ApproachId[] = ['north', 'east', 'south', 'west'];
  const result: Vehicle[] = [];

  for (const approach of approaches) {
    // Sort front-to-back (highest position first = closest to junction)
    const apVehicles = vehicles
      .filter(v => v.approach === approach && !v.exited)
      .sort((a, b) => b.position - a.position);

    const exitPos = getExitPos(approach);
    const stopPos = getStopPos(approach);
    const green   = isGreen(signals, approach);

    const updated: Vehicle[] = [];

    for (let i = 0; i < apVehicles.length; i++) {
      const v = { ...apVehicles[i] };

      // Base advance this tick
      let maxAdvance = v.speed * dt;

      // ── Rule 1: Stop-line constraint ──────────────────────────────────
      // A vehicle that hasn't yet crossed the stop line must halt there
      // when the signal is not green.
      const beforeStopLine = v.position < stopPos;
      if (!green && beforeStopLine) {
        // distToStop = gap between current front and the stop line
        const distToStop = stopPos - v.position - v.height;
        if (distToStop <= 0) {
          maxAdvance = 0; // already at/past stop line — freeze
        } else {
          maxAdvance = Math.min(maxAdvance, distToStop);
        }
      }

      // ── Rule 2: Gap constraint ────────────────────────────────────────
      // Maintain minimum following distance from vehicle ahead.
      if (i > 0) {
        const ahead = updated[i - 1];
        const gap   = ahead.position - v.position - ahead.height;
        if (gap <= MIN_GAP) {
          maxAdvance = 0; // too close — freeze
        } else {
          maxAdvance = Math.min(maxAdvance, gap - MIN_GAP);
        }
      }

      maxAdvance = Math.max(0, maxAdvance);
      v.position = v.position + maxAdvance;

      // ── Rule 3: Stopped flag & wait accumulation ──────────────────────
      // A vehicle is "stopped" if it made negligible progress this tick.
      // This correctly captures: (a) red-light stops, (b) queue pile-ups.
      const effectivelyStopped = maxAdvance < 0.01;
      v.stopped = effectivelyStopped;
      if (effectivelyStopped) {
        v.waitTime += dt;
      }

      // ── Exit check ────────────────────────────────────────────────────
      if (v.position >= exitPos) {
        v.exited  = true;
        v.stopped = false;
      }

      updated.push(v);
    }

    result.push(...updated);
  }

  // Preserve already-exited vehicles
  const exited = vehicles.filter(v => v.exited);
  result.push(...exited);

  return result;
}

/** Resets the vehicle counter (call on full simulation reset) */
export function resetVehicleCounter(): void {
  vehicleCounter = 0;
}

/**
 * Converts a vehicle's simulation position into canvas pixel coordinates.
 * Returns the top-left corner (x, y) and dimensions (w, h) of the vehicle rect.
 *
 * Coordinate convention:
 *   position = distance (px) from the approach's spawn edge toward the junction.
 *   North/South vehicles travel vertically; East/West travel horizontally.
 *   Each approach uses the right-of-centre lane (for realistic two-way traffic).
 */
export function vehicleCanvasCoords(v: Vehicle): {
  x: number; y: number; w: number; h: number;
} {
  const cx = CANVAS_W / 2; // canvas centre X
  const cy = CANVAS_H / 2; // canvas centre Y
  const laneOffset = 12;   // px from road centreline to vehicle centre

  switch (v.approach) {
    case 'north': {
      // Travels downward (position grows downward from top)
      return {
        x: cx - laneOffset - v.width / 2,
        y: v.position,
        w: v.width,
        h: v.height,
      };
    }
    case 'south': {
      // Travels upward (position grows upward from bottom)
      return {
        x: cx + laneOffset - v.width / 2,
        y: CANVAS_H - v.position - v.height,
        w: v.width,
        h: v.height,
      };
    }
    case 'east': {
      // Travels leftward (position grows leftward from right edge)
      return {
        x: CANVAS_W - v.position - v.height,
        y: cy - laneOffset - v.width / 2,
        w: v.height, // swapped: height is along travel direction
        h: v.width,
      };
    }
    case 'west': {
      // Travels rightward (position grows rightward from left edge)
      return {
        x: v.position,
        y: cy + laneOffset - v.width / 2,
        w: v.height,
        h: v.width,
      };
    }
  }
}
