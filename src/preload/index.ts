/**
 * Preload Script
 *
 * Exposes a safe API surface to renderer processes via contextBridge.
 * No raw ipcRenderer is ever exposed — only typed invoke/on/off wrappers.
 *
 * References: PHASE_0_ARCHITECTURE.md §0.4 (IPC Communication Pattern)
 */

import { contextBridge, ipcRenderer } from 'electron'

// Expose a minimal, typed API to renderer processes.
// This is the ONLY bridge between renderer and main process.
contextBridge.exposeInMainWorld('pip', {
  /**
   * Send a request to main process and await a response (renderer → main).
   * Uses ipcRenderer.invoke which returns a Promise.
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },

  /**
   * Subscribe to events from main process (main → renderer).
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    // Wrap the callback to strip the event object — renderers don't need it
    const wrappedCallback = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    ipcRenderer.on(channel, wrappedCallback)
  },

  /**
   * Unsubscribe from main process events.
   */
  off: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback as never)
  }
})
