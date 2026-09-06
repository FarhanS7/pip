import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockUIHook, mockSend } = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  const ee = Object.assign(new EventEmitter(), { start: vi.fn(), stop: vi.fn() })
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
  prepareHotkeyChange,
  unregisterAllHotkeys,
  isPushToTalkCurrentlyActive
} from './hotkey'
import { voiceStateMachine } from './state/voice-state-machine'
import { globalShortcut } from 'electron'

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
      reason: 'hotkey-press', turnId: expect.any(Number)
    })
  })

  it('keeps the working shortcut when a replacement is unavailable', () => {
    registerGlobalHotkey('Alt+Space')
    const oldCallback = registeredShortcutCallback!
    vi.mocked(globalShortcut.register).mockReturnValueOnce(false)
    expect(() => prepareHotkeyChange('Alt+X')).toThrow('unavailable')
    expect(globalShortcut.unregister).not.toHaveBeenCalled()
    oldCallback()
    expect(isPushToTalkCurrentlyActive()).toBe(true)
  })

  it('reserves a new shortcut and only releases the old chord after commit', () => {
    registerGlobalHotkey('Alt+Space')
    const oldCallback = registeredShortcutCallback!
    const change = prepareHotkeyChange('Alt+X')
    const nextCallback = registeredShortcutCallback!
    nextCallback()
    expect(isPushToTalkCurrentlyActive()).toBe(false)
    expect(globalShortcut.unregister).not.toHaveBeenCalled()
    change.commit()
    expect(globalShortcut.unregister).toHaveBeenCalledWith('Alt+Space')
    oldCallback()
    expect(isPushToTalkCurrentlyActive()).toBe(false)
    nextCallback()
    expect(isPushToTalkCurrentlyActive()).toBe(true)
  })

  it('rolls back a reservation without unregistering the working chord', () => {
    registerGlobalHotkey('Alt+Space')
    const oldCallback = registeredShortcutCallback!
    prepareHotkeyChange('Alt+X').rollback()
    expect(globalShortcut.unregister).toHaveBeenCalledExactlyOnceWith('Alt+X')
    oldCallback()
    expect(isPushToTalkCurrentlyActive()).toBe(true)
  })

  it('rejects shortcut changes during a voice turn', () => {
    registerGlobalHotkey()
    registeredShortcutCallback!()
    expect(() => prepareHotkeyChange('Alt+X')).toThrow('Finish')
    expect(isPushToTalkCurrentlyActive()).toBe(true)
  })

  it('triggers processing broadcast on key release via uiohook keyup', () => {
    registerGlobalHotkey()
    registeredShortcutCallback!()

    // Simulate OS keyup event
    mockUIHook.emit('keyup', { keycode: 57 })

    expect(isPushToTalkCurrentlyActive()).toBe(false)
    expect(mockSend).toHaveBeenCalledWith('state:voice-changed', {
      state: 'processing',
      reason: 'hotkey-release', turnId: expect.any(Number)
    })
  })

  it('does not end a new panel turn when an old held shortcut is released', () => {
    registerGlobalHotkey()
    registeredShortcutCallback!()
    voiceStateMachine.reset('cancel')
    voiceStateMachine.transitionTo('listening', 'new-panel-turn')
    mockUIHook.emit('keyup', { keycode: 57 })
    expect(voiceStateMachine.getState()).toBe('listening')
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
      reason: 'hotkey-release', turnId: expect.any(Number)
    })
  })
})
