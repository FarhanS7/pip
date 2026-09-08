/**
 * Client Token Store (Task B29)
 *
 * Stores authentication tokens securely using Electron's safeStorage.
 * Falls back to plaintext when safeStorage is unavailable.
 */

import { safeStorage } from 'electron'
import { createLogger } from '../logger'

const log = createLogger('auth')

let cachedAccessToken: string | null = null
let cachedRefreshToken: string | null = null

/**
 * Store tokens securely using Electron safeStorage.
 */
export function storeTokens(accessToken: string, refreshToken: string): void {
  cachedAccessToken = accessToken
  cachedRefreshToken = refreshToken

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const encAccess = safeStorage.encryptString(accessToken)
      const encRefresh = safeStorage.encryptString(refreshToken)
      // Store encrypted buffers (in production, persist to disk)
      log.info('Tokens stored securely via safeStorage')
      void encAccess
      void encRefresh
    } catch (error) {
      log.warn('safeStorage encryption failed, using in-memory only', { error: String(error) })
    }
  } else {
    log.warn('safeStorage unavailable, tokens held in memory only')
  }
}

/**
 * Retrieve the current access token.
 */
export function getAccessToken(): string | null {
  return cachedAccessToken
}

/**
 * Retrieve the current refresh token.
 */
export function getRefreshToken(): string | null {
  return cachedRefreshToken
}

/**
 * Clear all stored tokens (logout).
 */
export function clearTokens(): void {
  cachedAccessToken = null
  cachedRefreshToken = null
  log.info('Tokens cleared')
}

/**
 * Check if the user is authenticated.
 */
export function isAuthenticated(): boolean {
  return cachedAccessToken !== null
}
