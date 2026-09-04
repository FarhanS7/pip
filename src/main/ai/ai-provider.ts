import { ClaudeProvider } from './claude-provider'
import { OpenAIProvider } from './openai-provider'
import { GeminiProvider } from './gemini-provider'

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
      return new ClaudeProvider()
    case 'openai':
      return new OpenAIProvider()
    case 'gemini':
      return new GeminiProvider()
    default:
      throw new Error(`Unsupported AI provider type: ${type}`)
  }
}

