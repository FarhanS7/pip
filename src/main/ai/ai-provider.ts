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
    case 'claude':
      // Implemented in C.2
      return {
        name: 'claude',
        displayName: 'Anthropic Claude',
        defaultModel: 'claude-3-5-sonnet-20241022',
        async *streamChat() {
          throw new Error('Claude vision provider not yet initialized (C.2)')
        }
      }
    case 'openai':
      // Implemented in C.3
      return {
        name: 'openai',
        displayName: 'OpenAI GPT-4o',
        defaultModel: 'gpt-4o',
        async *streamChat() {
          throw new Error('OpenAI vision provider not yet initialized (C.3)')
        }
      }
    case 'gemini':
      // Implemented in C.4
      return {
        name: 'gemini',
        displayName: 'Google Gemini',
        defaultModel: 'gemini-2.5-flash',
        async *streamChat() {
          throw new Error('Gemini vision provider not yet initialized (C.4)')
        }
      }
    default:
      throw new Error(`Unsupported AI provider type: ${type}`)
  }
}
