/**
 * System Tray
 *
 * Creates and manages the system tray icon and context menu.
 * Left-click toggles the control panel. Right-click shows a context menu.
 *
 * References:
 *   PHASE_1_MODULES_AND_TASKS.md A.2 scoped checklist
 *   Gotcha: Windows tray icons can linger on crash if not explicitly destroyed
 */

import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'
import { createLogger } from './logger'

const log = createLogger('tray')

let tray: Tray | null = null

/** Callback for when the tray icon is left-clicked (toggle panel) */
type TrayClickCallback = () => void

/**
 * Create and initialize the system tray icon.
 *
 * @param onTogglePanel - Callback fired on left-click to toggle control panel
 * @returns The created Tray instance
 */
export function createSystemTray(onTogglePanel: TrayClickCallback): Tray {
  // Build the tray icon from resources
  // On macOS: use template images (trayTemplate.png / trayTemplate@2x.png)
  // On Windows: use .ico format
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, '../../resources/trayTemplate.png')
    : path.join(__dirname, '../../resources/tray.ico')

  // Create a simple 16x16 icon programmatically as fallback
  // (will be replaced by real icons from resources/ in production)
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      throw new Error('Icon file is empty or not found')
    }
  } catch {
    log.warn('Tray icon not found, using fallback', { iconPath })
    // Create a minimal 16x16 blue circle as fallback
    icon = nativeImage.createFromBuffer(createFallbackIconBuffer())
    icon = icon.resize({ width: 16, height: 16 })
  }

  // Mark as template on macOS (auto-adapts to dark/light menu bar)
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip('Pip — AI Screen Companion')

  // Left-click: toggle the control panel
  tray.on('click', () => {
    log.debug('Tray icon clicked')
    onTogglePanel()
  })

  // Right-click: show context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Panel',
      click: () => onTogglePanel()
    },
    { type: 'separator' },
    {
      label: 'About Pip',
      click: () => {
        log.info('About dialog requested')
        // TODO: Show about dialog
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Pip',
      click: () => {
        log.info('Quit requested from tray menu')
        app.quit()
      }
    }
  ])

  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu)
  })

  log.info('System tray created successfully')
  return tray
}

/**
 * Destroy the system tray icon.
 * Must be called on app exit to prevent lingering icons on Windows.
 */
export function destroySystemTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
    log.info('System tray destroyed')
  }
}

/**
 * Get the bounds of the tray icon (for positioning the panel window).
 */
export function getTrayBounds(): Electron.Rectangle | null {
  return tray?.getBounds() ?? null
}

/**
 * Create a minimal fallback icon buffer (16x16 blue PNG).
 * Used when the actual icon files haven't been added yet.
 */
function createFallbackIconBuffer(): Buffer {
  // Minimal 16x16 blue PNG — a single-pixel repeated pattern
  // This is a valid PNG file that renders as a blue square
  const width = 16
  const height = 16
  const channels = 4 // RGBA

  // Create raw RGBA pixel data: blue with full opacity
  const pixels = Buffer.alloc(width * height * channels)
  for (let i = 0; i < width * height; i++) {
    pixels[i * channels + 0] = 79   // R
    pixels[i * channels + 1] = 139  // G
    pixels[i * channels + 2] = 255  // B
    pixels[i * channels + 3] = 255  // A
  }

  return pixels
}
