import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PipAPI } from '../../shared/types/pip-api'
import { bindBrowserRecognition } from './browser-recognition'

class Recognition {
  continuous = false; interimResults = false; lang = ''
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn(); stop = vi.fn(); abort = vi.fn()
}
async function fixture(provider = 'web-speech', available = true) {
  const recognition = new Recognition()
  vi.stubGlobal('window', available ? { SpeechRecognition: function () { return recognition } } : {})
  let state!: Parameters<PipAPI['onVoiceStateChanged']>[0]
  const api = {
    onVoiceStateChanged: vi.fn(callback => { state = callback; return vi.fn() }),
    getSettings: vi.fn().mockResolvedValue({ selectedSTTProvider: provider }),
    reportAudioFailure: vi.fn().mockResolvedValue(undefined), finishBrowserRecognition: vi.fn().mockResolvedValue(undefined)
  }
  const cleanup = bindBrowserRecognition(api as unknown as PipAPI)
  state({ state: 'listening', turnId: 1 }); await Promise.resolve()
  return { recognition, state, api, cleanup }
}
afterEach(() => vi.unstubAllGlobals())
describe('Browser recognition', () => {
  it('reports missing recognition capability and never invents a transcript', async () => {
    const { api, cleanup } = await fixture('web-speech', false)
    expect(api.reportAudioFailure).toHaveBeenCalledWith(1)
    expect(api.finishBrowserRecognition).not.toHaveBeenCalled(); cleanup()
  })
  it('honors the selected STT provider', async () => {
    const { recognition, api, cleanup } = await fixture('assemblyai')
    expect(recognition.start).not.toHaveBeenCalled()
    expect(api.reportAudioFailure).not.toHaveBeenCalled(); cleanup()
  })
  it('waits for results after stop and sends the completed transcript on end', async () => {
    const { recognition, state, api, cleanup } = await fixture()
    state({ state: 'processing', turnId: 1 })
    expect(recognition.stop).toHaveBeenCalledOnce()
    expect(api.finishBrowserRecognition).not.toHaveBeenCalled()
    recognition.onresult?.({ results: [[{ transcript: 'final words' }]] })
    recognition.onend?.()
    expect(api.finishBrowserRecognition).toHaveBeenCalledWith('final words', 1)
    cleanup()
  })
  it('discards canceled callbacks and reports actual recognition failures', async () => {
    const first = await fixture()
    const late = first.recognition.onend!
    first.state({ state: 'idle', turnId: 1 }); late()
    expect(first.api.finishBrowserRecognition).not.toHaveBeenCalled(); first.cleanup()
    const second = await fixture()
    second.recognition.onerror?.()
    expect(second.api.reportAudioFailure).toHaveBeenCalledWith(1)
    expect(second.recognition.abort).toHaveBeenCalledOnce(); second.cleanup()
  })
})
