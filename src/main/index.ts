/**
 * Pip — Main Process Entry Point
 *
 * Initializes the Electron app as a background process (no dock icon, no taskbar).
 * Enforces single-instance lock, strict security defaults, and clean exit handling.
 *
 * References: PHASE_0_ARCHITECTURE.md §0.1 (Modular Monolith — Electron App)
 */

import { app } from 'electron'
import { createLogger } from './logger'
import { registerIpcHandlers } from './ipc/handlers'
import { createSystemTray, destroySystemTray } from './tray'
import { createPanelWindow, togglePanelWindow, showPanelWindow } from './windows/panel-window'
import { createOverlayWindows, destroyAllOverlayWindows } from './windows/overlay-window'
import { registerGlobalHotkey, unregisterAllHotkeys } from './hotkey'

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

app.whenReady().then(() => {
  log.info('App ready', { platform: process.platform, version: app.getVersion() })

  // Register all IPC handlers for renderer → main communication
  registerIpcHandlers()

  // Initialize control panel window
  createPanelWindow()

  // Initialize system tray icon with left-click toggle
  createSystemTray(() => {
    togglePanelWindow()
  })

  // Initialize overlay windows (one per monitor)
  createOverlayWindows()

  // Register global push-to-talk shortcut (CommandOrControl+Alt+Space)
  registerGlobalHotkey()
})

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit via Cmd+Q.
  // On Windows/Linux, closing all windows should not quit a tray app.
  // In both cases: do nothing — Pip lives in the tray.
})

app.on('before-quit', () => {
  log.info('App shutting down — cleaning up resources')
  unregisterAllHotkeys()
  destroyAllOverlayWindows()
  destroySystemTray()
})

// Handle second instance attempt — focus existing window
app.on('second-instance', () => {
  log.info('Second instance detected — focusing existing panel')
  showPanelWindow()
})
