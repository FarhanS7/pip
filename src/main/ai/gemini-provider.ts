import { readProviderText } from './sse-stream'
import { visionMessages } from './vision-messages'
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
  public readonly defaultModel = 'gemini-3.6-flash'

  private readonly workerUrl: string
  private readonly sharedSecret: string

  constructor(
    workerUrl: string = process.env.PIP_WORKER_URL || 'http://127.0.0.1:8787',
    sharedSecret: string = process.env.PIP_SHARED_SECRET || 'your-shared-secret-placeholder',
    private readonly model: string = ''
  ) {
    this.workerUrl = workerUrl
    this.sharedSecret = sharedSecret
  }

  public async *streamChat(payload: VisionPromptPayload): AsyncIterableIterator<string> {
    log.info('Starting Gemini vision chat stream')

    const systemPrompt = payload.systemPrompt || buildSystemPrompt({
      accessibilityTreeText: payload.accessibilityTreeText
    })

    const contents = visionMessages(payload, 'gemini')

    const requestBody = {
      provider: 'gemini',
      model: this.model || this.defaultModel,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents
    }

    let response: Response
    try {
      response = await fetch(`${this.workerUrl}/chat`, {
        method: 'POST',
        signal: payload.signal,
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

    yield* readProviderText(response, 'gemini', payload.signal)
  }
}
