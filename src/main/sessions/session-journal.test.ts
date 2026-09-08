import { describe, it, expect } from 'vitest'
import {
  startSession,
  recordSessionEvent,
  endSession,
  getSession,
  exportSessionToMarkdown
} from './session-journal'

describe('Session Journal & Tutorial Generator (Task B35-B37)', () => {
  it('manages session lifecycle and event logging', () => {
    const session = startSession('Opening Chrome Browser')
    expect(session.title).toBe('Opening Chrome Browser')
    expect(session.events).toHaveLength(0)

    const event = recordSessionEvent(session.sessionId, {
      turnId: 1,
      goal: 'Click on Chrome icon on taskbar',
      guidanceText: 'Click the colored wheel icon on your bottom taskbar',
      actionPerformed: 'Click (POINT: 450, 1040)',
      resultStatus: 'success'
    })

    expect(event).not.toBeNull()
    expect(event?.goal).toBe('Click on Chrome icon on taskbar')

    const fetched = getSession(session.sessionId)
    expect(fetched?.events).toHaveLength(1)

    const ended = endSession(session.sessionId)
    expect(ended?.endTime).toBeDefined()
  })

  it('exports session to clean tutorial markdown format', () => {
    const session = startSession('File Explorer Search')
    recordSessionEvent(session.sessionId, {
      turnId: 1,
      goal: 'Open Downloads folder',
      guidanceText: 'Double click Downloads in the left navigation pane',
      resultStatus: 'success'
    })

    const md = exportSessionToMarkdown(session)
    expect(md).toContain('# Tutorial: File Explorer Search')
    expect(md).toContain('## Step 1: Open Downloads folder')
    expect(md).toContain('> Double click Downloads in the left navigation pane')
  })
})
