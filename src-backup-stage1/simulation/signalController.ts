// ============================================================
// signalController.ts — Signal state machine
// ============================================================

import type { ApproachId, SignalControllerState, GreenDurations } from './types';
import {
  APPROACH_ORDER,
  YELLOW_DURATION,
  ALLRED_DURATION,
  DEFAULT_GREEN_DURATIONS,
} from './constants';

/**
 * Creates the initial signal controller state.
 * North starts green.
 */
export function createInitialSignalState(
  greenDurations: GreenDurations = DEFAULT_GREEN_DURATIONS
): SignalControllerState {
  const activeApproach: ApproachId = 'north';
  return {
    activeApproach,
    phase: 'green',
    phaseTimer: greenDurations[activeApproach],
    signals: {
      north: { approach: 'north', color: 'green', countdown: greenDurations['north'] },
      east:  { approach: 'east',  color: 'red',   countdown: 0 },
      south: { approach: 'south', color: 'red',   countdown: 0 },
      west:  { approach: 'west',  color: 'red',   countdown: 0 },
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
  greenDurations: GreenDurations
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
  const currentIdx = APPROACH_ORDER.indexOf(activeApproach);
  const nextApproach = APPROACH_ORDER[(currentIdx + 1) % APPROACH_ORDER.length];
  const nextGreenDuration = greenDurations[nextApproach];

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
