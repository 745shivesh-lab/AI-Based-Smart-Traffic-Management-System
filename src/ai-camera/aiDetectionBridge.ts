// ============================================================
// aiDetectionBridge.ts
// Pure logic module — no React, no DOM.
//
// Converts raw per-frame COCO-SSD detections into a smoothed
// TrafficDemand that the simulation engine can consume safely.
//
// Design decisions & honest limitations
// ──────────────────────────────────────
// • A real traffic camera would track individual vehicles crossing a
//   counting line. COCO-SSD gives us a snapshot of vehicles VISIBLE
//   in the current frame, not unique vehicles passing the camera.
//
// • We therefore treat the per-frame vehicle count as a proxy for
//   *density* / *flow rate* on the mapped approach and convert it
//   into an arrival rate (vehicles per minute) that drives demand.
//
// • A smoothed EWMA (exponentially weighted moving average) prevents
//   single-frame noise from causing unrealistic demand spikes.
//
// • A stale-detection timeout (default 5 s) marks the camera as
//   inactive if no new detections arrive, so stale data does not
//   control signals indefinitely.
// ============================================================

import type { ApproachId, TrafficDemand } from '../simulation/types';

export type DetectedVehicleClass = 'car' | 'bus' | 'truck' | 'motorcycle';

/** One detection record as reported by COCO-SSD / AICamera */
export interface RawDetection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

/** Which approach each horizontal video zone maps to.
 *  The user configures this because a single camera cannot know
 *  the compass direction of approaching traffic. */
export type ZoneMapping = {
  /** Fraction of video width for left zone boundary (0–1).
   *  Left zone  → leftApproach
   *  Centre zone → centreApproach  (optional, may be null)
   *  Right zone → rightApproach */
  leftApproach:   ApproachId;
  rightApproach:  ApproachId;
  centreApproach: ApproachId | null;
};

export const DEFAULT_ZONE_MAPPING: ZoneMapping = {
  leftApproach:   'west',
  rightApproach:  'east',
  centreApproach: null,      // centre vehicles are split between left and right
};

/** Per-approach smoothed state maintained between frames */
interface ApproachState {
  /** Smoothed vehicle count visible in the frame */
  smoothedCount: number;
  /** Timestamp (ms) of the last update */
  lastUpdatedMs: number;
}

export interface BridgeState {
  approachStates: Record<ApproachId, ApproachState>;
  /** Whether the camera is currently sending live detections */
  cameraActive: boolean;
  lastDetectionMs: number;
  /** Human-readable explanation of the most recent demand decision */
  explanation: string;
}

/** Configuration for the bridge */
export interface BridgeConfig {
  /** EWMA smoothing factor (0–1). Higher = more responsive to current frame. */
  smoothingAlpha: number;
  /** Seconds without a detection before the camera is marked stale */
  staleTimeoutSec: number;
  /** Scale factor: smoothedCount × scale = demand (vehicles in queue) */
  countToDemandScale: number;
  /** Minimum demand per approach when camera is active */
  minDemand: number;
  /** Maximum demand per approach */
  maxDemand: number;
}

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  smoothingAlpha:     0.35,
  staleTimeoutSec:    5,
  countToDemandScale: 4,     // 3 visible vehicles → 12 in simulated queue
  minDemand:          2,
  maxDemand:          60,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function makeApproachState(): ApproachState {
  return { smoothedCount: 0, lastUpdatedMs: 0 };
}

/** Creates a fresh bridge state */
export function createBridgeState(): BridgeState {
  return {
    approachStates: {
      north: makeApproachState(),
      east:  makeApproachState(),
      south: makeApproachState(),
      west:  makeApproachState(),
    },
    cameraActive:     false,
    lastDetectionMs:  0,
    explanation:      'No detections yet.',
  };
}

/**
 * Assigns detections to approaches based on horizontal position in the video.
 *
 * The video is divided into three equal horizontal zones:
 *   Left third  → leftApproach
 *   Right third → rightApproach
 *   Centre      → centreApproach (if set), otherwise split
 *
 * Limitation: this is a heuristic. A real system would use counting lines.
 */
