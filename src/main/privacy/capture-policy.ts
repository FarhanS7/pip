/**
 * Capture Policy & Disclosure (Task B25)
 *
 * Controls whether screen capture is allowed, paused, or blocked.
 * Provides disclosure state for UI indicators.
 */

import { createLogger } from '../logger'

const log = createLogger('capture-policy')

export type CaptureState = 'active' | 'paused' | 'blocked'

export interface CapturePolicy {
  state: CaptureState
  reason?: string
  strictMode: boolean
}

let currentPolicy: CapturePolicy = {
  state: 'active',
  strictMode: false
}

const listeners = new Set<(policy: CapturePolicy) => void>()

/**
 * Get the current capture policy state.
 */
export function getCapturePolicy(): Readonly<CapturePolicy> {
  return { ...currentPolicy }
}

/**
 * Pause screen capture (e.g., user manually pauses or lock screen detected).
 */
export function pauseCapture(reason: string): void {
  if (currentPolicy.state === 'blocked') return
  log.info('Screen capture paused', { reason })
  currentPolicy = { ...currentPolicy, state: 'paused', reason }
  notifyListeners()
}

/**
 * Resume screen capture.
 */
export function resumeCapture(): void {
  if (currentPolicy.state === 'blocked') return
  log.info('Screen capture resumed')
  currentPolicy = { ...currentPolicy, state: 'active', reason: undefined }
  notifyListeners()
}

/**
 * Block screen capture entirely (e.g., protection cannot be established in strict mode).
 */
export function blockCapture(reason: string): void {
  log.warn('Screen capture blocked', { reason })
  currentPolicy = { ...currentPolicy, state: 'blocked', reason }
  notifyListeners()
}

/**
 * Enable or disable strict mode.
 * In strict mode, capture is blocked if protection cannot be established.
 */
export function setStrictMode(enabled: boolean): void {
  log.info('Strict capture mode', { enabled })
  currentPolicy = { ...currentPolicy, strictMode: enabled }
  notifyListeners()
}

/**
 * Check if capture is currently permitted.
 */
export function isCaptureAllowed(): boolean {
  return currentPolicy.state === 'active'
}

/**
 * Subscribe to capture policy changes.
 */
export function onCapturePolicyChange(listener: (policy: CapturePolicy) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(): void {
  const snapshot = getCapturePolicy()
  for (const listener of listeners) {
    listener(snapshot)
  }
}
