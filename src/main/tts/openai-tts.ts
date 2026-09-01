/**
 * OpenAI TTS Provider (Task D.4)
 *
 * Implements TTSProvider using OpenAI `tts-1` speech synthesis.
 * Fetches audio/mpeg streams via Cloudflare Worker proxy (/tts) with X-Pip-Auth.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/tts module)
 *   PHASE_1_MODULES_AND_TASKS.md Task D.4 scoped checklist
 */

import { TTSProvider } from './tts-provider'
import { TTSError } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('openai-tts')

export class OpenAITTSProvider implements TTSProvider {
  public readonly name = 'openai-tts'
  public readonly displayName = 'OpenAI TTS'
  public readonly requiresApiKey = true

  private readonly workerUrl: string
  private readonly sharedSecret: string
  private currentAudio: HTMLAudioElement | null = null

  constructor(
    workerUrl: string = process.env.PIP_WORKER_URL || 'http://127.0.0.1:8787',
    sharedSecret: string = process.env.PIP_SHARED_SECRET || 'your-shared-secret-placeholder'
  ) {
    this.workerUrl = workerUrl
    this.sharedSecret = sharedSecret
  }

  public async speak(text: string): Promise<void> {
    if (!text || !text.trim()) return

    this.stop()
    log.info('OpenAI TTS speak requested', { length: text.length })

    let response: Response
    try {
      response = await fetch(`${this.workerUrl}/tts`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Pip-Auth': this.sharedSecret
        },
        body: JSON.stringify({
          text,
          provider: 'openai',
          model: 'tts-1',
          voice: 'alloy'
        })
      })
    } catch (err) {
      log.error('Failed to connect to Worker /tts proxy', { error: String(err) })
      throw new TTSError('WORKER_TTS_CONNECT_FAILED', `Failed to connect to TTS proxy: ${String(err)}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      log.error('Worker TTS proxy returned HTTP error', { status: response.status, body: errorText })
      throw new TTSError('TTS_PROXY_ERROR', `Worker returned HTTP ${response.status}: ${errorText}`)
    }

    const audioArrayBuffer = await response.arrayBuffer()
    const blob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' })
    const audioUrl = URL.createObjectURL(blob)

    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined' || typeof Audio === 'undefined') {
        log.warn('Browser Audio element not available in non-DOM process context')
        resolve()
        return
      }

      const audio = new Audio(audioUrl)
      this.currentAudio = audio

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        this.currentAudio = null
        log.info('OpenAI TTS audio playback complete')
        resolve()
      }

      audio.onerror = (err) => {
        URL.revokeObjectURL(audioUrl)
        this.currentAudio = null
        log.error('OpenAI TTS audio playback error', { error: String(err) })
        reject(new TTSError('AUDIO_PLAYBACK_FAILED', `Audio playback failed: ${String(err)}`))
      }

      audio.play().catch((playErr) => {
        URL.revokeObjectURL(audioUrl)
        this.currentAudio = null
        reject(new TTSError('AUDIO_PLAY_REJECTED', `Audio play rejected: ${String(playErr)}`))
      })
    })
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
      log.info('OpenAI TTS playback stopped')
    }
  }
}
