import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAppConfig, resetAppConfigForTesting } from './config'

afterEach(() => {
  resetAppConfigForTesting()
  vi.unstubAllEnvs()
})

describe('Centralized App Configuration (B06)', () => {
  it('returns default dev worker URL when no env vars are set', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('PIP_WORKER_URL', '')
    vi.stubEnv('PIP_ENV', '')

    const config = getAppConfig()
    expect(config.env).toBe('dev')
    expect(config.workerUrl).toBe('http://127.0.0.1:8787')
    expect(config.sharedSecret).toBe('pip-dev-secret-key-2026')
  })

  it('respects PIP_WORKER_URL override and strips trailing slashes', () => {
    vi.stubEnv('PIP_WORKER_URL', 'https://custom-worker.example.com///')

    const config = getAppConfig()
    expect(config.workerUrl).toBe('https://custom-worker.example.com')
  })

  it('uses staging defaults when PIP_ENV is set to staging', () => {
    vi.stubEnv('PIP_ENV', 'staging')
    vi.stubEnv('PIP_WORKER_URL', '')

    const config = getAppConfig()
    expect(config.env).toBe('staging')
    expect(config.workerUrl).toBe('https://pip-proxy-staging.workers.dev')
  })

  it('uses production defaults when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PIP_ENV', '')
    vi.stubEnv('PIP_WORKER_URL', '')

    const config = getAppConfig()
    expect(config.env).toBe('production')
    expect(config.workerUrl).toBe('https://pip-proxy.workers.dev')
  })
})