function assignToApproach(
  det: RawDetection,
  videoWidth: number,
  mapping: ZoneMapping
): ApproachId {
  const cx = det.bbox[0] + det.bbox[2] / 2; // centre X of bounding box
  const rel = videoWidth > 0 ? cx / videoWidth : 0.5;

  if (rel < 0.33) return mapping.leftApproach;
  if (rel > 0.67) return mapping.rightApproach;
  // Centre zone
  if (mapping.centreApproach) return mapping.centreApproach;
  // No centre approach — assign to whichever side the centre-x is closer to
  return rel < 0.5 ? mapping.leftApproach : mapping.rightApproach;
}

/**
 * Process a new batch of detections from one video frame.
 *
 * Call this every time AICamera reports a new detection set.
 * Returns updated BridgeState and a new TrafficDemand for the simulation.
 */
export function processDetections(
  state: BridgeState,
  detections: RawDetection[],
  videoWidth: number,
  mapping: ZoneMapping,
  config: BridgeConfig,
  nowMs: number = Date.now()
): { state: BridgeState; demand: TrafficDemand } {
  // Count per approach in this frame
  const frameCounts: Record<ApproachId, number> = {
    north: 0, east: 0, south: 0, west: 0,
  };
  for (const det of detections) {
    const a = assignToApproach(det, videoWidth, mapping);
    frameCounts[a]++;
  }

  // Update smoothed counts with EWMA
  const alpha = config.smoothingAlpha;
  const newStates = { ...state.approachStates };
  const parts: string[] = [];

  for (const a of ['north', 'east', 'south', 'west'] as ApproachId[]) {
    const prev = state.approachStates[a].smoothedCount;
    const cur  = frameCounts[a];
    const smoothed = prev * (1 - alpha) + cur * alpha;
    newStates[a] = { smoothedCount: smoothed, lastUpdatedMs: nowMs };
    if (cur > 0) parts.push(`${a}: ${cur} visible`);
  }

  const total = detections.length;
  const explanation = total === 0
    ? 'No vehicles detected in this frame.'
    : `Frame: ${total} vehicle(s) detected — ${parts.join(', ')}. Demand smoothed (α=${alpha}).`;

  const newBridgeState: BridgeState = {
    approachStates:  newStates,
    cameraActive:    true,
    lastDetectionMs: nowMs,
    explanation,
  };

  const demand = computeDemand(newBridgeState, config);
  return { state: newBridgeState, demand };
}

/**
 * Call on each simulation tick to check staleness.
 * If the camera has gone silent, marks it inactive.
 */
export function tickBridge(
  state: BridgeState,
  config: BridgeConfig,
  nowMs: number = Date.now()
): { state: BridgeState; demand: TrafficDemand } {
  const elapsed = (nowMs - state.lastDetectionMs) / 1000;
  if (state.cameraActive && elapsed > config.staleTimeoutSec) {
    const staleState: BridgeState = {
      ...state,
      cameraActive: false,
      explanation:  `Camera inactive — no detections for ${Math.round(elapsed)}s. Demand held at last values.`,
    };
    return { state: staleState, demand: computeDemand(staleState, config) };
  }
  return { state, demand: computeDemand(state, config) };
}

function computeDemand(state: BridgeState, config: BridgeConfig): TrafficDemand {
  const scale = config.countToDemandScale;
  const lo    = config.minDemand;
  const hi    = config.maxDemand;

  return {
    north: clamp(Math.round(state.approachStates.north.smoothedCount * scale), lo, hi),
    east:  clamp(Math.round(state.approachStates.east.smoothedCount  * scale), lo, hi),
    south: clamp(Math.round(state.approachStates.south.smoothedCount * scale), lo, hi),
    west:  clamp(Math.round(state.approachStates.west.smoothedCount  * scale), lo, hi),
  };
}
