// ============================================================
// simulationEngine.ts — Main orchestrator (pure logic, no React)
// ============================================================

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
  signals: SignalControllerState;
  metrics: SimMetrics;
  simTime: number;
}

export interface SimEngine {
  /** Advance the simulation by dt real-seconds × speedMultiplier */
  step(dt: number): SimSnapshot;
  /** Get current snapshot without advancing */
  snapshot(): SimSnapshot;
  /** Reset everything and optionally change demand */
  reset(demand?: TrafficDemand, greenDurations?: GreenDurations): SimSnapshot;
  /** Update green durations without resetting */
  setGreenDurations(durations: GreenDurations): void;
}

export const DEFAULT_DEMAND: TrafficDemand = {
  north: 30,
  south: 12,
  east:  45,
  west:  8,
};

export function createSimEngine(
  initialDemand: TrafficDemand = DEFAULT_DEMAND,
  initialGreenDurations: GreenDurations = DEFAULT_GREEN_DURATIONS
): SimEngine {
  let vehicles: Vehicle[] = [];
  let signals: SignalControllerState = createInitialSignalState(initialGreenDurations);
  let simTime = 0;
  let greenDurations = { ...initialGreenDurations };
  let exitedCount = 0;

  // Initialize vehicles
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
      // Step signals
      signals = stepSignalController(signals, dt, greenDurations);

      // Step vehicles
      const before = vehicles.filter(v => !v.exited).length;
      vehicles = stepVehicles(vehicles, signals, dt);
      const after = vehicles.filter(v => !v.exited).length;

      // Count newly exited
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
      signals = createInitialSignalState(greenDurations);
      resetVehicleCounter();
      initVehicles(demand);
      return engine.snapshot();
    },

    setGreenDurations(durations: GreenDurations): void {
      greenDurations = { ...durations };
    },
  };

  return engine;
}
