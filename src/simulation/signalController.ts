// ============================================================
// signalController.ts — Signal state machine
// ============================================================

import type { ApproachId, SignalControllerState, GreenDurations, Vehicle } from './types';
import {
  APPROACH_ORDER,
  MAX_GREEN_DURATION,
  MIN_GREEN_DURATION,
  YELLOW_DURATION,
  ALLRED_DURATION,
  DEFAULT_GREEN_DURATIONS,
  STOP_POSITIONS,
} from './constants';

function getGreenDuration(approach: ApproachId, greenDurations: GreenDurations): number {
  const duration = greenDurations[approach];
  if (!Number.isFinite(duration)) {
    throw new RangeError(`Green duration for ${approach} must be a finite number`);
  }
  return Math.min(MAX_GREEN_DURATION, Math.max(MIN_GREEN_DURATION, duration));
}

function nextInOrder(activeApproach: ApproachId): ApproachId {
  const currentIdx = APPROACH_ORDER.indexOf(activeApproach);
  return APPROACH_ORDER[(currentIdx + 1) % APPROACH_ORDER.length];
}

function chooseNextApproach(activeApproach: ApproachId, vehicles: Vehicle[]): ApproachId {
  const cyclicOrder = APPROACH_ORDER.map((_, offset) =>
    APPROACH_ORDER[(APPROACH_ORDER.indexOf(activeApproach) + offset + 1) % APPROACH_ORDER.length]
  );
  const waitingApproaches = cyclicOrder
    .map(approach => {
      const queue = vehicles.filter(vehicle =>
        !vehicle.exited &&
        vehicle.approach === approach &&
        vehicle.stopped &&
        vehicle.position < STOP_POSITIONS[approach]
      );
      return {
        approach,
        queueLength: queue.length,
        longestWait: queue.reduce((longest, vehicle) => Math.max(longest, vehicle.waitTime), 0),
      };
    })
    .filter(item => item.queueLength > 0);

  if (waitingApproaches.length === 0) return nextInOrder(activeApproach);

  waitingApproaches.sort((a, b) =>
    b.longestWait - a.longestWait || b.queueLength - a.queueLength
  );
  return waitingApproaches[0].approach;
}

/**
 * Creates the initial signal controller state.
 * The caller may choose the initial approach based on current demand.
 */
export function createInitialSignalState(
  greenDurations: GreenDurations = DEFAULT_GREEN_DURATIONS,
  initialApproach: ApproachId = 'north'
): SignalControllerState {
  const activeApproach = initialApproach;
  const initialGreenDuration = getGreenDuration(activeApproach, greenDurations);
  return {
    activeApproach,
    phase: 'green',
    phaseTimer: initialGreenDuration,
    signals: {
      north: { approach: 'north', color: activeApproach === 'north' ? 'green' : 'red', countdown: activeApproach === 'north' ? initialGreenDuration : 0 },
      east:  { approach: 'east',  color: activeApproach === 'east' ? 'green' : 'red', countdown: activeApproach === 'east' ? initialGreenDuration : 0 },
      south: { approach: 'south', color: activeApproach === 'south' ? 'green' : 'red', countdown: activeApproach === 'south' ? initialGreenDuration : 0 },
      west:  { approach: 'west',  color: activeApproach === 'west' ? 'green' : 'red', countdown: activeApproach === 'west' ? initialGreenDuration : 0 },
    },
  };
}

/**
 * Advances the signal state machine by `dt` simulation-seconds.
 * GREEN → YELLOW → ALL_RED → next approach GREEN
 * Never switches directly from one conflicting green to another.
 */
export function stepSignalController(
  state: SignalControllerState,
  dt: number,
  greenDurations: GreenDurations,
  vehicles: Vehicle[] = []
): SignalControllerState {
  let { activeApproach, phase, phaseTimer, signals } = state;
  phaseTimer -= dt;

  if (phaseTimer > 0) {
    // Still in current phase — update countdown on active signal
    const updatedSignals = { ...signals };
    updatedSignals[activeApproach] = {
      ...signals[activeApproach],
      countdown: phaseTimer,
    };
    return { activeApproach, phase, phaseTimer, signals: updatedSignals };
  }

  // Phase expired — transition
  if (phase === 'green') {
    // Green → Yellow (same approach stays active, turns yellow)
    const updatedSignals = { ...signals };
    updatedSignals[activeApproach] = {
      ...signals[activeApproach],
      color: 'yellow',
      countdown: YELLOW_DURATION,
    };
    return {
      activeApproach,
      phase: 'yellow',
      phaseTimer: YELLOW_DURATION,
      signals: updatedSignals,
    };
  }

  if (phase === 'yellow') {
    // Yellow → All-Red (all approaches go red)
    const updatedSignals: SignalControllerState['signals'] = {
      north: { approach: 'north', color: 'allred', countdown: ALLRED_DURATION },
      east:  { approach: 'east',  color: 'allred', countdown: ALLRED_DURATION },
      south: { approach: 'south', color: 'allred', countdown: ALLRED_DURATION },
      west:  { approach: 'west',  color: 'allred', countdown: ALLRED_DURATION },
    };
    return {
      activeApproach,
      phase: 'allred',
      phaseTimer: ALLRED_DURATION,
      signals: updatedSignals,
    };
  }

  // All-red → Next approach Green
  const nextApproach = chooseNextApproach(activeApproach, vehicles);
  const nextGreenDuration = getGreenDuration(nextApproach, greenDurations);

  const updatedSignals: SignalControllerState['signals'] = {
    north: { approach: 'north', color: 'red',   countdown: 0 },
    east:  { approach: 'east',  color: 'red',   countdown: 0 },
    south: { approach: 'south', color: 'red',   countdown: 0 },
    west:  { approach: 'west',  color: 'red',   countdown: 0 },
  };
  updatedSignals[nextApproach] = {
    approach: nextApproach,
    color: 'green',
    countdown: nextGreenDuration,
  };

  return {
    activeApproach: nextApproach,
    phase: 'green',
    phaseTimer: nextGreenDuration,
    signals: updatedSignals,
  };
}

/** Returns true if the given approach has a green signal */
export function isGreen(state: SignalControllerState, approach: ApproachId): boolean {
  return state.signals[approach].color === 'green';
}
