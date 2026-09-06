/**
 * Global Hotkey Registration
 *
 * Registers a system-wide push-to-talk hotkey (default: CommandOrControl+Alt+Space).
 * Triggers voice state machine transitions on key-press and key-release.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/shell module)
 *   PHASE_1_MODULES_AND_TASKS.md A.5 scoped checklist
 *
 * Choice of key release detector:
 *   uiohook-napi is a maintained, cross-platform (Windows & macOS) N-API native keyboard hook library.
 *   Electron's globalShortcut only supports key-down events, so uiohook-napi is used to detect
 *   global OS-level keyup events for push-to-talk release without hand-rolling C++ native addons.
 */

import { globalShortcut } from 'electron'
import { uIOhook } from 'uiohook-napi'
import { voiceStateMachine } from './state/voice-state-machine'
import { createLogger } from './logger'

const log = createLogger('hotkey')

const DEFAULT_HOTKEY = 'CommandOrControl+Alt+Space'
let activeHotkey: string | null = null

export interface HotkeyChange { commit(): void; rollback(): void }

/** Reserve the new chord while retaining the old one until settings are saved. */
export function prepareHotkeyChange(hotkey: string): HotkeyChange {
  if (hotkey === activeHotkey) return { commit() {}, rollback() {} }
  if (voiceStateMachine.getState() !== 'idle') throw new Error('Finish the current voice turn before changing shortcuts')
  const previous = activeHotkey
  const registered = globalShortcut.register(hotkey, () => {
    if (activeHotkey === hotkey && !isPushToTalkActive && ['idle', 'responding'].includes(voiceStateMachine.getState())) {
      isPushToTalkActive = true
      voiceStateMachine.transitionTo('listening', 'hotkey-press')
      startReleaseDetection(hotkey)
    }
  })
  if (!registered) throw new Error('Shortcut is unavailable')
  return {
    commit() {
      activeHotkey = hotkey
      if (previous) globalShortcut.unregister(previous)
    },
    rollback() { globalShortcut.unregister(hotkey) }
  }
}

/** Tracks whether the push-to-talk key is currently held down */
let isPushToTalkActive = false

/** Keyup listener reference for clean removal */
let onKeyUpListener: ((event: unknown) => void) | null = null

/** 60-second safety-net fallback timeout ID */
let safetyNetTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Register the global push-to-talk hotkey.
 *
 * @param hotkey - The accelerator string (e.g. 'CommandOrControl+Alt+Space'). Defaults to DEFAULT_HOTKEY.
 * @returns true if registration succeeded, false if the shortcut was already taken
 */
export function registerGlobalHotkey(hotkey: string = DEFAULT_HOTKEY): boolean {
  try {
    prepareHotkeyChange(hotkey).commit()
    return true
  } catch (error) {
    log.error('Failed to register global hotkey', {
      hotkey,
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

/**
 * Unregister the global hotkey. Called on app quit.
 */
export function unregisterGlobalHotkey(hotkey: string = DEFAULT_HOTKEY): void {
  globalShortcut.unregister(hotkey)
  if (activeHotkey === hotkey) activeHotkey = null
  stopReleaseDetection()
  if (isPushToTalkActive) {
    isPushToTalkActive = false
    voiceStateMachine.reset('hotkey-unregistered')
  }
  log.info('Global hotkey unregistered', { hotkey })
}

/**
 * Unregister all global shortcuts. Called on app quit.
 */
export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
  activeHotkey = null
  stopReleaseDetection()
  if (isPushToTalkActive) {
    isPushToTalkActive = false
    voiceStateMachine.reset('hotkey-unregistered')
  }
  log.info('All global hotkeys unregistered')
}

/**
 * Detect global key release using uiohook-napi OS-level keyup events.
 * Includes a 60-second safety-net fallback timeout in case keyup drops.
 */
function startReleaseDetection(_hotkey: string): void {
  stopReleaseDetection()

  onKeyUpListener = (_event: unknown) => {
    if (isPushToTalkActive) {
      handleKeyRelease()
    }
  }

  uIOhook.on('keyup', onKeyUpListener)
  try {
    uIOhook.start()
  } catch {
    // Ignore if uIOhook event loop is already active
  }

  // Safety-net fallback timeout: auto-release after 60 seconds if release detection fails
  safetyNetTimeout = setTimeout(() => {
    if (isPushToTalkActive) {
      log.warn('Push-to-talk safety-net fallback timeout reached (60s)')
      handleKeyRelease()
    }
  }, 60000)
}

function stopReleaseDetection(): void {
  if (onKeyUpListener) {
    uIOhook.off('keyup', onKeyUpListener)
    onKeyUpListener = null
  }
  if (safetyNetTimeout) {
    clearTimeout(safetyNetTimeout)
    safetyNetTimeout = null
  }
}

/**
 * Handle the push-to-talk key being released.
 */
function handleKeyRelease(): void {
  if (!isPushToTalkActive) return

  isPushToTalkActive = false
  stopReleaseDetection()

  log.info('Push-to-talk deactivated')

  // Transition voice state machine to processing
  voiceStateMachine.transitionTo('processing', 'hotkey-release')
}

/**
 * Manually trigger a push-to-talk release.
 * Used by the panel UI's push-to-talk button (as alternative to hotkey).
 */
export function triggerPushToTalkRelease(): void {
  handleKeyRelease()
}

/**
 * Check if push-to-talk is currently active.
 */
export function isPushToTalkCurrentlyActive(): boolean {
  return isPushToTalkActive
}
