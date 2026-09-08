import { readProviderText } from './sse-stream'
import { visionMessages } from './vision-messages'
/**
 * Claude Vision Streaming Provider (Task C.2)
 *
 * Implements AIProvider for Anthropic Claude vision chat streaming.
 * Calls Worker /chat proxy with SSE streaming and X-Pip-Auth authentication.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/ai module)
 *   PHASE_1_MODULES_AND_TASKS.md Task C.2 scoped checklist
 */

import { AIProvider, VisionPromptPayload } from './ai-provider'
import { AIProviderError } from '../errors'
import { buildSystemPrompt } from './system-prompt-builder'
import { createLogger } from '../logger'
import { getAppConfig } from '../config'

const log = createLogger('claude-provider')

export class ClaudeProvider implements AIProvider {
  public readonly name = 'claude'
  public readonly displayName = 'Anthropic Claude'
  public readonly defaultModel = 'claude-sonnet-5'

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
    log.info('Starting Claude vision chat stream')

    const systemPrompt = payload.systemPrompt || buildSystemPrompt({
      accessibilityTreeText: payload.accessibilityTreeText
    })

    // Construct Anthropic messages format
    const formattedMessages = visionMessages(payload, 'claude')

    const requestBody = {
      model: this.model || this.defaultModel,
      max_tokens: 1024,
      system: systemPrompt,
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

    yield* readProviderText(response, 'claude', payload.signal)
  }
}
