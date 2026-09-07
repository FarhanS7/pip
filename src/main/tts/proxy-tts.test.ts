import { afterEach, describe, expect, it, vi } from 'vitest'
const media = vi.hoisted(() => ({ speak: vi.fn(), create: vi.fn() }))
vi.mock('../windows/media-window', () => ({ mediaPlayback: { speak: media.speak }, createMediaWindow: media.create }))
import { OpenAITTSProvider } from './openai-tts'
import { ElevenLabsTTSProvider } from './elevenlabs-tts'
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers() })
describe('Provider audio transport', () => {
  it.each([OpenAITTSProvider, ElevenLabsTTSProvider])('waits for renderer completion for %s', async Provider => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }))
    vi.stubGlobal('fetch', fetch)
    let finish!: () => void
    media.speak.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const provider = new Provider('http://fixture', 'fixture-secret')
    const finished = vi.fn()
    const pending = provider.speak('hello').then(finished)
    await vi.waitFor(() => expect(media.speak).toHaveBeenCalledOnce())
    expect(finished).not.toHaveBeenCalled()
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject(Provider === OpenAITTSProvider ? { input: 'hello', provider: 'openai', response_format: 'mp3' } : { text: 'hello', provider: 'elevenlabs' })
    expect([...new Uint8Array(media.speak.mock.calls[0][2])]).toEqual([1, 2, 3])
    finish(); await pending
    expect(finished).toHaveBeenCalledOnce()
  })
  it('aborts playback when stopped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), { headers: { 'content-type': 'audio/mpeg' } })))
    media.speak.mockImplementation((_text, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('cancelled')))
    }))
    const provider = new OpenAITTSProvider()
    const rejected = expect(provider.speak('hello')).rejects.toThrow('Speech playback could not complete')
    await vi.waitFor(() => expect(media.speak).toHaveBeenCalledOnce())
    provider.stop(); await rejected
  })
  it.each([
    () => new Response('sensitive fixture', { status: 403 }),
    () => new Response('not audio', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array(0), { headers: { 'content-type': 'audio/mpeg' } }),
    () => new Response(new Uint8Array(12 * 1024 * 1024 + 1), { headers: { 'content-type': 'audio/mpeg' } })
  ])('rejects invalid or excessive audio without playback', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    await expect(new ElevenLabsTTSProvider().speak('hello')).rejects.toThrow('Speech playback could not complete')
    expect(media.speak).not.toHaveBeenCalled()
  })
  it('times out and aborts an unresponsive fetch', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new Error('cancelled')))
    })))
    const rejected = expect(new OpenAITTSProvider().speak('hello')).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(30000); await rejected
    expect(vi.getTimerCount()).toBe(0)
  })
})
