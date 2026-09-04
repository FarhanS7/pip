import { AssemblyAISTTProvider } from './assemblyai-stt'
import { WebSpeechSTTProvider } from './web-speech-stt'

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
      return new AssemblyAISTTProvider()
    case 'web-speech':
      return new WebSpeechSTTProvider()
    default:
      throw new Error(`Unsupported STT provider type: ${type}`)
  }
}

