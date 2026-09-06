import { it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'

const host = vi.hoisted(() => ({ reset: vi.fn(), windows: [] as unknown[] }))
vi.mock('../ipc/security', () => ({ rendererURL: () => 'file:///app/media/index.html', secureRenderer: vi.fn() }))
vi.mock('../state/voice-state-machine', () => ({ voiceStateMachine: { reset: host.reset } }))
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  return { BrowserWindow: class extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), { send: vi.fn() })
    destroyed = false
    constructor() { super(); host.windows.push(this) }
    isDestroyed() { return this.destroyed }
    loadURL() { return Promise.resolve() }
    destroy() { this.destroyed = true; this.emit('closed') }
  } }
})
import { createMediaWindow, destroyMediaWindow, mediaPlayback } from './media-window'

it('reuses one hidden media window and rejects in-flight playback on crash before recreation', async () => {
  const first = createMediaWindow()
  expect(createMediaWindow()).toBe(first)
  expect(host.windows).toHaveLength(1)
  mediaPlayback.markReady()
  const playing = mediaPlayback.speak('fixture')
  const failed = expect(playing).rejects.toThrow('unavailable')
  await Promise.resolve()
  ;(first.webContents as unknown as EventEmitter).emit('render-process-gone')
  await failed
  expect(host.reset).toHaveBeenCalledWith('media-renderer-failed')
  expect(first.isDestroyed()).toBe(true)
  expect(createMediaWindow()).not.toBe(first)
  expect(host.windows).toHaveLength(2)
  destroyMediaWindow()
})
