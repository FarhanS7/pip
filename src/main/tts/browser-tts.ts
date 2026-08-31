/**
 * Browser SpeechSynthesis TTS Provider (Free Fallback)
 *
 * Implements TTSProvider using local SpeechSynthesis API.
 * Includes workaround for Chrome bug where long speech pauses after 15 seconds.
 *
 * References:
 *   PHASE_1_MODULES_AND_TASKS.md Task D.2 scoped checklist
 */

import { TTSProvider } from './tts-provider'
import { TTSError } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('browser-tts')

export class BrowserTTSProvider implements TTSProvider {
  public readonly name = 'browser'
  public readonly displayName = 'Browser SpeechSynthesis (Fallback)'
  public readonly requiresApiKey = false

  private isSpeaking: boolean = false
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  public async speak(text: string): Promise<void> {
    if (!text || !text.trim()) return

    this.stop()
    this.isSpeaking = true

    log.info('Browser TTS speaking', { length: text.length })

    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.isSpeaking = false
        reject(new TTSError('BROWSER_TTS_UNSUPPORTED', 'SpeechSynthesis API not available in current process'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)

      utterance.onend = () => {
        this.stopHeartbeat()
        this.isSpeaking = false
        log.info('Browser TTS finished speaking')
        resolve()
      }

      utterance.onerror = (event) => {
        this.stopHeartbeat()
        this.isSpeaking = false
        log.error('Browser TTS error', { error: event.error })
        reject(new TTSError('BROWSER_TTS_FAILED', `SpeechSynthesis error: ${event.error}`))
      }

      // Chrome bug workaround: periodic pause/resume heartbeat every 10 seconds
      // prevents Chromium SpeechSynthesis from pausing automatically after 15s.
      this.startHeartbeat()

      window.speechSynthesis.speak(utterance)
    })
  }

  public stop(): void {
    this.stopHeartbeat()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.isSpeaking = false
    log.info('Browser TTS stopped')
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && this.isSpeaking) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}
