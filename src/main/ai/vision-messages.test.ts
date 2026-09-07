import { describe, expect, it, vi, afterEach } from 'vitest'
import { createAIProvider } from './ai-provider'
afterEach(() => vi.unstubAllGlobals())
describe('Multi-display vision requests', () => {
  it.each(['claude', 'openai', 'gemini'] as const)('attaches labeled images once to the latest %s request', async provider => {
    const fetch = vi.fn().mockResolvedValue(new Response(''))
    vi.stubGlobal('fetch', fetch)
    for await (const _chunk of createAIProvider(provider).streamChat({
      messages: [{ role: 'user', content: 'old question' }, { role: 'assistant', content: 'old answer' }, { role: 'user', content: 'current question' }],
      images: [{ screenIndex: 0, jpegBase64: 'Zmlyc3Q=' }, { screenIndex: 2, jpegBase64: 'c2Vjb25k' }]
    })) { /* consume fixture */ }
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    const entries = (provider === 'gemini' ? body.contents : body.messages).filter((entry: { role: string }) => entry.role !== 'system')
    expect(JSON.stringify(entries[0])).not.toContain('Zmlyc3Q=')
    expect(JSON.stringify(entries[1])).not.toContain('c2Vjb25k')
    const current = JSON.stringify(entries[2])
    expect(current.match(/Zmlyc3Q=/g)).toHaveLength(1)
    expect(current.match(/c2Vjb25k/g)).toHaveLength(1)
    expect(current).toContain('Screen 1'); expect(current).toContain('Screen 3')
  })
  it('rejects too many screenshots before calling the proxy', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const stream = createAIProvider('claude').streamChat({ messages: [{ role: 'user', content: 'question' }], images: Array.from({ length: 5 }, (_, screenIndex) => ({ screenIndex, jpegBase64: 'Zg==' })) })
    await expect(stream.next()).rejects.toThrow('screenshot')
    expect(fetch).not.toHaveBeenCalled()
  })
})
