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
import type { IpcMainInvokeEvent } from 'electron'
import { authorizeIpc } from './security'
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
  handle(IpcChannel.SETTINGS_GET, async () => {
    const { getSettings } = await import('../state/settings')
    log.debug('Settings requested')
    return getSettings()
  })

  handle(IpcChannel.SETTINGS_SET, async (_event, payload: unknown) => {
    const { setSetting } = await import('../state/settings')
    if (!payload || typeof payload !== 'object' || !('key' in payload) || !('value' in payload)) {
      throw new Error('Invalid settings request')
    }
    setSetting(payload.key, payload.value)
  })

  handle(IpcChannel.SETTINGS_RESET, async () => {
    const { resetSettingsToDefaults } = await import('../state/settings')
    resetSettingsToDefaults()
  })

  handle(IpcChannel.SETTINGS_NOTICE, async () => {
    const { getSettingsNotice } = await import('../state/settings')
    return getSettingsNotice()
  })

  // ── Recording / Voice State Triggers ──────────────────────────────────
  handle(IpcChannel.START_RECORDING, async () => {
    const { voiceStateMachine } = await import('../state/voice-state-machine')
    log.info('Start recording requested via IPC')
    voiceStateMachine.transitionTo('listening', 'panel-ui')
    return { success: true }
  })

  handle(IpcChannel.STOP_RECORDING, async () => {
    const { voiceStateMachine } = await import('../state/voice-state-machine')
    log.info('Stop recording requested via IPC')
    voiceStateMachine.transitionTo('processing', 'panel-ui')
    return { success: true }
  })

  handle(IpcChannel.STT_UPDATE_TRANSCRIPT, async (_event, transcript: unknown) => {
    if (typeof transcript !== 'string' || transcript.length > 16000) throw new Error('Invalid transcript')
    const { voiceStateMachine } = await import('../state/voice-state-machine')
    if (voiceStateMachine.getState() !== 'listening') throw new Error('No active recording')
    const { initOrchestrator } = await import('../orchestrator')
    const orchestrator = initOrchestrator()
    orchestrator.setUtterance(transcript)
    return { success: true }
  })

  // ── App Control ──────────────────────────────────────────────────────
  handle(IpcChannel.APP_QUIT, async () => {
    log.info('Quit requested via IPC')
    const { app } = await import('electron')
    app.quit()
  })

  handle(IpcChannel.CURSOR_TOGGLE, async (_event, visible: unknown) => {
    const { setSetting } = await import('../state/settings')
    setSetting('cursorEnabled', visible)
    return { success: true }
  })

  handle(IpcChannel.CURSOR_VISIBILITY_GET, async () => {
    const { getSetting } = await import('../state/settings')
    return getSetting('cursorEnabled')
  })

  // ── Permissions ──────────────────────────────────────────────────────
  handle(IpcChannel.PERMISSIONS_GET, async () => {
    // TODO: H.5 — Check actual OS permission statuses
    log.debug('Permission status requested')
    return {
      microphone: 'unknown',
      accessibility: 'unknown',
      screenCapture: 'unknown'
    }
  })

  handle(IpcChannel.PERMISSIONS_REQUEST, async (_event, permissionType: unknown) => {
    if (typeof permissionType !== 'string' || !['microphone', 'accessibility', 'screenCapture'].includes(permissionType)) throw new Error('Invalid permission type')
    // TODO: H.5 — Trigger OS permission dialog
    log.debug('Permission request', { permissionType })
    return { success: false, reason: 'Not yet implemented' }
  })

  log.info('IPC handlers registered', {
    handlerCount: Object.keys(IpcChannel).length
  })
}

function handle(channel: IpcChannel, handler: (event: IpcMainInvokeEvent, payload?: unknown) => Promise<unknown>): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    authorizeIpc(event, channel)
    if (args.length > 1) throw new Error('Unexpected IPC arguments')
    return handler(event, args[0])
  })
}
