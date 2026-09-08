import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Miniflare, Response as MiniflareResponse } from 'miniflare'
import ts from 'typescript'

const secret = 'test-only-random-looking-credential-7f2f0a'

function transpile(filePath: string): string {
  return ts.transpileModule(readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
}

const modules = [
  { type: 'ESModule' as const, path: 'index.js', contents: transpile('worker/src/index.ts') },
  { type: 'ESModule' as const, path: 'validation.js', contents: transpile('worker/src/validation.ts') }
]

let worker: Miniflare | undefined
const upstream = vi.fn(async () => new MiniflareResponse('{"status":"ok"}', {
  headers: { 'content-type': 'application/json' }
}))

function createWorker(): Miniflare {
  worker = new Miniflare({
    modules,
    scriptPath: 'index.js',
    compatibilityDate: '2024-01-01',
    bindings: {
      ANTHROPIC_API_KEY: 'fixture-anthropic-key-sk-123456789012345678901234',
      OPENAI_API_KEY: 'fixture-openai-key-sk-123456789012345678901234',
      GOOGLE_AI_KEY: 'fixture-google-key-AIzaSy123456789012345678901234567890123',
      ELEVENLABS_API_KEY: 'fixture-elevenlabs-key-xi-12345678901234567890123456789012',
      ASSEMBLYAI_API_KEY: 'fixture-assembly-key',
      PIP_SHARED_SECRET: secret
    },
    outboundService: upstream
  })
  return worker
}

afterEach(async () => {
  await worker?.dispose()
  worker = undefined
  upstream.mockClear()
})

describe('Worker request validation and proxy bounds (B05)', () => {
  it('rejects malformed JSON body with 400 Bad Request', async () => {
    const runtime = createWorker()
    const response = await runtime.dispatchFetch('http://localhost/chat', {
      method: 'POST',
      headers: { 'X-Pip-Auth': secret, 'content-type': 'application/json' },
      body: 'invalid-json-body{{'
    })
    expect(response.status).toBe(400)
    const json = await response.json() as { error: string }
    expect(json.error).toContain('Invalid JSON payload')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects unsupported chat provider with 400 Bad Request', async () => {
    const runtime = createWorker()
    const response = await runtime.dispatchFetch('http://localhost/chat', {
      method: 'POST',
      headers: { 'X-Pip-Auth': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'unsupported-ai-provider', model: 'gpt-4o' })
    })
    expect(response.status).toBe(400)
    const json = await response.json() as { error: string }
    expect(json.error).toContain('Unsupported AI provider')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects disallowed model for provider with 400 Bad Request', async () => {
    const runtime = createWorker()
    const response = await runtime.dispatchFetch('http://localhost/chat', {
      method: 'POST',
      headers: { 'X-Pip-Auth': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'claude', model: 'gpt-4o' })
    })
    expect(response.status).toBe(400)
    const json = await response.json() as { error: string }
    expect(json.error).toContain("Model 'gpt-4o' is not allowed for provider 'claude'")
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects invalid voice ID format on /tts with 400 Bad Request', async () => {
    const runtime = createWorker()
    const response = await runtime.dispatchFetch('http://localhost/tts', {
      method: 'POST',
      headers: { 'X-Pip-Auth': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'elevenlabs', voiceId: 'invalid voice id with spaces!' })
    })
    expect(response.status).toBe(400)
    const json = await response.json() as { error: string }
    expect(json.error).toContain('Invalid voice ID format')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('passes request ID header and returns X-Request-ID in response', async () => {
    const runtime = createWorker()
    const customReqId = 'custom-request-id-999'
    const response = await runtime.dispatchFetch('http://localhost/chat', {
      method: 'POST',
      headers: {
        'X-Pip-Auth': secret,
        'X-Request-ID': customReqId,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4o', messages: [] })
    })
    expect(response.headers.get('X-Request-ID')).toBe(customReqId)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('fails Gemini requests directly without model hopping loop', async () => {
    upstream.mockResolvedValueOnce(new MiniflareResponse('Model quota exceeded', { status: 429 }))
    const runtime = createWorker()
    const response = await runtime.dispatchFetch('http://localhost/chat', {
      method: 'POST',
      headers: { 'X-Pip-Auth': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', model: 'gemini-3.6-flash' })
    })
    expect(response.status).toBe(429)
    // Should call upstream exactly ONCE (no looping over candidate models)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('sanitizes upstream error messages removing sensitive credential fragments', async () => {
    upstream.mockResolvedValueOnce(
      new MiniflareResponse('Error with key sk-123456789012345678901234 and AIzaSy123456789012345678901234567890123', { status: 400 })
    )
    const runtime = createWorker()
    const response = await runtime.dispatchFetch('http://localhost/chat', {
      method: 'POST',
      headers: { 'X-Pip-Auth': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', model: 'gemini-3.6-flash' })
    })
    const text = await response.text()
    expect(text).not.toContain('sk-123456789012345678901234')
    expect(text).not.toContain('AIzaSy123456789012345678901234567890123')
    expect(text).toContain('[REDACTED_KEY]')
  })
})
