import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { AudioChunkQueue, bindPcmMicrophone } from './pcm-microphone'
import type { PipAPI } from '../../shared/types/pip-api'
import { DEFAULT_SETTINGS } from '../../shared/settings'

function encoder(rate: number) {
  const messages: Array<{ buffer?: ArrayBuffer; stopped?: boolean }> = []
  let Processor!: new () => { process(inputs: Float32Array[][]): boolean; port: { onmessage: (event: { data: string }) => void } }
  runInNewContext(readFileSync('src/renderer/public/pcm-worklet.js', 'utf8'), {
    sampleRate: rate,
    AudioWorkletProcessor: class { port = { postMessage: (message: typeof messages[number]) => messages.push(message) } },
    registerProcessor: (_name: string, constructor: typeof Processor) => { Processor = constructor }
  })
  return { processor: new Processor(), messages }
}

describe('PCM encoder', () => {
  it.each([16000, 44100, 48000])('encodes 100ms at %i Hz across arbitrary render blocks', rate => {
    const { processor, messages } = encoder(rate)
    const frames = rate / 10
    for (let offset = 0; offset < frames; offset += 128) {
      processor.process([ [new Float32Array(Math.min(128, frames - offset)).fill(0.5)] ])
    }
    expect(messages).toHaveLength(1)
    expect(messages[0].buffer!.byteLength).toBe(3200)
    const pcm = new DataView(messages[0].buffer!)
    expect(pcm.getInt16(0, true)).toBe(16384)
    expect(pcm.getInt16(3198, true)).toBe(16384)
  })
  it('mixes channels, clamps PCM, flushes the tail and stops processing', () => {
    const { processor, messages } = encoder(16000)
    processor.process([[new Float32Array([2, -2, 1]), new Float32Array([2, -2, -1])]])
    processor.port.onmessage({ data: 'stop' })
    const pcm = new DataView(messages[0].buffer!)
    expect([0, 2, 4].map(offset => pcm.getInt16(offset, true))).toEqual([32767, -32768, 0])
    expect(messages[1]).toEqual({ stopped: true })
    expect(processor.process([])).toBe(false)
  })
})

describe('Bounded audio delivery', () => {
  it('preserves sequence and waits for queued chunks to drain', async () => {
    let release!: () => void
    const send = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve })).mockResolvedValue(undefined)
    const queue = new AudioChunkQueue(send)
    queue.enqueue(new ArrayBuffer(2)); queue.enqueue(new ArrayBuffer(4))
    expect(send).toHaveBeenCalledTimes(1)
    release(); await queue.flush()
    expect(send.mock.calls.map(call => call[1])).toEqual([0, 1])
  })
  it('fails rather than silently dropping audio when the backlog is full', async () => {
    let release!: () => void
    const queue = new AudioChunkQueue(() => new Promise<void>(resolve => { release = resolve }))
    for (let index = 0; index < 50; index++) queue.enqueue(new ArrayBuffer(3200))
    expect(() => queue.enqueue(new ArrayBuffer(3200))).toThrow('too slow')
    release()
    await expect(queue.flush()).rejects.toThrow('failed')
  })
  it('stops a stream whose permission request resolves after recording has ended', async () => {
    let changed!: Parameters<PipAPI['onVoiceStateChanged']>[0]
    let grant!: (stream: MediaStream) => void
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(resolve => { grant = resolve }))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    const api = {
      onVoiceStateChanged: (callback: typeof changed) => { changed = callback; return vi.fn() },
      getSettings: async () => ({ ...DEFAULT_SETTINGS, selectedSTTProvider: 'assemblyai' }),
      sendAudio: vi.fn(), audioStopped: vi.fn(async () => {}), reportAudioFailure: vi.fn(async () => {})
    } as unknown as PipAPI
    const stopTrack = vi.fn()
    const dispose = bindPcmMicrophone(api)
    try {
      changed({ state: 'listening', turnId: 1 })
      await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
      changed({ state: 'processing', turnId: 1 })
      grant({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream)
      await vi.waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
      expect(api.sendAudio).not.toHaveBeenCalled()
    } finally { dispose(); vi.unstubAllGlobals() }
  })
})
