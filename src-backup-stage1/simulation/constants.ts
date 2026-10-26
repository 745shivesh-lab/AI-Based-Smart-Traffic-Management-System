// ============================================================
// constants.ts — Tunable simulation constants
// ============================================================

import type { ApproachId, GreenDurations } from './types';

/** Canvas dimensions */
export const CANVAS_W = 800;
export const CANVAS_H = 800;

/** Junction box (intersection area) */
export const JUNCTION_SIZE = 160; // pixels
export const JUNCTION_X = (CANVAS_W - JUNCTION_SIZE) / 2; // 320
export const JUNCTION_Y = (CANVAS_H - JUNCTION_SIZE) / 2; // 320

/** Road lane width (pixels) */
export const LANE_WIDTH = 44;

/** Stop line distance from junction edge (pixels) */
export const STOP_LINE_GAP = 6;

/**
 * Where vehicles STOP (front of vehicle aligns here) per approach.
 * Measured as position along the approach lane from the spawn edge.
 * Approaches travel INWARD toward the junction.
 */
export const STOP_POSITIONS: Record<ApproachId, number> = {
  north: JUNCTION_Y - STOP_LINE_GAP,           // approaching from top
  south: CANVAS_H - JUNCTION_Y - JUNCTION_SIZE - STOP_LINE_GAP,
  east:  CANVAS_W - JUNCTION_X - JUNCTION_SIZE - STOP_LINE_GAP,
  west:  JUNCTION_X - STOP_LINE_GAP,
};

/**
 * Total travel distance across the junction for a vehicle to exit.
 */
export const TRAVEL_THROUGH = JUNCTION_SIZE + 80; // pixels to travel through junction

/** Minimum gap between vehicles (pixels) */
export const MIN_GAP = 8;

/** Simulation fixed step in seconds (16ms ≈ 60fps) */
export const SIM_STEP = 1 / 60;

/** Default green durations (seconds) */
export const DEFAULT_GREEN_DURATIONS: GreenDurations = {
  north: 20,
  east:  25,
  south: 15,
  west:  12,
};

/** Yellow phase duration (seconds) */
export const YELLOW_DURATION = 3;

/** All-red clearance duration (seconds) */
export const ALLRED_DURATION = 2;

/** Approach order for cycling */
export const APPROACH_ORDER: ApproachId[] = ['north', 'east', 'south', 'west'];

/** Vehicle type speeds (pixels per simulation-second) */
export const VEHICLE_SPEEDS = {
  car:        90,
  motorcycle: 110,
  bus:        65,
};

/** Vehicle visual sizes [width, height] — width = across road, height = along travel */
export const VEHICLE_SIZES: Record<string, [number, number]> = {
  car:        [20, 32],
  motorcycle: [10, 22],
  bus:        [26, 52],
};

/** Colors for vehicles by type */
export const VEHICLE_COLORS = {
  car:        ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'],
  motorcycle: ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff'],
  bus:        ['#f0a500','#0096c7','#e63946'],
};

/** Spawn interval per approach: space between consecutive vehicles at start (pixels) */
export const SPAWN_SPACING = 68;
