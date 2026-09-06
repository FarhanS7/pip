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

// Dev-only Reticle IPC observer hook
if (process.env.NODE_ENV === 'development') {
  const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer)
  ipcRenderer.invoke = (channel: string, ...args: unknown[]) => {
    console.debug(`[reticle-ipc] ipc://${channel}`, { args })
    return rawInvoke(channel, ...args)
  }
}

function subscribe<C extends keyof IpcEventPayloads>(
  channel: C,
  callback: (payload: IpcEventPayloads[C]) => void
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: IpcEventPayloads[C]) => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const pipAPI: PipAPI = {
  getSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_GET),
  setSetting: (key, value) => ipcRenderer.invoke(IpcChannel.SETTINGS_SET, { key, value }),
  resetSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_SET, { key: 'reset', value: true }),
  onSettingsChanged: (callback) => subscribe(IpcChannel.SETTINGS_CHANGED, callback),
  onVoiceStateChanged: (callback) => subscribe(IpcChannel.VOICE_STATE_CHANGED, callback),
  triggerPushToTalkPress: () => ipcRenderer.invoke(IpcChannel.START_RECORDING),
  triggerPushToTalkRelease: () => ipcRenderer.invoke(IpcChannel.STOP_RECORDING),
  onPowerLevelChanged: (callback) => subscribe(IpcChannel.AUDIO_POWER_LEVEL, callback),
  onPointDetected: (callback) => subscribe(IpcChannel.CURSOR_POSITION, callback),
  onTextChunk: (callback) => subscribe(IpcChannel.AI_RESPONSE_CHUNK, callback)
}
contextBridge.exposeInMainWorld('pipAPI', pipAPI)
contextBridge.exposeInMainWorld('pip', {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    ipcRenderer.on(channel, wrappedCallback)
  },
  off: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback as never)
  }
})

