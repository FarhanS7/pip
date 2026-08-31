import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron BrowserWindow
vi.mock('electron', () => {
  return {
    BrowserWindow: {
      getAllWindows: vi.fn(() => [])
    }
  }
})

import { VoiceStateMachine } from './voice-state-machine'

describe('VoiceStateMachine', () => {
  let sm: VoiceStateMachine

  beforeEach(() => {
    sm = new VoiceStateMachine()
  })

  it('starts in idle state', () => {
    expect(sm.getState()).toBe('idle')
  })

  it('executes valid full flow idle -> listening -> processing -> responding -> idle', () => {
    sm.transitionTo('listening', 'hotkey-press')
    expect(sm.getState()).toBe('listening')

    sm.transitionTo('processing', 'hotkey-release')
    expect(sm.getState()).toBe('processing')

    sm.transitionTo('responding', 'ai-stream-start')
    expect(sm.getState()).toBe('responding')

    sm.transitionTo('idle', 'tts-ended')
    expect(sm.getState()).toBe('idle')
  })

  it('blocks invalid transitions and throws error', () => {
    // Cannot skip from idle directly to responding
    expect(() => sm.transitionTo('responding')).toThrowError('Invalid state transition')
    expect(sm.getState()).toBe('idle')
  })

  it('allows forced reset to idle from any state', () => {
    sm.transitionTo('listening')
    sm.reset('user-cancelled')
    expect(sm.getState()).toBe('idle')
  })

  it('invokes listeners on transition', () => {
    const listener = vi.fn()
    sm.onStateChange(listener)

    sm.transitionTo('listening', 'test')
    expect(listener).toHaveBeenCalledWith('listening', 'test')
  })
})
