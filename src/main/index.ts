/**
 * Pip — Main Process Entry Point
 *
 * Initializes the Electron app as a background process (no dock icon, no taskbar).
 * Enforces single-instance lock, strict security defaults, and clean exit handling.
 *
 * References: PHASE_0_ARCHITECTURE.md §0.1 (Modular Monolith — Electron App)
 */

import { app, powerMonitor, session, screen } from 'electron'
import { createLogger } from './logger'
import { registerIpcHandlers } from './ipc/handlers'
import { installPermissionPolicy } from './ipc/security'
import { createSystemTray, destroySystemTray } from './tray'
import { createPanelWindow, togglePanelWindow, showPanelWindow } from './windows/panel-window'
import { createOverlayWindows, destroyAllOverlayWindows } from './windows/overlay-window'
import { registerGlobalHotkey, unregisterAllHotkeys, prepareHotkeyChange } from './hotkey'
import { initOrchestrator, destroyOrchestrator } from './orchestrator'
import { createMediaWindow, destroyMediaWindow } from './windows/media-window'
import { voiceStateMachine } from './state/voice-state-machine'
import { initSettingsStore, getSettings, setSettingsEffect, reportSettingsNotice } from './state/settings'
import { pauseCapture, resumeCapture } from './privacy/capture-policy'

const log = createLogger('shell')

// ── Single Instance Lock ─────────────────────────────────────────────────
// Prevent multiple instances of the app from running simultaneously.
// If a second instance is launched, it will quit and focus the first.
const hasInstanceLock = app.requestSingleInstanceLock()

if (!hasInstanceLock) {
  log.warn('Another instance is already running — quitting')
  app.quit()
}

// ── App Configuration ────────────────────────────────────────────────────
// Hide from dock (macOS) and taskbar (Windows) — Pip lives in the system tray only.
if (process.platform === 'darwin') {
  app.dock?.hide()
}

// ── App Lifecycle ────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info('App ready', { platform: process.platform, version: app.getVersion() })

  installPermissionPolicy(session.defaultSession)

  // Register all IPC handlers for renderer → main communication
  await initSettingsStore()
  if (!registerGlobalHotkey(getSettings().pushToTalkHotkey)) {
    reportSettingsNotice('Saved shortcut is unavailable. Choose another shortcut in Settings; the panel voice button is still available.')
  }
  setSettingsEffect(next => prepareHotkeyChange(next.pushToTalkHotkey))
  registerIpcHandlers()
  createMediaWindow()
  voiceStateMachine.onStateChange(state => {
    if (state === 'listening') createMediaWindow()
  })

  // Initialize central orchestrator pipeline
  initOrchestrator()

  // Initialize control panel window and show it on startup
  createPanelWindow()
  showPanelWindow()

  // Initialize system tray icon with left-click toggle
  createSystemTray(() => {
    togglePanelWindow()
  })

  // Initialize overlay windows (one per monitor)
  createOverlayWindows()

  // ── Power Monitor: pause capture on lock/suspend ──
  powerMonitor.on('suspend', () => {
    log.info('System suspending — pausing capture')
    pauseCapture('system-suspend')
  })

  powerMonitor.on('resume', () => {
    log.info('System resumed — resuming capture')
    resumeCapture()
  })

  powerMonitor.on('lock-screen', () => {
    log.info('Screen locked — pausing capture')
    pauseCapture('lock-screen')
  })

  powerMonitor.on('unlock-screen', () => {
    log.info('Screen unlocked — resuming capture')
    resumeCapture()
  })

  // ── Display Changes: reposition overlays ──
  screen.on('display-metrics-changed', () => {
    log.info('Display metrics changed — repositioning overlays')
    destroyAllOverlayWindows()
    createOverlayWindows()
  })

})

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit via Cmd+Q.
  // On Windows/Linux, closing all windows should not quit a tray app.
  // In both cases: do nothing — Pip lives in the tray.
})

app.on('before-quit', () => {
  log.info('App shutting down — cleaning up resources')
  unregisterAllHotkeys()
  destroyOrchestrator()
  destroyMediaWindow()
  destroyAllOverlayWindows()
  destroySystemTray()
})

// Handle second instance attempt — focus existing window
app.on('second-instance', () => {
  log.info('Second instance detected — focusing existing panel')
  showPanelWindow()
})
