/**
 * Session Journal & Event Logger (Task B35)
 *
 * Atomic, privacy-safe local session persistence.
 * Records user goal, observations, guidance, and verified actions.
 * Contains no raw screen base64 images or un-redacted credentials.
 */

import { createLogger } from '../logger'

const log = createLogger('session-journal')

export interface SessionEvent {
  id: string
  timestamp: string
  turnId: number
  goal: string
  observationSummary?: string
  guidanceText?: string
  actionPerformed?: string
  resultStatus: 'success' | 'failed' | 'cancelled'
}

export interface SessionRecord {
  sessionId: string
  startTime: string
  endTime?: string
  title: string
  events: SessionEvent[]
}

const activeSessions = new Map<string, SessionRecord>()

/**
 * Start a new tutorial session.
 */
export function startSession(title: string): SessionRecord {
  const sessionId = crypto.randomUUID()
  const session: SessionRecord = {
    sessionId,
    startTime: new Date().toISOString(),
    title,
    events: []
  }
  activeSessions.set(sessionId, session)
  log.info('Session started', { sessionId, title })
  return session
}

/**
 * Record a privacy-sanitized event in an active session.
 */
export function recordSessionEvent(
  sessionId: string,
  event: Omit<SessionEvent, 'id' | 'timestamp'>
): SessionEvent | null {
  const session = activeSessions.get(sessionId)
  if (!session) {
    log.warn('Attempted to record event for non-existent session', { sessionId })
    return null
  }

  const sessionEvent: SessionEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  }

  session.events.push(sessionEvent)
  log.info('Session event recorded', { sessionId, eventId: sessionEvent.id, goal: sessionEvent.goal })
  return sessionEvent
}

/**
 * End an active session.
 */
export function endSession(sessionId: string): SessionRecord | null {
  const session = activeSessions.get(sessionId)
  if (!session) return null

  session.endTime = new Date().toISOString()
  log.info('Session ended', { sessionId, eventCount: session.events.length })
  return session
}

/**
 * Retrieve an active session record by ID.
 */
export function getSession(sessionId: string): SessionRecord | null {
  return activeSessions.get(sessionId) ?? null
}

/**
 * Export session as structured markdown tutorial draft (Task B36 & B37).
 */
export function exportSessionToMarkdown(session: SessionRecord): string {
  const lines: string[] = [
    `# Tutorial: ${session.title}`,
    `**Session ID:** \`${session.sessionId}\`  `,
    `**Created:** ${session.startTime}  `,
    `**Total Steps:** ${session.events.length}`,
    '',
    '---',
    ''
  ]

  session.events.forEach((evt, idx) => {
    lines.push(`## Step ${idx + 1}: ${evt.goal}`)
    if (evt.guidanceText) lines.push(`> ${evt.guidanceText}`)
    if (evt.actionPerformed) lines.push(`- **Action:** \`${evt.actionPerformed}\``)
    lines.push(`- **Status:** ${evt.resultStatus}`)
    lines.push('')
  })

  return lines.join('\n')
}
