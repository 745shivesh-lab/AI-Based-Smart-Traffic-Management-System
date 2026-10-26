// ============================================================
// simulationEngine.ts — Main orchestrator (pure logic, no React)
// ============================================================
// Added:
//   injectDemand(demand) — adds vehicles for each approach whose
//   target demand exceeds the current active vehicle count.
//   Used by AI-Driven mode to grow queues as detections arrive,
//   without resetting the simulation or signals.

import type {
  Vehicle,
  SignalControllerState,
  SimMetrics,
  TrafficDemand,
  GreenDurations,
  ApproachId,
} from './types';
import { APPROACHES } from './types';
import { DEFAULT_GREEN_DURATIONS } from './constants';
import { createInitialSignalState, stepSignalController } from './signalController';
import { generateVehicles, stepVehicles, resetVehicleCounter } from './vehicleManager';
import { collectMetrics } from './metricsCollector';

export interface SimSnapshot {
  vehicles: Vehicle[];
  signals:  SignalControllerState;
  metrics:  SimMetrics;
  simTime:  number;
}

export interface SimEngine {
  /** Advance the simulation by dt simulation-seconds */
  step(dt: number): SimSnapshot;
  /** Get current snapshot without advancing */
  snapshot(): SimSnapshot;
  /** Full reset — clears vehicles, metrics and signals */
  reset(demand?: TrafficDemand, greenDurations?: GreenDurations): SimSnapshot;
  /** Update green durations without resetting */
  setGreenDurations(durations: GreenDurations): void;
  /**
   * Soft demand update for AI-Driven mode.
   * For each approach, if the target demand is greater than the number of
   * active (non-exited) vehicles already on that approach, new vehicles are
   * spawned at the back of the queue to make up the difference.
   * Approaches with more vehicles than the target are left unchanged
   * (no teleportation or deletion of existing vehicles).
   */
  injectDemand(demand: TrafficDemand): void;
}

export const DEFAULT_DEMAND: TrafficDemand = {
  north: 30,
  south: 12,
  east:  45,
  west:  8,
};

function highestDemandApproach(demand: TrafficDemand): ApproachId {
  return APPROACHES.reduce((highest, approach) =>
    demand[approach] > demand[highest] ? approach : highest,
    APPROACHES[0]
  );
}

export function createSimEngine(
  initialDemand: TrafficDemand     = DEFAULT_DEMAND,
  initialGreenDurations: GreenDurations = DEFAULT_GREEN_DURATIONS
): SimEngine {
  let vehicles: Vehicle[]              = [];
  let signals:  SignalControllerState  = createInitialSignalState(
    initialGreenDurations,
    highestDemandApproach(initialDemand)
  );
  let simTime      = 0;
  let greenDurations = { ...initialGreenDurations };
  let exitedCount  = 0;

  function initVehicles(demand: TrafficDemand): void {
    vehicles = [];
    for (const a of APPROACHES) {
      vehicles.push(...generateVehicles(a as ApproachId, demand[a as ApproachId]));
    }
    exitedCount = 0;
  }

  initVehicles(initialDemand);

  const engine: SimEngine = {
    step(dt: number): SimSnapshot {
      signals = stepSignalController(signals, dt, greenDurations, vehicles);

      const before = vehicles.filter(v => !v.exited).length;
      vehicles     = stepVehicles(vehicles, signals, dt);
      const after  = vehicles.filter(v => !v.exited).length;

      const newlyExited = before - after;
      if (newlyExited > 0) exitedCount += newlyExited;

      simTime += dt;
      return engine.snapshot();
    },

    snapshot(): SimSnapshot {
      const metrics = collectMetrics(vehicles, signals, simTime, exitedCount);
      return { vehicles: [...vehicles], signals, metrics, simTime };
    },

    reset(demand: TrafficDemand = DEFAULT_DEMAND, gd?: GreenDurations): SimSnapshot {
      if (gd) greenDurations = { ...gd };
      simTime = 0;
      resetVehicleCounter();
      initVehicles(demand);
      signals = createInitialSignalState(greenDurations, highestDemandApproach(demand));
      return engine.snapshot();
    },

    setGreenDurations(durations: GreenDurations): void {
      greenDurations = { ...durations };
    },

    injectDemand(demand: TrafficDemand): void {
      for (const a of APPROACHES) {
        const approach = a as ApproachId;
        const target   = demand[approach];
        // Count vehicles currently active on this approach
        const active   = vehicles.filter(v => v.approach === approach && !v.exited).length;
        const deficit  = target - active;
        if (deficit <= 0) continue; // already enough vehicles — don't remove any

        // Spawn `deficit` new vehicles queued behind all existing ones
        const newVehicles = generateVehicles(approach, deficit);
        // Find the rearmost existing vehicle to position new ones behind it
        const rearmost = vehicles
          .filter(v => v.approach === approach && !v.exited)
          .reduce((min, v) => (v.position < min ? v.position : min), 0);

        // Push new vehicles further back so they don't overlap
        const BACK_OFFSET = 68; // px — same as SPAWN_SPACING
        newVehicles.forEach((v, i) => {
          v.position = rearmost - (i + 1) * BACK_OFFSET;
        });

        vehicles.push(...newVehicles);
      }
    },
  };

  return engine;
}
