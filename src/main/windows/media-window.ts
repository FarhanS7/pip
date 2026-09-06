import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { rendererURL, secureRenderer } from '../ipc/security'
import { IpcChannel } from '../../shared/channels'
import { PlaybackController } from '../media/playback-controller'
import { voiceStateMachine } from '../state/voice-state-machine'

let mediaWindow: BrowserWindow | null = null
export const mediaPlayback = new PlaybackController((command, payload) => {
  if (!mediaWindow || mediaWindow.isDestroyed()) throw new Error('Media renderer unavailable')
  mediaWindow.webContents.send(command === 'speak' ? IpcChannel.TTS_SPEAK : IpcChannel.TTS_STOP, payload)
})

export function createMediaWindow(): BrowserWindow {
  if (mediaWindow && !mediaWindow.isDestroyed()) return mediaWindow
  const window = new BrowserWindow({
    show: false, width: 1, height: 1, skipTaskbar: true, focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'), sandbox: true,
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
    }
  })
  mediaWindow = window
  const url = rendererURL('media')
  secureRenderer(window, 'media', url)
  let firstLoad = true
  window.webContents.on('did-start-loading', () => {
    if (firstLoad) firstLoad = false
    else mediaPlayback.disconnect()
  })
  window.webContents.on('render-process-gone', () => {
    mediaPlayback.disconnect()
    voiceStateMachine.reset('media-renderer-failed')
    window.destroy()
  })
  window.on('closed', () => {
    if (mediaWindow === window) { mediaWindow = null; mediaPlayback.disconnect() }
  })
  void window.loadURL(url).catch(() => {
    mediaPlayback.disconnect()
    if (!window.isDestroyed()) window.destroy()
  })
  return window
}

export function destroyMediaWindow(): void {
  mediaPlayback.disconnect()
  mediaWindow?.destroy()
  mediaWindow = null
}
