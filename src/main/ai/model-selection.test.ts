import { describe, it, expect, vi, afterEach } from 'vitest'
import { createAIProvider } from './ai-provider'

afterEach(() => vi.unstubAllGlobals())
describe('Selected model transport', () => {
  it.each(['claude', 'openai', 'gemini'] as const)('sends the selected %s model to the proxy', async provider => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('data: [DONE]\n\n', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    for await (const _chunk of createAIProvider(provider, 'fixture-custom-model').streamChat({ messages: [{ role: 'user', content: 'fixture' }], signal: controller.signal })) { /* drain */ }
    expect(fetch.mock.calls[0][1]!.signal).toBe(controller.signal)
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({ model: 'fixture-custom-model' })
  })
})
