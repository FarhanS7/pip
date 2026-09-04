import { ElevenLabsTTSProvider } from './elevenlabs-tts'
import { OpenAITTSProvider } from './openai-tts'
import { BrowserTTSProvider } from './browser-tts'

export interface TTSProvider {
  readonly name: string
  readonly displayName: string
  readonly requiresApiKey: boolean
  /** Synthesize and speak spoken text */
  speak(text: string): Promise<void>
  /** Immediately halt active audio playback */
  stop(): void
}

export type TTSProviderType = 'elevenlabs' | 'openai-tts' | 'browser'

/**
 * Factory function to instantiate active TTS provider.
 */
export function createTTSProvider(type: TTSProviderType): TTSProvider {
  switch (type) {
    case 'elevenlabs':
      return new ElevenLabsTTSProvider()
    case 'openai-tts':
      return new OpenAITTSProvider()
    case 'browser':
      return new BrowserTTSProvider()
    default:
      throw new Error(`Unsupported TTS provider type: ${type}`)
  }
}

