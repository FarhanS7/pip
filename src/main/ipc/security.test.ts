import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { BrowserWindow, WebContents, IpcMainInvokeEvent, Session } from 'electron'
const host = vi.hoisted(() => ({ isPackaged: true, state: 'idle', quit: vi.fn(), handlers: new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ app: host, ipcMain: { handle: (channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => host.handlers.set(channel, handler) } }))
vi.mock('../state/voice-state-machine', () => ({ voiceStateMachine: { getState: () => host.state } }))
import { authorizeIpc, secureRenderer, rendererURL, installPermissionPolicy } from './security'
import { IpcChannel } from '../../shared/channels'

function fixture(role: 'panel' | 'overlay' | 'media', register = true) {
  const url = `file:///app/${role}/index.html`
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: { url }, isDestroyed: vi.fn(() => false), setWindowOpenHandler: vi.fn()
  })
  const sender = contents as unknown as WebContents
  if (register) secureRenderer({ webContents: sender } as BrowserWindow, role, url)
  return { contents, event: { sender, senderFrame: contents.mainFrame } as unknown as IpcMainInvokeEvent, url }
}

beforeEach(() => { host.state = 'idle'; host.isPackaged = true })
afterEach(() => vi.unstubAllEnvs())
describe('Renderer authority', () => {
  it('enforces authorization in registered handlers before any action and validates transcripts', async () => {
    const { registerIpcHandlers } = await import('./handlers')
    registerIpcHandlers()
    const quit = host.handlers.get(IpcChannel.APP_QUIT)!
    expect(() => quit(fixture('panel', false).event)).toThrow('Untrusted')
    expect(host.quit).not.toHaveBeenCalled()
    const read = host.handlers.get(IpcChannel.SETTINGS_GET)!
    await expect(read(fixture('panel').event)).resolves.toHaveProperty('cursorEnabled')
    expect(() => read(fixture('panel').event, {}, {})).toThrow('arguments')
    const transcript = host.handlers.get(IpcChannel.STT_UPDATE_TRANSCRIPT)!
    await expect(transcript(fixture('media').event, { text: 'bad shape' })).rejects.toThrow('Invalid transcript')
    await expect(transcript(fixture('media').event, 'x'.repeat(16001))).rejects.toThrow('Invalid transcript')
    await expect(transcript(fixture('media').event, { text: 'late', turnId: 1 })).rejects.toThrow('No active recording')
  })
  it('limits media actions to the media renderer and keeps overlays read-only', () => {
    const panel = fixture('panel'), overlay = fixture('media')
    expect(() => authorizeIpc(panel.event, IpcChannel.SETTINGS_SET)).not.toThrow()
    expect(() => authorizeIpc(overlay.event, IpcChannel.SETTINGS_GET)).not.toThrow()
    expect(() => authorizeIpc(overlay.event, IpcChannel.STT_UPDATE_TRANSCRIPT)).not.toThrow()
    expect(() => authorizeIpc(overlay.event, IpcChannel.SETTINGS_SET)).toThrow()
    expect(() => authorizeIpc(panel.event, IpcChannel.STT_UPDATE_TRANSCRIPT)).toThrow()
    expect(() => authorizeIpc(panel.event, 'unknown:action')).toThrow()
    expect(() => authorizeIpc(overlay.event, IpcChannel.MEDIA_READY)).not.toThrow()
    expect(() => authorizeIpc(overlay.event, IpcChannel.MEDIA_PLAYBACK_RESULT)).not.toThrow()
    expect(() => authorizeIpc(fixture('overlay').event, IpcChannel.STT_UPDATE_TRANSCRIPT)).toThrow()
    expect(() => authorizeIpc(panel.event, IpcChannel.MEDIA_PLAYBACK_RESULT)).toThrow()
  })
  it('rejects an unregistered window even if it loads the same app URL', () => {
    expect(() => authorizeIpc(fixture('panel', false).event, IpcChannel.APP_QUIT)).toThrow()
  })
  it('rejects same-origin child frames, missing frames, navigated and destroyed senders', () => {
    const item = fixture('panel')
    expect(() => authorizeIpc({ ...item.event, senderFrame: { url: item.url } } as IpcMainInvokeEvent, IpcChannel.SETTINGS_GET)).toThrow()
    expect(() => authorizeIpc({ ...item.event, senderFrame: null }, IpcChannel.SETTINGS_GET)).toThrow()
    item.contents.mainFrame.url = 'https://example.com'
    expect(() => authorizeIpc(item.event, IpcChannel.SETTINGS_GET)).toThrow()
    item.contents.mainFrame.url = item.url
    item.contents.isDestroyed.mockReturnValue(true)
    expect(() => authorizeIpc(item.event, IpcChannel.SETTINGS_GET)).toThrow()
  })
  it('blocks popups, webviews, child navigation, redirects and external navigation', () => {
    const item = fixture('panel')
    expect(item.contents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' })
    for (const [name, details, url] of [
      ['will-attach-webview', {}, undefined],
      ['will-frame-navigate', { isMainFrame: false, url: item.url }, undefined],
      ['will-navigate', {}, 'https://example.com'],
      ['will-redirect', {}, undefined]
    ] as const) {
      const preventDefault = vi.fn()
      item.contents.emit(name, { ...details, preventDefault }, url)
      expect(preventDefault).toHaveBeenCalledOnce()
    }
    const preventDefault = vi.fn()
    item.contents.emit('will-navigate', { preventDefault }, item.url)
    expect(preventDefault).not.toHaveBeenCalled()
    item.contents.emit('destroyed')
    expect(() => authorizeIpc(item.event, IpcChannel.SETTINGS_GET)).toThrow()
  })
  it('ignores renderer URL overrides in packaged apps and rejects remote dev servers', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'https://example.com')
    expect(rendererURL('panel')).toMatch(/^file:/)
    host.isPackaged = false
    expect(() => rendererURL('panel')).toThrow('loopback')
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
    expect(rendererURL('panel')).toBe('http://localhost:5173/panel/index.html')
  })
})

