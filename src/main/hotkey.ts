/**
 * Global Hotkey Registration
 *
 * Registers a system-wide push-to-talk hotkey (default: CommandOrControl+Alt+Space).
 * Emits key-down and key-up events via IPC to the central state machine.
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

import { globalShortcut, BrowserWindow } from 'electron'
import { uIOhook } from 'uiohook-napi'
import { IpcChannel } from './ipc/channels'
import { createLogger } from './logger'

const log = createLogger('hotkey')

const DEFAULT_HOTKEY = 'CommandOrControl+Alt+Space'

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
    const registered = globalShortcut.register(hotkey, () => {
      if (!isPushToTalkActive) {
        isPushToTalkActive = true
        log.info('Push-to-talk activated', { hotkey })

        // Notify all renderer windows that recording should start
        broadcastToAllWindows(IpcChannel.VOICE_STATE_CHANGED, {
          state: 'listening',
          reason: 'hotkey-press'
        })

        // Start listening for key release
        startReleaseDetection(hotkey)
      }
    })

    if (registered) {
      log.info('Global hotkey registered successfully', { hotkey })
    } else {
      log.warn('Global hotkey registration returned false — shortcut may be taken', { hotkey })
    }

    return registered
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
  stopReleaseDetection()
  isPushToTalkActive = false
  log.info('Global hotkey unregistered', { hotkey })
}

/**
 * Unregister all global shortcuts. Called on app quit.
 */
export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
  stopReleaseDetection()
  isPushToTalkActive = false
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

  broadcastToAllWindows(IpcChannel.VOICE_STATE_CHANGED, {
    state: 'processing',
    reason: 'hotkey-release'
  })
}

/**
 * Broadcast an IPC message to all open BrowserWindows.
 */
function broadcastToAllWindows(channel: string, payload: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
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
