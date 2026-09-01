/**
 * Google Gemini Vision Streaming Provider (Task C.4)
 *
 * Implements AIProvider for Google Gemini vision chat streaming.
 * Calls Worker /chat proxy with SSE streaming and X-Pip-Auth authentication.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/ai module)
 *   PHASE_1_MODULES_AND_TASKS.md Task C.4 scoped checklist
 */

import { AIProvider, VisionPromptPayload } from './ai-provider'
import { AIProviderError } from '../errors'
import { buildSystemPrompt } from './system-prompt-builder'
import { createLogger } from '../logger'

const log = createLogger('gemini-provider')

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini'
  public readonly displayName = 'Google Gemini'
  public readonly defaultModel = 'gemini-2.5-flash'

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
    log.info('Starting Gemini vision chat stream')

    const systemPrompt = payload.systemPrompt || buildSystemPrompt({
      accessibilityTreeText: payload.accessibilityTreeText
    })

    const contents: unknown[] = []

    for (const msg of payload.messages) {
      if (msg.role === 'user' && payload.screenshotJpegBase64) {
        contents.push({
          role: 'user',
          parts: [
            { text: msg.content },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: payload.screenshotJpegBase64
              }
            }
          ]
        })
      } else if (msg.role !== 'system') {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })
      }
    }

    const requestBody = {
      provider: 'gemini',
      model: this.defaultModel,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents
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
          try {
            const parsed = JSON.parse(dataStr)
            const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text
            if (textChunk) {
              yield textChunk
            }
          } catch {
            // Ignore partial SSE lines
          }
        }
      }
    }
  }
}
