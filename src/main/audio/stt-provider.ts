/**
 * Speech-to-Text (STT) Provider Interface & Factory
 *
 * Defines the contracts for STT providers and active transcription sessions.
 * Follows Provider Interface Pattern from PHASE_0_ARCHITECTURE.md §0.4.
 */

export interface STTTranscriptEvent {
  text: string
  isFinal: boolean
}

export interface STTSession {
  /** Session ID */
  readonly id: string
  /** Send PCM16 audio buffer chunk to STT engine */
  sendAudio(chunk: ArrayBuffer): void
  /** Subscribe to transcript callbacks */
  onTranscript(callback: (event: STTTranscriptEvent) => void): void
  /** Subscribe to error callbacks */
  onError(callback: (error: Error) => void): void
  /** End current STT session */
  close(): Promise<void>
}

export interface STTProvider {
  readonly name: string
  readonly displayName: string
  readonly requiresApiKey: boolean
  /** Create a new transcription session */
  createSession(): Promise<STTSession>
}

export type STTProviderType = 'assemblyai' | 'web-speech'

/**
 * Factory function to instantiate active STT provider.
 */
export function createSTTProvider(type: STTProviderType): STTProvider {
  switch (type) {
    case 'assemblyai':
      // Implemented in B.5
      return {
        name: 'assemblyai',
        displayName: 'AssemblyAI Real-Time STT',
        requiresApiKey: true,
        async createSession() {
          throw new Error('AssemblyAI STT provider session not yet initialized (B.5)')
        }
      }
    case 'web-speech': {
      const { WebSpeechSTTProvider } = require('./web-speech-stt')
      return new WebSpeechSTTProvider()
    }
    default:
      throw new Error(`Unsupported STT provider type: ${type}`)
  }
}
