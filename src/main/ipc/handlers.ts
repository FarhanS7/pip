/**
 * IPC Handler Registry
 *
 * Registers all ipcMain handlers in one place.
 * Called once during app initialization from main/index.ts.
 *
 * Pattern: each handler is a thin dispatch — the real logic lives in
 * the module that owns the data (e.g. settings handlers call settings manager).
 */

import { ipcMain } from 'electron'
import { IpcChannel } from './channels'
import { createLogger } from '../logger'

const log = createLogger('ipc')

/**
 * Register all IPC handlers for renderer → main communication.
 * Must be called once after app.whenReady().
 */
export function registerIpcHandlers(): void {
  log.info('Registering IPC handlers')

  // ── Settings ─────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannel.SETTINGS_GET, async () => {
    const { getSettings } = await import('../state/settings')
    log.debug('Settings requested')
    return getSettings()
  })

  ipcMain.handle(IpcChannel.SETTINGS_SET, async (_event, payload: { key: string; value: unknown }) => {
    const { setSetting } = await import('../state/settings')
    log.debug('Setting update requested', { payload })
    if (payload && payload.key) {
      setSetting(payload.key as never, payload.value as never)
    }
    return { success: true }
  })

  // ── Recording / Voice State Triggers ──────────────────────────────────
  ipcMain.handle(IpcChannel.START_RECORDING, async () => {
    const { voiceStateMachine } = await import('../state/voice-state-machine')
    log.info('Start recording requested via IPC')
    voiceStateMachine.transitionTo('listening', 'panel-ui')
    return { success: true }
  })

  ipcMain.handle(IpcChannel.STOP_RECORDING, async () => {
    const { voiceStateMachine } = await import('../state/voice-state-machine')
    log.info('Stop recording requested via IPC')
    voiceStateMachine.transitionTo('processing', 'panel-ui')
    return { success: true }
  })

  // ── App Control ──────────────────────────────────────────────────────
  ipcMain.handle(IpcChannel.APP_QUIT, async () => {
    log.info('Quit requested via IPC')
    const { app } = await import('electron')
    app.quit()
  })

  ipcMain.handle(IpcChannel.CURSOR_TOGGLE, async (_event, visible: boolean) => {
    // TODO: A.4 — Toggle overlay window visibility
    log.debug('Cursor toggle requested', { visible })
    return { success: true }
  })

  ipcMain.handle(IpcChannel.CURSOR_VISIBILITY_GET, async () => {
    // TODO: A.4 — Return current cursor visibility
    return true
  })

  // ── Permissions ──────────────────────────────────────────────────────
  ipcMain.handle(IpcChannel.PERMISSIONS_GET, async () => {
    // TODO: H.5 — Check actual OS permission statuses
    log.debug('Permission status requested')
    return {
      microphone: 'unknown',
      accessibility: 'unknown',
      screenCapture: 'unknown'
    }
  })

  ipcMain.handle(IpcChannel.PERMISSIONS_REQUEST, async (_event, permissionType: string) => {
    // TODO: H.5 — Trigger OS permission dialog
    log.debug('Permission request', { permissionType })
    return { success: false, reason: 'Not yet implemented' }
  })

  log.info('IPC handlers registered', {
    handlerCount: Object.keys(IpcChannel).length
  })
}