describe('Permission policy', () => {
  it('allows audio only in the trusted media main frame during listening', () => {
    const overlay = fixture('media'), panel = fixture('panel')
    const check = vi.fn(), request = vi.fn()
    installPermissionPolicy({ setPermissionCheckHandler: check, setPermissionRequestHandler: request } as unknown as Session)
    const checkPermission = check.mock.calls[0][0] as NonNullable<Parameters<Session['setPermissionCheckHandler']>[0]>
    const requestPermission = request.mock.calls[0][0] as NonNullable<Parameters<Session['setPermissionRequestHandler']>[0]>
    const details = { isMainFrame: true, requestingUrl: overlay.url, mediaType: 'audio' as const }
    expect(checkPermission(overlay.event.sender, 'media', '', details)).toBe(false)
    host.state = 'listening'
    expect(checkPermission(overlay.event.sender, 'media', '', details)).toBe(true)
    expect(checkPermission(panel.event.sender, 'media', '', details)).toBe(false)
    expect(checkPermission(fixture('overlay').event.sender, 'media', '', details)).toBe(false)
    expect(checkPermission(overlay.event.sender, 'media', '', { ...details, isMainFrame: false })).toBe(false)
    expect(checkPermission(overlay.event.sender, 'media', '', { ...details, mediaType: 'video' })).toBe(false)
    expect(checkPermission(overlay.event.sender, 'notifications', '', details)).toBe(false)
    for (const mediaTypes of [['audio'], ['video'], ['audio', 'video'], []]) {
      const callback = vi.fn()
      requestPermission(overlay.event.sender, 'media', callback, { isMainFrame: true, requestingUrl: overlay.url, mediaTypes } as Electron.MediaAccessPermissionRequest)
      expect(callback).toHaveBeenCalledWith(mediaTypes.length === 1 && mediaTypes[0] === 'audio')
    }
  })
})
