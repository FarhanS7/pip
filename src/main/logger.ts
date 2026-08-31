/**
 * Structured Logger Factory
 *
 * Creates module-scoped loggers with consistent format:
 *   [TIMESTAMP] [LEVEL] [MODULE] message { ...context }
 *
 * Level rules (from PHASE_0_ARCHITECTURE.md §0.4):
 *   ERROR — something failed that the user will notice (API error, mic failure)
 *   WARN  — something degraded but the app still works (fallback provider used)
 *   INFO  — significant lifecycle events (session started, provider switched)
 *   DEBUG — internal state changes (transcript chunk received, audio level)
 */

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  error(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  debug(message: string, context?: LogContext): void
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatLogLine(level: LogLevel, moduleName: string, message: string, context?: LogContext): string {
  const timestamp = formatTimestamp()
  const contextString = context && Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : ''
  return `[${timestamp}] [${level}] [${moduleName}] ${message}${contextString}`
}

/**
 * Create a logger scoped to a specific module.
 *
 * @param moduleName - The module name (e.g. 'audio', 'ai', 'shell')
 * @returns A Logger instance with error, warn, info, and debug methods
 *
 * @example
 * ```ts
 * import { createLogger } from './logger'
 * const log = createLogger('audio')
 * log.info('Session started', { provider: 'assemblyai' })
 * log.error('Mic access denied', { code: 'MIC_PERMISSION_DENIED' })
 * ```
 */
export function createLogger(moduleName: string): Logger {
  return {
    error(message: string, context?: LogContext): void {
      console.error(formatLogLine('ERROR', moduleName, message, context))
    },
    warn(message: string, context?: LogContext): void {
      console.warn(formatLogLine('WARN', moduleName, message, context))
    },
    info(message: string, context?: LogContext): void {
      console.log(formatLogLine('INFO', moduleName, message, context))
    },
    debug(message: string, context?: LogContext): void {
      console.debug(formatLogLine('DEBUG', moduleName, message, context))
    }
  }
}
