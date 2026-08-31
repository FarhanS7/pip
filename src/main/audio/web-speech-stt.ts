/**
 * Web Speech API STT Provider (Offline Fallback)
 *
 * Implements STTProvider and STTSession using browser SpeechRecognition (webkitSpeechRecognition).
 *
 * References:
 *   PHASE_1_MODULES_AND_TASKS.md Task B.4 scoped checklist
 *   Gotcha: Web Speech API auto-stops on extended silence — needs continuous session handling wrapper.
 */

import { STTProvider, STTSession, STTTranscriptEvent } from './stt-provider'
import { createLogger } from '../logger'

const log = createLogger('web-speech-stt')

export class WebSpeechSTTSession implements STTSession {
  public readonly id: string
  private transcriptCallbacks: Set<(event: STTTranscriptEvent) => void> = new Set()
  private errorCallbacks: Set<(error: Error) => void> = new Set()
  private isClosed: boolean = false
  private accumulatedText: string = ''

  constructor() {
    this.id = `web-speech-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    log.info('WebSpeechSTTSession created', { sessionId: this.id })
  }

  public sendAudio(_chunk: ArrayBuffer): void {
    // Web Speech API manages microphone capture directly in the browser process.
    // Raw PCM buffer injection is a no-op for browser SpeechRecognition.
  }

  public onTranscript(callback: (event: STTTranscriptEvent) => void): void {
    this.transcriptCallbacks.add(callback)
  }

  public onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback)
  }

  public emitTranscript(text: string, isFinal: boolean): void {
    if (this.isClosed) return

    if (isFinal) {
      this.accumulatedText += (this.accumulatedText ? ' ' : '') + text.trim()
    }

    const currentText = isFinal ? this.accumulatedText : (this.accumulatedText + ' ' + text).trim()

    for (const callback of this.transcriptCallbacks) {
      try {
        callback({ text: currentText, isFinal })
      } catch (err) {
        log.error('Transcript callback error', { error: String(err) })
      }
    }
  }

  public emitError(error: Error): void {
    if (this.isClosed) return
    for (const callback of this.errorCallbacks) {
      try {
        callback(error)
      } catch (err) {
        log.error('Error callback error', { error: String(err) })
      }
    }
  }

  public async close(): Promise<void> {
    if (this.isClosed) return
    this.isClosed = true
    this.transcriptCallbacks.clear()
    this.errorCallbacks.clear()
    log.info('WebSpeechSTTSession closed', { sessionId: this.id })
  }
}

export class WebSpeechSTTProvider implements STTProvider {
  public readonly name = 'web-speech'
  public readonly displayName = 'Web Speech API (Local Fallback)'
  public readonly requiresApiKey = false

  public async createSession(): Promise<STTSession> {
    return new WebSpeechSTTSession()
  }
}
