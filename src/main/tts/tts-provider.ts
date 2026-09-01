/**
 * Text-to-Speech (TTS) Provider Interface & Factory
 *
 * Defines abstract contract for TTS speech synthesis providers.
 * Follows Provider Interface Pattern from PHASE_0_ARCHITECTURE.md §0.4.
 */

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
    case 'elevenlabs': {
      const { ElevenLabsTTSProvider } = require('./elevenlabs-tts')
      return new ElevenLabsTTSProvider()
    }
    case 'openai-tts': {
      const { OpenAITTSProvider } = require('./openai-tts')
      return new OpenAITTSProvider()
    }
    case 'browser': {
      const { BrowserTTSProvider } = require('./browser-tts')
      return new BrowserTTSProvider()
    }
    default:
      throw new Error(`Unsupported TTS provider type: ${type}`)
  }
}
