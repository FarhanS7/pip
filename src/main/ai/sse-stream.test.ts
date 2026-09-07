import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSse, readProviderText } from './sse-stream'
const collect = async (stream: AsyncIterable<string>) => { const values: string[] = []; for await (const value of stream) values.push(value); return values }
afterEach(() => vi.useRealTimers())
describe('Bounded SSE decoding', () => {
  it('preserves UTF-8 split into individual bytes and multiline data with CRLF', async () => {
    const bytes = new TextEncoder().encode('data: h\u00e9llo\r\ndata: world\r\n\r\ndata:last')
    const body = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } })
    expect(await collect(readSse(body))).toEqual(['h\u00e9llo\nworld', 'last'])
  })
  it('rejects oversized events and cancels their source', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('data:' + 'x'.repeat(65537))) }, cancel })
    await expect(collect(readSse(body))).rejects.toThrow()
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('releases a stalled source on cancellation or timeout', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const cancel = vi.fn()
    const cancelled = expect(collect(readSse(new ReadableStream({ cancel }), controller.signal))).rejects.toThrow()
    controller.abort(); await cancelled
    expect(cancel).toHaveBeenCalledOnce()
    const timeout = expect(collect(readSse(new ReadableStream()))).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(30000); await timeout
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each(['data: {bad}\n\n', 'data: {"error":{"message":"sensitive"}}\n\n', 'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'])('rejects corrupt, error or incomplete streams', async body => {
    await expect(collect(readProviderText(new Response(body), 'openai'))).rejects.toThrow('could not complete')
  })
  it('decodes each provider and requires completion', async () => {
    expect(await collect(readProviderText(new Response('data:{"type":"content_block_delta","delta":{"text":"Claude"}}\n\ndata:{"type":"message_stop"}\n\n'), 'claude'))).toEqual(['Claude'])
    expect(await collect(readProviderText(new Response('data:{"choices":[{"delta":{"content":"OpenAI"}}]}\n\ndata:[DONE]'), 'openai'))).toEqual(['OpenAI'])
    expect(await collect(readProviderText(new Response('data:{"candidates":[{"content":{"parts":[{"text":"one"},{"text":"two"}]},"finishReason":"STOP"}]}'), 'gemini'))).toEqual(['one', 'two'])
  })
})
