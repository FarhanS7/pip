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
  handle(IpcChannel.SUBMIT_TEXT, async (_event, text) => {
    if (typeof text !== 'string' || !text.trim() || text.length > 16000) throw new Error('Enter a request of 1 to 16000 characters')
    const { initOrchestrator } = await import('../orchestrator')
    initOrchestrator().submitText(text)
  })
  handle(IpcChannel.BROWSER_TRANSCRIPT_FINAL, async (_event, payload) => {
    if (!payload || typeof payload !== 'object' || !('text' in payload) || !('turnId' in payload) ||
        typeof payload.text !== 'string' || payload.text.length > 16000 || typeof payload.turnId !== 'number' || !Number.isSafeInteger(payload.turnId)) throw new Error('Invalid browser transcript')
    const { initOrchestrator } = await import('../orchestrator')
    initOrchestrator().finishBrowserRecognition(payload.text, payload.turnId)
  })
  handle(IpcChannel.MEDIA_AUDIO_CHUNK, async (_event, payload) => {
    if (!payload || typeof payload !== 'object' || !('turnId' in payload) || !('sequence' in payload) || !('buffer' in payload) ||
      typeof payload.turnId !== 'number' || !Number.isSafeInteger(payload.turnId) ||
      typeof payload.sequence !== 'number' || !Number.isSafeInteger(payload.sequence) || payload.sequence < 0 ||
      !(payload.buffer instanceof ArrayBuffer) || payload.buffer.byteLength < 2 || payload.buffer.byteLength > 3200 || payload.buffer.byteLength % 2) {
      throw new Error('Invalid audio chunk')
    }
    const { initOrchestrator } = await import('../orchestrator')
    await initOrchestrator().receiveAudio(payload.turnId, payload.sequence, payload.buffer)
  })
  handle(IpcChannel.MEDIA_AUDIO_STOPPED, async (_event, turnId) => {
    if (typeof turnId !== 'number' || !Number.isSafeInteger(turnId)) throw new Error('Invalid audio turn')
    const { initOrchestrator } = await import('../orchestrator')
    initOrchestrator().audioStopped(turnId)
  })
  handle(IpcChannel.MEDIA_AUDIO_FAILED, async (_event, turnId) => {
    if (typeof turnId !== 'number' || !Number.isSafeInteger(turnId)) throw new Error('Invalid audio turn')
    const { initOrchestrator } = await import('../orchestrator')
    initOrchestrator().audioFailed(turnId)
  })
  handle(IpcChannel.MEDIA_READY, async (event) => {
    const { mediaPlayback } = await import('../windows/media-window')
    const { voiceStateMachine } = await import('../state/voice-state-machine')
    mediaPlayback.markReady()
    event.sender.send(IpcChannel.VOICE_STATE_CHANGED, { state: voiceStateMachine.getState(), turnId: voiceStateMachine.getTurnId() })
  })
  handle(IpcChannel.MEDIA_PLAYBACK_RESULT, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object' || !('requestId' in payload) || !('status' in payload) ||
      typeof payload.requestId !== 'number' || !Number.isSafeInteger(payload.requestId) ||
      (payload.status !== 'ended' && payload.status !== 'error')) throw new Error('Invalid playback result')
    const { mediaPlayback } = await import('../windows/media-window')
    mediaPlayback.complete({ requestId: payload.requestId, status: payload.status })
  })
  handle(IpcChannel.CANCEL_TURN, async () => {
    const { initOrchestrator } = await import('../orchestrator')
    initOrchestrator().cancel()
  })

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
    if (voiceStateMachine.getState() === 'listening') voiceStateMachine.transitionTo('processing', 'panel-ui')
    return { success: true }
  })

  handle(IpcChannel.STT_UPDATE_TRANSCRIPT, async (_event, transcript: unknown) => {
    if (!transcript || typeof transcript !== 'object' || !('text' in transcript) || !('turnId' in transcript) ||
      typeof transcript.text !== 'string' || transcript.text.length > 16000 ||
      typeof transcript.turnId !== 'number' || !Number.isSafeInteger(transcript.turnId)) throw new Error('Invalid transcript')
    const { voiceStateMachine } = await import('../state/voice-state-machine')
    if (voiceStateMachine.getState() !== 'listening') throw new Error('No active recording')
    const { initOrchestrator } = await import('../orchestrator')
    const orchestrator = initOrchestrator()
    orchestrator.setUtterance(transcript.text, transcript.turnId)
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

  // ── Diagnostics ────────────────────────────────────────────────────
  handle(IpcChannel.DIAGNOSTICS_COLLECT, async () => {
    const { collectDiagnostics } = await import('../diagnostics')
    return collectDiagnostics()
  })

  // ── Capture Policy ─────────────────────────────────────────────────
  handle(IpcChannel.CAPTURE_POLICY_GET, async () => {
    const { getCapturePolicy } = await import('../privacy/capture-policy')
    return getCapturePolicy()
  })

  handle(IpcChannel.CAPTURE_PAUSE, async () => {
    const { pauseCapture } = await import('../privacy/capture-policy')
    pauseCapture('user-paused')
  })

  handle(IpcChannel.CAPTURE_RESUME, async () => {
    const { resumeCapture } = await import('../privacy/capture-policy')
    resumeCapture()
  })

  // ── Onboarding ─────────────────────────────────────────────────────
  handle(IpcChannel.ONBOARDING_COMPLETE, async () => {
    log.info('Onboarding completed')
    return { success: true }
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
