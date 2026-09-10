import type { TTSProvider } from './tts-provider'
import { TTSError } from '../errors'
import { createMediaWindow, mediaPlayback } from '../windows/media-window'

import { getAppConfig } from '../config'

const MAX_AUDIO_BYTES = 12 * 1024 * 1024

/** Fetch in main; decode and play only in the single media renderer. */
export abstract class ProxyTTSProvider implements TTSProvider {
  abstract readonly name: string
  abstract readonly displayName: string
  readonly requiresApiKey = true
  private active: AbortController | null = null
  private readonly workerUrl: string
  private readonly sharedSecret: string

  constructor(
    private provider: 'openai' | 'elevenlabs',
    workerUrl?: string,
    sharedSecret?: string
  ) {
    const config = getAppConfig()
    this.workerUrl = (workerUrl || config.workerUrl).replace(/\/+$/, '')
    this.sharedSecret = sharedSecret ?? config.sharedSecret
  }

  async speak(text: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (!text.trim()) return
    if (text.length > (this.provider === 'openai' ? 4096 : 16000)) throw new TTSError('TTS_TEXT_LIMIT', 'Speech response is too long')
    this.stop()
    const controller = new AbortController()
    this.active = controller
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, 30000)
    try {
      const response = await fetch(`${this.workerUrl}/tts`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'X-Pip-Auth': this.sharedSecret },
        body: JSON.stringify({ provider: this.provider, ...(this.provider === 'openai' ? { input: text, model: 'tts-1', voice: 'alloy', response_format: 'mp3' } : { text }) })
      })
      if (!response.ok || !response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('audio/mpeg')) {
        let errMessage = 'Speech playback could not complete. Please try again.'
        try {
          const errText = await response.text()
          const parsed = JSON.parse(errText) as { error?: string }
          if (parsed?.error) errMessage = String(parsed.error)
        } catch { /* default */ }
        throw new TTSError('TTS_FAILED', errMessage)
      }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let length = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          controller.signal.throwIfAborted()
          if (done) break
          length += value.byteLength
          if (length > MAX_AUDIO_BYTES) throw new Error('Audio limit exceeded')
          chunks.push(value)
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
      if (!length) throw new Error('Empty audio')
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      clearTimeout(timer)
      controller.signal.throwIfAborted()
      createMediaWindow()
      await mediaPlayback.speak('', controller.signal, bytes.buffer)
    } catch (error) {
      if (error instanceof TTSError) throw error
      throw new TTSError('TTS_FAILED', 'Speech playback could not complete. Please try again.')
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort)
      if (this.active === controller) this.active = null
    }
  }

  stop(): void { this.active?.abort(); this.active = null }
}
