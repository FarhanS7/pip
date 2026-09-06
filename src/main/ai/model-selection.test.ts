import { describe, it, expect, vi, afterEach } from 'vitest'
import { createAIProvider } from './ai-provider'

afterEach(() => vi.unstubAllGlobals())
describe('Selected model transport', () => {
  it.each(['claude', 'openai', 'gemini'] as const)('sends the selected %s model to the proxy', async provider => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    for await (const _chunk of createAIProvider(provider, 'fixture-custom-model').streamChat({ messages: [{ role: 'user', content: 'fixture' }] })) { /* drain */ }
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({ model: 'fixture-custom-model' })
  })
})
