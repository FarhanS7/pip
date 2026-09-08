import { readProviderText } from './sse-stream'
import { visionMessages } from './vision-messages'
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
import { getAppConfig } from '../config'

const log = createLogger('openai-provider')

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai'
  public readonly displayName = 'OpenAI GPT-4o'
  public readonly defaultModel = 'gpt-4o'

  private readonly workerUrl: string
  private readonly sharedSecret: string

  constructor(
    workerUrl?: string,
    sharedSecret?: string,
    private readonly model: string = ''
  ) {
    const config = getAppConfig()
    this.workerUrl = (workerUrl || config.workerUrl).replace(/\/+$/, '')
    this.sharedSecret = sharedSecret ?? config.sharedSecret
  }

  public async *streamChat(payload: VisionPromptPayload): AsyncIterableIterator<string> {
    log.info('Starting OpenAI GPT-4o vision chat stream')

    const systemPrompt = payload.systemPrompt || buildSystemPrompt({
      accessibilityTreeText: payload.accessibilityTreeText
    })

    const formattedMessages = [{ role: 'system', content: systemPrompt }, ...visionMessages(payload, 'openai')]

    const requestBody = {
      provider: 'openai',
      model: this.model || this.defaultModel,
      messages: formattedMessages,
      stream: true
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

    yield* readProviderText(response, 'openai', payload.signal)
  }
}
