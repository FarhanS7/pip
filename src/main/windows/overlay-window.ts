/**
 * Transparent Overlay Window
 *
 * Creates full-screen transparent, click-through windows — one per monitor.
 * Hosts the cursor buddy, waveform visualizer, speech bubble, and element highlights.
 *
 * References:
 *   PHASE_1_MODULES_AND_TASKS.md A.4 scoped checklist
 *   Gotcha: Windows setIgnoreMouseEvents behavior differs across Win 10/11 GPU drivers
 */

import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { createLogger } from '../logger'

const log = createLogger('overlay-window')

/** Map of display ID → overlay BrowserWindow */
const overlayWindows = new Map<number, BrowserWindow>()

/**
 * Create overlay windows for all connected displays.
 * Each overlay is a full-screen, transparent, click-through window.
 */
export function createOverlayWindows(): void {
  const displays = screen.getAllDisplays()

  for (const display of displays) {
    createOverlayForDisplay(display)
  }

  // Listen for display changes (monitors added/removed)
  screen.on('display-added', (_event, newDisplay) => {
    log.info('Display added — creating overlay', { displayId: newDisplay.id })
    createOverlayForDisplay(newDisplay)
  })

  screen.on('display-removed', (_event, oldDisplay) => {
    log.info('Display removed — destroying overlay', { displayId: oldDisplay.id })
    destroyOverlayForDisplay(oldDisplay.id)
  })

  log.info('Overlay windows created', { displayCount: displays.length })
}

/**
 * Create a single overlay window for a specific display.
 */
function createOverlayForDisplay(display: Electron.Display): BrowserWindow {
  const { x, y, width, height } = display.bounds

  const overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: true,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Make the window click-through — mouse events pass to windows below
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  // Prevent the overlay from appearing in the taskbar or Alt+Tab
  overlayWindow.setSkipTaskbar(true)

  // On macOS: join all Spaces so the overlay follows the user
  if (process.platform === 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  // Set the highest z-order level
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  // Load the overlay renderer HTML
  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay/index.html`)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindows.delete(display.id)
  })

  overlayWindows.set(display.id, overlayWindow)

  log.debug('Overlay created for display', {
    displayId: display.id,
    bounds: { x, y, width, height }
  })

  return overlayWindow
}

/**
 * Destroy the overlay window for a specific display.
 */
function destroyOverlayForDisplay(displayId: number): void {
  const overlayWindow = overlayWindows.get(displayId)
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
    overlayWindows.delete(displayId)
    log.debug('Overlay destroyed for display', { displayId })
  }
}

/**
 * Destroy all overlay windows. Called on app quit.
 */
export function destroyAllOverlayWindows(): void {
  for (const [displayId, overlayWindow] of overlayWindows) {
    if (!overlayWindow.isDestroyed()) {
      overlayWindow.close()
    }
    log.debug('Overlay destroyed', { displayId })
  }
  overlayWindows.clear()
  log.info('All overlay windows destroyed')
}

/**
 * Get the overlay window for a specific screen index (0-based).
 * Falls back to the primary display's overlay if index is out of range.
 */
export function getOverlayWindow(screenIndex: number): BrowserWindow | null {
  const displays = screen.getAllDisplays()
  const targetDisplay = displays[screenIndex] ?? displays[0]

  if (!targetDisplay) return null

  const overlay = overlayWindows.get(targetDisplay.id)
  return overlay && !overlay.isDestroyed() ? overlay : null
}

/**
 * Get all overlay windows (for broadcasting IPC messages).
 */
export function getAllOverlayWindows(): BrowserWindow[] {
  const windows: BrowserWindow[] = []
  for (const win of overlayWindows.values()) {
    if (!win.isDestroyed()) {
      windows.push(win)
    }
  }
  return windows
}
