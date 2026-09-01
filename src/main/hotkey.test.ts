import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockUIHook, mockSend } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EventEmitter = require('events').EventEmitter
  const ee = new EventEmitter()
  ee.start = vi.fn()
  ee.stop = vi.fn()
  const send = vi.fn()
  return { mockUIHook: ee, mockSend: send }
})

let registeredShortcutCallback: (() => void) | null = null

vi.mock('uiohook-napi', () => ({
  uIOhook: mockUIHook,
  UiohookKey: {}
}))

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn((_shortcut: string, callback: () => void) => {
      registeredShortcutCallback = callback
      return true
    }),
    unregister: vi.fn(),
    unregisterAll: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      {
        isDestroyed: () => false,
        webContents: {
          send: mockSend
        }
      }
    ])
  }
}))

import {
  registerGlobalHotkey,
  unregisterAllHotkeys,
  isPushToTalkCurrentlyActive
} from './hotkey'
import { voiceStateMachine } from './state/voice-state-machine'

describe('Global Hotkey (Push-to-Talk)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    registeredShortcutCallback = null
    voiceStateMachine.reset()
    unregisterAllHotkeys()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers listening broadcast on hotkey press', () => {
    registerGlobalHotkey()
    expect(registeredShortcutCallback).not.toBeNull()

    registeredShortcutCallback!()
    expect(isPushToTalkCurrentlyActive()).toBe(true)
    expect(mockSend).toHaveBeenCalledWith('state:voice-changed', {
      state: 'listening',
      reason: 'hotkey-press'
    })
  })

  it('triggers processing broadcast on key release via uiohook keyup', () => {
    registerGlobalHotkey()
    registeredShortcutCallback!()

    // Simulate OS keyup event
    mockUIHook.emit('keyup', { keycode: 57 })

    expect(isPushToTalkCurrentlyActive()).toBe(false)
    expect(mockSend).toHaveBeenCalledWith('state:voice-changed', {
      state: 'processing',
      reason: 'hotkey-release'
    })
  })

  it('fires safety-net timeout after 60s if release detection fails', () => {
    registerGlobalHotkey()
    registeredShortcutCallback!()

    expect(isPushToTalkCurrentlyActive()).toBe(true)

    // Advance timers by 60 seconds
    vi.advanceTimersByTime(60000)

    expect(isPushToTalkCurrentlyActive()).toBe(false)
    expect(mockSend).toHaveBeenCalledWith('state:voice-changed', {
      state: 'processing',
      reason: 'hotkey-release'
    })
  })
})
