import { describe, it, expect } from 'vitest'
import {
  queryAccessibilityTree,
  formatAccessibilityForPrompt,
  AccessibilitySnapshot
} from './accessibility-adapter'

describe('Accessibility Adapter (Task B23)', () => {
  it('returns null or bounded snapshot on query', async () => {
    const snapshot = await queryAccessibilityTree()
    if (snapshot !== null) {
      expect(snapshot).toHaveProperty('timestamp')
      expect(Array.isArray(snapshot.elements)).toBe(true)
      expect(typeof snapshot.truncated).toBe('boolean')
    }
  })

  it('formats accessibility snapshot into prompt text cleanly', () => {
    const mockSnapshot: AccessibilitySnapshot = {
      timestamp: Date.now(),
      truncated: false,
      elements: [
        {
          role: 'window',
          name: 'Main App Window',
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          isProtected: false,
          children: [
            {
              role: 'button',
              name: 'Submit Button',
              bounds: { x: 500, y: 300, width: 100, height: 40 },
              isProtected: false
            },
            {
              role: 'edit',
              name: 'Password Input',
              bounds: { x: 500, y: 400, width: 200, height: 30 },
              isProtected: true
            }
          ]
        }
      ]
    }

    const text = formatAccessibilityForPrompt(mockSnapshot)
    expect(text).toContain('[window] "Main App Window"')
    expect(text).toContain('[button] "Submit Button"')
    expect(text).toContain('[edit] "Password Input" [PROTECTED]')
    expect(text).toContain('@ (500,400,200x30)')
  })

  it('handles empty or null snapshot in formatAccessibilityForPrompt', () => {
    expect(formatAccessibilityForPrompt(null)).toBe('')
    expect(formatAccessibilityForPrompt({ timestamp: Date.now(), elements: [], truncated: false })).toBe('')
  })
})
