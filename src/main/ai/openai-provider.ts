/**
 * OpenAI GPT-4o Vision Streaming Provider (Task C.3)
 *
 * Implements AIProvider for OpenAI GPT-4o vision chat streaming.
 * Calls Worker /chat proxy with SSE streaming and X-Pip-Auth authentication.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/ai module)
 *   PHASE_1_MODULES_AND_TASKS.md Task C.3 scoped checklist
 */

import { AIProvider, VisionPromptPayload } from './ai-provider'
import { AIProviderError } from '../errors'
import { buildSystemPrompt } from './system-prompt-builder'
import { createLogger } from '../logger'

const log = createLogger('openai-provider')

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai'
  public readonly displayName = 'OpenAI GPT-4o'
  public readonly defaultModel = 'gpt-4o'

  private readonly workerUrl: string
  private readonly sharedSecret: string

  constructor(
    workerUrl: string = process.env.PIP_WORKER_URL || 'http://127.0.0.1:8787',
    sharedSecret: string = process.env.PIP_SHARED_SECRET || 'your-shared-secret-placeholder'
  ) {
    this.workerUrl = workerUrl
    this.sharedSecret = sharedSecret
  }

  public async *streamChat(payload: VisionPromptPayload): AsyncIterableIterator<string> {
    log.info('Starting OpenAI GPT-4o vision chat stream')

    const systemPrompt = payload.systemPrompt || buildSystemPrompt({
      accessibilityTreeText: payload.accessibilityTreeText
    })

    const formattedMessages: unknown[] = [
      { role: 'system', content: systemPrompt }
    ]

    for (const msg of payload.messages) {
      if (msg.role === 'user' && payload.screenshotJpegBase64) {
        formattedMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: msg.content },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${payload.screenshotJpegBase64}`
              }
            }
          ]
        })
      } else if (msg.role !== 'system') {
        formattedMessages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    const requestBody = {
      provider: 'openai',
      model: this.defaultModel,
      messages: formattedMessages,
      stream: true
    }

    let response: Response
    try {
      response = await fetch(`${this.workerUrl}/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Pip-Auth': this.sharedSecret
        },
        body: JSON.stringify(requestBody)
      })
    } catch (err) {
      log.error('Failed to connect to Worker /chat proxy', { error: String(err) })
      throw new AIProviderError('WORKER_CONNECT_FAILED', `Failed to connect to proxy: ${String(err)}`, 'high')
    }

    if (!response.ok) {
      const errorText = await response.text()
      log.error('Worker proxy returned HTTP error', { status: response.status, body: errorText })
      throw new AIProviderError('AI_PROXY_ERROR', `Worker returned HTTP ${response.status}: ${errorText}`, 'high')
    }

    if (!response.body) {
      throw new AIProviderError('EMPTY_RESPONSE_BODY', 'Worker returned empty SSE response body', 'medium')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const parsed = JSON.parse(dataStr)
            const chunkText = parsed.choices?.[0]?.delta?.content
            if (chunkText) {
              yield chunkText
            }
          } catch {
            // Ignore partial SSE lines
          }
        }
      }
    }
  }
}
