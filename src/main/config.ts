/**
 * Centralized App Configuration (Task B06)
 *
 * Provides runtime environment detection, worker URL configuration,
 * and secret access across main process services and providers.
 */

export interface AppConfig {
  workerUrl: string
  sharedSecret: string
  env: 'dev' | 'staging' | 'production'
}

let cachedConfig: Readonly<AppConfig> | null = null

export function getAppConfig(): Readonly<AppConfig> {
  if (cachedConfig) {
    return cachedConfig
  }

  const rawEnv = process.env.PIP_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'dev')
  const env: AppConfig['env'] = rawEnv === 'staging' || rawEnv === 'production' ? rawEnv : 'dev'

  const defaultWorkerUrl = env === 'production'
    ? 'https://pip-proxy.workers.dev'
    : env === 'staging'
      ? 'https://pip-proxy-staging.workers.dev'
      : 'http://127.0.0.1:8787'

  const workerUrl = (process.env.PIP_WORKER_URL || defaultWorkerUrl).replace(/\/+$/, '')
  const sharedSecret = process.env.PIP_SHARED_SECRET || ''

  cachedConfig = Object.freeze({
    workerUrl,
    sharedSecret,
    env
  })

  return cachedConfig
}

/**
 * Resets cached configuration (for test isolation).
 */
export function resetAppConfigForTesting(): void {
  cachedConfig = null
}
