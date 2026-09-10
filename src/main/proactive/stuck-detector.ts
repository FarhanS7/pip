/**
 * Proactive Stuck Detection & Suggestion Engine (Task B50 & B51)
 *
 * Local opt-in signals (repeated query failures, same-target interaction retries).
 * Emits non-intrusive proactive help prompts with cooldown/snooze controls.
 */

import { createLogger } from '../logger'

const log = createLogger('stuck-detector')

export interface StuckState {
  failureCount: number
  lastFailureTime: number
  snoozedUntil: number
}

const DEFAULT_COOLDOWN_MS = 60000 // 1 minute cooldown between proactive prompts
const FAILURE_THRESHOLD = 3 // Trigger after 3 consecutive failures

const state: StuckState = {
  failureCount: 0,
  lastFailureTime: 0,
  snoozedUntil: 0
}

/**
 * Record a turn or interaction failure.
 * Returns true if proactive help should be suggested to the user.
 */
export function recordInteractionFailure(reason: string): boolean {
  if (Date.now() < state.snoozedUntil) {
    log.debug('Stuck detector snoozed, ignoring failure', { reason })
    return false
  }

  state.failureCount += 1
  state.lastFailureTime = Date.now()
  log.info('Interaction failure recorded', { count: state.failureCount, reason })

  if (state.failureCount >= FAILURE_THRESHOLD) {
    // Trigger cooldown
    state.snoozedUntil = Date.now() + DEFAULT_COOLDOWN_MS
    state.failureCount = 0
    return true
  }

  return false
}

/**
 * Reset failure counter on successful interaction turn.
 */
export function recordInteractionSuccess(): void {
  state.failureCount = 0
}

/**
 * Snooze proactive suggestions for a specified duration in milliseconds.
 */
export function snoozeProactiveSuggestions(durationMs: number = DEFAULT_COOLDOWN_MS): void {
  state.snoozedUntil = Date.now() + durationMs
  state.failureCount = 0
  log.info('Proactive suggestions snoozed', { durationMs })
}

/**
 * Get current stuck detector state.
 */
export function getStuckDetectorState(): Readonly<StuckState> {
  return { ...state }
}
