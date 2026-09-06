import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Miniflare, Response as MiniflareResponse } from 'miniflare'
import ts from 'typescript'

const secret = 'test-only-random-looking-credential-7f2f0a'
const placeholder = 'your-shared-secret-placeholder'
const script = ts.transpileModule(readFileSync('worker/src/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText

const protectedRoutes = [
  { path: '/chat', method: 'POST' },
  { path: '/tts', method: 'POST' },
  { path: '/transcribe-token', method: 'POST' },
  { path: '/transcribe-token', method: 'GET' },
  { path: '/transcribe-token/', method: 'GET' }
]

let worker: Miniflare | undefined
const upstream = vi.fn(async () => new MiniflareResponse('{"token":"fixture-token"}', {
  headers: { 'content-type': 'application/json' }
}))

function createWorker(configuredSecret: string | null = secret): Miniflare {
  worker = new Miniflare({
    modules: true,
    script,
    compatibilityDate: '2024-01-01',
    bindings: {
      ANTHROPIC_API_KEY: 'fixture-only',
      ELEVENLABS_API_KEY: 'fixture-only',
      ASSEMBLYAI_API_KEY: 'fixture-only',
      ...(configuredSecret === null ? {} : { PIP_SHARED_SECRET: configuredSecret })
    },
    // All outbound traffic terminates here, including unexpected provider URLs.
    outboundService: upstream
  })
  return worker
}

afterEach(async () => {
  await worker?.dispose()
  worker = undefined
  upstream.mockClear()
})

describe('Worker authentication in the real Workers runtime', () => {
  it('keeps health public without exposing configuration', async () => {
    const response = await createWorker('').dispatchFetch('http://localhost/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', service: 'pip-proxy' })
    expect(upstream).not.toHaveBeenCalled()
  })

  it('keeps preflight public and does not call providers', async () => {
    const response = await createWorker('').dispatchFetch('http://localhost/chat', { method: 'OPTIONS' })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-headers')).toContain('X-Pip-Auth')
    expect(upstream).not.toHaveBeenCalled()
  })

  it.each([undefined, '', placeholder, 'incorrect-credential', `${secret}x`, `${secret.slice(0, -1)}0`])(
    'rejects invalid request credential %s on every paid route', async (credential) => {
      const runtime = createWorker()
      for (const route of protectedRoutes) {
        const response = await runtime.dispatchFetch(`http://localhost${route.path}`, {
          method: route.method,
          headers: credential === undefined ? {} : { 'X-Pip-Auth': credential },
          ...(route.method === 'POST' ? { body: '{}' } : {})
        })
        expect(response.status, `${route.method} ${route.path}`).toBe(401)
        expect(await response.text()).not.toContain(secret)
      }
      expect(upstream).not.toHaveBeenCalled()
    }
  )

  it.each([null, '', '   ', placeholder, ` ${placeholder} `])('fails closed for invalid server configuration %j', async (configured) => {
    const runtime = createWorker(configured)
    for (const route of protectedRoutes) {
      const response = await runtime.dispatchFetch(`http://localhost${route.path}`, {
        method: route.method,
        headers: { 'X-Pip-Auth': placeholder },
        ...(route.method === 'POST' ? { body: '{}' } : {})
      })
      expect(response.status).toBe(503)
    }
    expect(upstream).not.toHaveBeenCalled()
  })

  it.each(protectedRoutes)('preserves authorized $method $path', async (route) => {
    const response = await createWorker().dispatchFetch(`http://localhost${route.path}`, {
      method: route.method,
      headers: { 'X-Pip-Auth': secret },
      ...(route.method === 'POST' ? { body: '{}' } : {})
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ token: 'fixture-token' })
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('preserves provider error status and body for authorized callers', async () => {
    upstream.mockResolvedValueOnce(new MiniflareResponse('fixture rate limit', { status: 429 }))
    const response = await createWorker().dispatchFetch('http://localhost/chat', {
      method: 'POST', headers: { 'X-Pip-Auth': secret }, body: '{}'
    })
    expect(response.status).toBe(429)
    expect(await response.text()).toBe('fixture rate limit')
    expect(upstream).toHaveBeenCalledTimes(1)
  })
})
