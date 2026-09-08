/**
 * Redacted Diagnostics Bundle (Task B28)
 *
 * Collects redacted support information (no screen content, transcripts, or keys).
 */

import { app } from 'electron'
import { createLogger } from './logger'

const log = createLogger('diagnostics')

export interface DiagnosticsBundle {
  appVersion: string
  electronVersion: string
  platform: string
  arch: string
  locale: string
  timestamp: string
  uptimeSeconds: number
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number }
}

/**
 * Collect a redacted diagnostics bundle.
 * Contains no screen content, transcripts, API keys, or personal data.
 */
export function collectDiagnostics(): DiagnosticsBundle {
  const mem = process.memoryUsage()

  const bundle: DiagnosticsBundle = {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    arch: process.arch,
    locale: app.getLocale(),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsage: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024)
    }
  }

  log.info('Diagnostics bundle collected (redacted)')
  return bundle
}
