/**
 * Preload Script
 *
 * Exposes a safe API surface to renderer processes via contextBridge.
 * No raw ipcRenderer is ever exposed — only typed invoke/on/off wrappers.
 *
 * References: PHASE_0_ARCHITECTURE.md §0.4 (IPC Communication Pattern)
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '../main/ipc/channels'

// Dev-only Reticle IPC observer hook
if (process.env.NODE_ENV === 'development') {
  const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer)
  ipcRenderer.invoke = (channel: string, ...args: unknown[]) => {
    console.debug(`[reticle-ipc] ipc://${channel}`, { args })
    return rawInvoke(channel, ...args)
  }
}

const pipAPI = {
  getSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_GET),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke(IpcChannel.SETTINGS_SET, { key, value }),
  resetSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_SET, { key: 'reset', value: true }),
  onSettingsChanged: (callback: (payload: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on(IpcChannel.SETTINGS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannel.SETTINGS_CHANGED, handler)
  },

  onVoiceStateChanged: (callback: (payload: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on(IpcChannel.VOICE_STATE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IpcChannel.VOICE_STATE_CHANGED, handler)
  },
  triggerPushToTalkPress: () => ipcRenderer.invoke(IpcChannel.START_RECORDING),
  triggerPushToTalkRelease: () => ipcRenderer.invoke(IpcChannel.STOP_RECORDING),

  onPowerLevelChanged: (callback: (payload: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on(IpcChannel.AUDIO_POWER_LEVEL, handler)
    return () => ipcRenderer.removeListener(IpcChannel.AUDIO_POWER_LEVEL, handler)
  },
  onPointDetected: (callback: (payload: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on(IpcChannel.CURSOR_POSITION, handler)
    return () => ipcRenderer.removeListener(IpcChannel.CURSOR_POSITION, handler)
  },
  onTextChunk: (callback: (payload: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on(IpcChannel.AI_RESPONSE_CHUNK, handler)
    return () => ipcRenderer.removeListener(IpcChannel.AI_RESPONSE_CHUNK, handler)
  }
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

