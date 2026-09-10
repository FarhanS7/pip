import { app } from 'electron'
import type { BrowserWindow, IpcMainInvokeEvent, Session, WebContents } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IpcChannel } from '../../shared/channels'
import { voiceStateMachine } from '../state/voice-state-machine'

export type RendererRole = 'panel' | 'overlay' | 'media'
const renderers = new WeakMap<WebContents, { role: RendererRole; url: string }>()

export function rendererURL(role: RendererRole): string {
  const developmentURL = !app.isPackaged && process.env.ELECTRON_RENDERER_URL
  if (developmentURL) {
    const url = new URL(developmentURL)
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Renderer development server must use loopback HTTP')
    }
    return new URL(`${role}/index.html`, `${url.href.replace(/\/$/, '')}/`).href
  }
  return pathToFileURL(join(__dirname, `../renderer/${role}/index.html`)).href
}

function sameDocument(actual: string, expected: string): boolean {
  try {
    const url = new URL(actual)
    url.hash = ''
    return url.href === expected
  } catch { return false }
}

export function secureRenderer(window: BrowserWindow, role: RendererRole, url: string): void {
  const contents = window.webContents
  renderers.set(contents, { role, url })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-attach-webview', event => event.preventDefault())
  contents.on('will-navigate', (event, target) => {
    if (!sameDocument(target, url)) event.preventDefault()
  })
  contents.on('will-frame-navigate', event => {
    if (!event.isMainFrame || !sameDocument(event.url, url)) event.preventDefault()
  })
  contents.on('will-redirect', event => event.preventDefault())
  contents.once('destroyed', () => renderers.delete(contents))
}

function trustedRole(contents: WebContents | null): RendererRole | null {
  if (!contents || contents.isDestroyed()) return null
  const registered = renderers.get(contents)
  return registered && sameDocument(contents.mainFrame.url, registered.url) ? registered.role : null
}

const readChannels = new Set<string>([IpcChannel.SETTINGS_GET])
const panelChannels = new Set<string>([
  IpcChannel.SUBMIT_TEXT,
  IpcChannel.CANCEL_TURN,
  IpcChannel.SETTINGS_SET, IpcChannel.SETTINGS_RESET, IpcChannel.SETTINGS_NOTICE,
  IpcChannel.START_RECORDING, IpcChannel.STOP_RECORDING, IpcChannel.APP_QUIT,
  IpcChannel.CURSOR_TOGGLE, IpcChannel.CURSOR_VISIBILITY_GET,
  IpcChannel.PERMISSIONS_GET, IpcChannel.PERMISSIONS_REQUEST,
  IpcChannel.DIAGNOSTICS_COLLECT,
  IpcChannel.CAPTURE_POLICY_GET, IpcChannel.CAPTURE_PAUSE, IpcChannel.CAPTURE_RESUME,
  IpcChannel.ONBOARDING_COMPLETE
])

export function authorizeIpc(event: IpcMainInvokeEvent, channel: string): void {
  const role = trustedRole(event.sender)
  if (!role || !event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted IPC sender')
  if (readChannels.has(channel) || (role === 'panel' && panelChannels.has(channel)) ||
    (role === 'media' && [IpcChannel.STT_UPDATE_TRANSCRIPT, IpcChannel.MEDIA_READY, IpcChannel.MEDIA_PLAYBACK_RESULT,
      IpcChannel.BROWSER_TRANSCRIPT_FINAL, IpcChannel.MEDIA_AUDIO_CHUNK, IpcChannel.MEDIA_AUDIO_STOPPED, IpcChannel.MEDIA_AUDIO_FAILED].includes(channel as IpcChannel))) return
  throw new Error('IPC action is not available to this window')
}

export function installPermissionPolicy(session: Session): void {
  const canRecord = (contents: WebContents | null, isMainFrame: boolean, url?: string) => {
    return isMainFrame && trustedRole(contents) === 'media' &&
      (!url || sameDocument(url, renderers.get(contents!)!.url)) && voiceStateMachine.getState() === 'listening'
  }
  session.setPermissionCheckHandler((contents, permission, _origin, details) =>
    permission === 'media' && details.mediaType === 'audio' && canRecord(contents, details.isMainFrame, details.requestingUrl))
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(permission === 'media' && 'mediaTypes' in details && Array.isArray(details.mediaTypes) && details.mediaTypes.length > 0 &&
      details.mediaTypes.every(type => type === 'audio') && canRecord(contents, details.isMainFrame, details.requestingUrl))
  })
}
