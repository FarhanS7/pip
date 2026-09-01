/**
 * AI Vision + Chat Provider Interface & Factory
 *
 * Defines the contract for multi-model vision chat streaming providers.
 * Follows Provider Interface Pattern from PHASE_0_ARCHITECTURE.md §0.4.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface VisionPromptPayload {
  messages: ChatMessage[]
  screenshotJpegBase64?: string
  accessibilityTreeText?: string
  systemPrompt?: string
}

export interface AIProvider {
  readonly name: string
  readonly displayName: string
  readonly defaultModel: string
  /**
   * Stream completion response chunks asynchronously.
   * Yields text chunks as they arrive from the upstream model.
   */
  streamChat(payload: VisionPromptPayload): AsyncIterableIterator<string>
}

export type AIProviderType = 'claude' | 'openai' | 'gemini'

/**
 * Factory function to instantiate active AI provider.
 */
export function createAIProvider(type: AIProviderType, _model?: string): AIProvider {
  switch (type) {
    case 'claude': {
      const { ClaudeProvider } = require('./claude-provider')
      return new ClaudeProvider()
    }
    case 'openai': {
      const { OpenAIProvider } = require('./openai-provider')
      return new OpenAIProvider()
    }
    case 'gemini': {
      const { GeminiProvider } = require('./gemini-provider')
      return new GeminiProvider()
    }
    default:
      throw new Error(`Unsupported AI provider type: ${type}`)
  }
}
