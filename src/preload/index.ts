/**
 * Preload Script
 *
 * Exposes a safe API surface to renderer processes via contextBridge.
 * No raw ipcRenderer is ever exposed — only typed invoke/on/off wrappers.
 *
 * References: PHASE_0_ARCHITECTURE.md §0.4 (IPC Communication Pattern)
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '../shared/channels'
import type { IpcEventPayloads } from '../shared/types/ipc'
import type { PipAPI } from '../shared/types/pip-api'

function subscribe<C extends keyof IpcEventPayloads>(
  channel: C,
  callback: (payload: IpcEventPayloads[C]) => void
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: IpcEventPayloads[C]) => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const pipAPI: PipAPI = {
  submitText: text => ipcRenderer.invoke(IpcChannel.SUBMIT_TEXT, text),
  finishBrowserRecognition: (text, turnId) => ipcRenderer.invoke(IpcChannel.BROWSER_TRANSCRIPT_FINAL, { text, turnId }),
  sendAudio: (turnId, sequence, buffer) => ipcRenderer.invoke(IpcChannel.MEDIA_AUDIO_CHUNK, { turnId, sequence, buffer }),
  audioStopped: (turnId) => ipcRenderer.invoke(IpcChannel.MEDIA_AUDIO_STOPPED, turnId),
  reportAudioFailure: (turnId) => ipcRenderer.invoke(IpcChannel.MEDIA_AUDIO_FAILED, turnId),
  mediaReady: () => ipcRenderer.invoke(IpcChannel.MEDIA_READY),
  reportPlayback: (requestId, status) => ipcRenderer.invoke(IpcChannel.MEDIA_PLAYBACK_RESULT, { requestId, status }),
  updateTranscript: (text, turnId) => ipcRenderer.invoke(IpcChannel.STT_UPDATE_TRANSCRIPT, { text, turnId }),
  onSpeak: (callback) => subscribe(IpcChannel.TTS_SPEAK, callback),
  onStopSpeaking: (callback) => subscribe(IpcChannel.TTS_STOP, callback),
  getSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_GET),
  getSettingsNotice: () => ipcRenderer.invoke(IpcChannel.SETTINGS_NOTICE),
  setSetting: (key, value) => ipcRenderer.invoke(IpcChannel.SETTINGS_SET, { key, value }),
  resetSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_RESET),
  onSettingsChanged: (callback) => subscribe(IpcChannel.SETTINGS_CHANGED, callback),
  onVoiceStateChanged: (callback) => subscribe(IpcChannel.VOICE_STATE_CHANGED, callback),
  triggerPushToTalkPress: () => ipcRenderer.invoke(IpcChannel.START_RECORDING),
  triggerPushToTalkRelease: () => ipcRenderer.invoke(IpcChannel.STOP_RECORDING),
  cancelTurn: () => ipcRenderer.invoke(IpcChannel.CANCEL_TURN),
  onPowerLevelChanged: (callback) => subscribe(IpcChannel.AUDIO_POWER_LEVEL, callback),
  onPointDetected: (callback) => subscribe(IpcChannel.CURSOR_POSITION, callback),
  onTextChunk: (callback) => subscribe(IpcChannel.AI_RESPONSE_CHUNK, callback),

  // Permissions & Onboarding (Task B26)
  getPermissions: () => ipcRenderer.invoke(IpcChannel.PERMISSIONS_GET),
  requestPermission: (permissionType) => ipcRenderer.invoke(IpcChannel.PERMISSIONS_REQUEST, permissionType),
  completeOnboarding: () => ipcRenderer.invoke(IpcChannel.ONBOARDING_COMPLETE),

  // Diagnostics & Privacy (Task B28)
  collectDiagnostics: () => ipcRenderer.invoke(IpcChannel.DIAGNOSTICS_COLLECT),
  getCapturePolicy: () => ipcRenderer.invoke(IpcChannel.CAPTURE_POLICY_GET),
  pauseCapture: () => ipcRenderer.invoke(IpcChannel.CAPTURE_PAUSE),
  resumeCapture: () => ipcRenderer.invoke(IpcChannel.CAPTURE_RESUME)
}

contextBridge.exposeInMainWorld('pipAPI', pipAPI)
