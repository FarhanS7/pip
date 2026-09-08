import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordInteractionFailure,
  recordInteractionSuccess,
  snoozeProactiveSuggestions,
  getStuckDetectorState
} from './stuck-detector'

describe('Proactive Stuck Detector Engine (Task B50 & B51)', () => {
  beforeEach(() => {
    recordInteractionSuccess()
  })

  it('triggers proactive help after failure threshold is reached', () => {
    expect(recordInteractionFailure('stt-error')).toBe(false)
    expect(recordInteractionFailure('stt-error')).toBe(false)
    expect(recordInteractionFailure('stt-error')).toBe(true) // 3rd failure triggers suggestion
  })

  it('resets failure count on success', () => {
    recordInteractionFailure('turn-error')
    recordInteractionFailure('turn-error')
    recordInteractionSuccess()

    expect(getStuckDetectorState().failureCount).toBe(0)
    expect(recordInteractionFailure('turn-error')).toBe(false)
  })

  it('respects snooze duration', () => {
    snoozeProactiveSuggestions(60000)
    expect(recordInteractionFailure('stt-error')).toBe(false)
    expect(recordInteractionFailure('stt-error')).toBe(false)
    expect(recordInteractionFailure('stt-error')).toBe(false)
  })
})
