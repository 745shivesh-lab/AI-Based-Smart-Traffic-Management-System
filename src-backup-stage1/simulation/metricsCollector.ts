// ============================================================
// metricsCollector.ts — Compute dashboard metrics from sim state
// ============================================================
// FIXED:
//  - avgWaitTime now divides by vehicles that have actually accumulated
//    wait time (waitTime > 0), not the total generated count.
//    This prevents the average being diluted by vehicles that haven't
//    yet entered the queue.
//  - waitTime accumulation: vehicles blocked by gap on red now also
//    counted (handled in vehicleManager via stopped flag).

import type { Vehicle, ApproachId, SignalControllerState, SimMetrics } from './types';
import { APPROACHES } from './types';

export function collectMetrics(
  vehicles: Vehicle[],
  signals: SignalControllerState,
  simTime: number,
  exitedCount: number
): SimMetrics {
  const activeVehicles = vehicles.filter(v => !v.exited);
  const waiting = activeVehicles.filter(v => v.stopped);

  // Queue length = vehicles stopped per approach
  const queueLengths: Record<ApproachId, number> = {
    north: 0, east: 0, south: 0, west: 0,
  };
  for (const a of APPROACHES) {
    queueLengths[a] = activeVehicles.filter(v => v.approach === a && v.stopped).length;
  }

  // Total accumulated wait time across all vehicles (including exited)
  const totalWaitTime = vehicles.reduce((s, v) => s + v.waitTime, 0);

  // Average wait time: only count vehicles that have ever waited
  const waitedVehicles = vehicles.filter(v => v.waitTime > 0);
  const avgWaitTime = waitedVehicles.length > 0
    ? totalWaitTime / waitedVehicles.length
    : 0;

  const throughputPerMin = simTime > 0 ? (exitedCount / simTime) * 60 : 0;

  return {
    totalGenerated:   vehicles.length,
    currentWaiting:   waiting.length,
    totalExited:      exitedCount,
    queueLengths,
    avgWaitTime,
    totalWaitTime,
    throughputPerMin,
    simTimeElapsed:   simTime,
    activeSignal:     signals.activeApproach,
    signalPhase:      signals.phase,
    countdown:        signals.phaseTimer,
  };
}
