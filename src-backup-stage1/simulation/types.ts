// ============================================================
// types.ts — All TypeScript types for the simulation
// ============================================================

export type ApproachId = 'north' | 'east' | 'south' | 'west';

export type VehicleType = 'car' | 'motorcycle' | 'bus';

export type SignalColor = 'green' | 'yellow' | 'red' | 'allred';

/** A single vehicle in the simulation */
export interface Vehicle {
  id: string;
  approach: ApproachId;
  type: VehicleType;
  /** Position along the approach lane in pixels (0 = spawn point, increases toward junction) */
  position: number;
  /** Visual width in pixels */
  width: number;
  /** Visual height (along travel direction) in pixels */
  height: number;
  /** Speed in pixels per simulation second */
  speed: number;
  /** Whether this vehicle has exited the junction */
  exited: boolean;
  /** Accumulated wait time in simulation-seconds */
  waitTime: number;
  /** Whether vehicle is currently stopped */
  stopped: boolean;
  /** Unique color tint for visual variety */
  color: string;
}

/** One traffic signal approach */
export interface SignalState {
  approach: ApproachId;
  color: SignalColor;
  /** Remaining time in the current phase (simulation-seconds) */
  countdown: number;
}

/** The overall signal controller state */
export interface SignalControllerState {
  signals: Record<ApproachId, SignalState>;
  activeApproach: ApproachId;
  phase: 'green' | 'yellow' | 'allred';
  phaseTimer: number; // time remaining in current phase (sim-seconds)
}

/** Configurable green durations per approach (sim-seconds) */
export type GreenDurations = Record<ApproachId, number>;

/** Traffic demand: initial vehicle count per approach */
export interface TrafficDemand {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Aggregated dashboard metrics */
export interface SimMetrics {
  totalGenerated: number;
  currentWaiting: number;
  totalExited: number;
  queueLengths: Record<ApproachId, number>;
  avgWaitTime: number;       // seconds
  totalWaitTime: number;     // seconds
  throughputPerMin: number;  // vehicles/minute
  simTimeElapsed: number;    // simulation-seconds
  activeSignal: ApproachId;
  signalPhase: string;
  countdown: number;
}

/** Full simulation state snapshot */
export interface SimState {
  vehicles: Vehicle[];
  signals: SignalControllerState;
  metrics: SimMetrics;
  running: boolean;
  simTime: number; // total elapsed simulation time in seconds
}

export const APPROACHES: ApproachId[] = ['north', 'east', 'south', 'west'];
