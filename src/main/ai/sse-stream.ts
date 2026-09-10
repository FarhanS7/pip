import { AIProviderError } from '../errors'

const streamError = () => new AIProviderError('AI_STREAM_FAILED', 'The AI response could not complete. Please try again.')

/** Decode bounded SSE events across arbitrary UTF-8 and network chunk boundaries. */
export async function* readSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = '', data: string[] = []
  let received = 0, eventLength = 0
  const deadline = Date.now() + 120000
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal?.throwIfAborted()
      if (Date.now() >= deadline) throw streamError()
      let timer!: ReturnType<typeof setTimeout>
      const timedOut = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { reject(streamError()); abort() }, Math.min(30000, deadline - Date.now())) })
      let item: Awaited<ReturnType<typeof reader.read>>
      try { item = await Promise.race([reader.read(), timedOut]) } finally { clearTimeout(timer) }
      signal?.throwIfAborted()
      if (item.value) {
        received += item.value.byteLength
        if (received > 2 * 1024 * 1024) throw streamError()
      }
      buffer += item.done ? decoder.decode() : decoder.decode(item.value, { stream: true })
      if (item.done && buffer && !buffer.endsWith('\n')) buffer += '\n'
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        if (!line) {
          if (data.length) yield data.join('\n')
          data = []; eventLength = 0
        } else if (line.startsWith('data:')) {
          const value = line.slice(5).replace(/^ /, '')
          eventLength += value.length
          if (eventLength > 65536) throw streamError()
          data.push(value)
        }
      }
      if (buffer.length > 65536) throw streamError()
      if (item.done) { if (data.length) yield data.join('\n'); break }
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {}); reader.releaseLock()
  }
}

export async function* readProviderText(response: Response, provider: 'claude' | 'openai' | 'gemini', signal?: AbortSignal): AsyncGenerator<string> {
  if (!response.ok || !response.body) {
    let message = 'The AI response could not complete. Please try again.'
    try {
      const errText = await response.text()
      const parsed = JSON.parse(errText) as { error?: string }
      if (parsed?.error) message = String(parsed.error)
    } catch { /* use default */ }
    throw new AIProviderError('AI_STREAM_FAILED', message)
  }
  let complete = false
  for await (const data of readSse(response.body, signal)) {
    if (data === '[DONE]') { complete = true; break }
    let record: Record<string, unknown>
    try { record = JSON.parse(data) } catch { throw streamError() }
    if (!record || typeof record !== 'object' || record.error || record.type === 'error') throw streamError()
    if (provider === 'claude') {
      if (record.type === 'message_stop') { complete = true; break }
      const delta = record.delta as { text?: unknown } | undefined
      if (record.type === 'content_block_delta' && typeof delta?.text === 'string') yield delta.text
    } else if (provider === 'openai') {
      const choices = record.choices as { delta?: { content?: unknown }; finish_reason?: unknown }[] | undefined
      const content = choices?.[0]?.delta?.content
      if (typeof content === 'string') yield content
      if (choices?.[0]?.finish_reason && choices[0].finish_reason !== 'stop') throw streamError()
    } else {
      const candidates = record.candidates as { content?: { parts?: { text?: unknown }[] }; finishReason?: unknown }[] | undefined
      for (const part of candidates?.[0]?.content?.parts ?? []) if (typeof part.text === 'string') yield part.text
      if (candidates?.[0]?.finishReason) {
        if (candidates[0].finishReason !== 'STOP') throw streamError()
        complete = true
      }
      if ((record.promptFeedback as { blockReason?: unknown } | undefined)?.blockReason) throw streamError()
    }
  }
  if (!complete) throw streamError()
}
