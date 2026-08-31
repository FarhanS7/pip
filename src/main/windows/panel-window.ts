/**
 * Control Panel Window
 *
 * Creates a frameless popup window anchored to the system tray icon.
 * Dark theme, auto-hides on blur, 320x480px.
 *
 * References:
 *   PHASE_1_MODULES_AND_TASKS.md A.3 scoped checklist
 *   Gotcha: Display scaling / DPI variation near screen edge or multi-monitor
 */

import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { createLogger } from '../logger'
import { getTrayBounds } from '../tray'

const log = createLogger('panel-window')

const PANEL_WIDTH = 320
const PANEL_HEIGHT = 480

let panelWindow: BrowserWindow | null = null

/**
 * Create the control panel window.
 * Does not show it — call showPanelWindow() to display.
 */
export function createPanelWindow(): BrowserWindow {
  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Load the panel renderer HTML
  if (process.env.ELECTRON_RENDERER_URL) {
    // Dev mode: load from Vite dev server
    panelWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/panel/index.html`)
  } else {
    // Production: load from built files
    panelWindow.loadFile(path.join(__dirname, '../renderer/panel/index.html'))
  }

  // Auto-hide when the window loses focus
  panelWindow.on('blur', () => {
    hidePanelWindow()
  })

  panelWindow.on('closed', () => {
    panelWindow = null
  })

  log.info('Panel window created', { width: PANEL_WIDTH, height: PANEL_HEIGHT })
  return panelWindow
}

/**
 * Show the panel window, positioned relative to the tray icon.
 */
export function showPanelWindow(): void {
  if (!panelWindow || panelWindow.isDestroyed()) {
    log.warn('Panel window not available — creating new one')
    createPanelWindow()
  }

  positionPanelNearTray()
  panelWindow!.show()
  panelWindow!.focus()
  log.debug('Panel window shown')
}

/**
 * Hide the panel window.
 */
export function hidePanelWindow(): void {
  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
    panelWindow.hide()
    log.debug('Panel window hidden')
  }
}

/**
 * Toggle panel window visibility.
 */
export function togglePanelWindow(): void {
  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
    hidePanelWindow()
  } else {
    showPanelWindow()
  }
}

/**
 * Position the panel window near the tray icon.
 * Handles different tray positions (top/bottom of screen, left/right edge).
 */
function positionPanelNearTray(): void {
  if (!panelWindow) return

  const trayBounds = getTrayBounds()
  if (!trayBounds) {
    log.warn('Could not get tray bounds — centering panel')
    panelWindow.center()
    return
  }

  // Get the display that contains the tray icon
  const trayDisplay = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  })

  const displayBounds = trayDisplay.workArea
  const panelBounds = panelWindow.getBounds()

  // Calculate X: center horizontally on the tray icon, clamped to screen edges
  let panelX = Math.round(trayBounds.x + (trayBounds.width / 2) - (panelBounds.width / 2))
  panelX = Math.max(displayBounds.x, Math.min(panelX, displayBounds.x + displayBounds.width - panelBounds.width))

  // Calculate Y: position below or above the tray depending on tray location
  let panelY: number
  const trayIsAtTop = trayBounds.y < displayBounds.y + (displayBounds.height / 2)

  if (trayIsAtTop) {
    // Tray is near top — position panel below
    panelY = trayBounds.y + trayBounds.height + 4
  } else {
    // Tray is near bottom (Windows default) — position panel above
    panelY = trayBounds.y - panelBounds.height - 4
  }

  // Clamp Y to display bounds
  panelY = Math.max(displayBounds.y, Math.min(panelY, displayBounds.y + displayBounds.height - panelBounds.height))

  panelWindow.setPosition(panelX, panelY)
  log.debug('Panel positioned near tray', { panelX, panelY, trayIsAtTop })
}

/**
 * Get the panel window instance (for IPC broadcasting).
 */
export function getPanelWindow(): BrowserWindow | null {
  return panelWindow && !panelWindow.isDestroyed() ? panelWindow : null
}
