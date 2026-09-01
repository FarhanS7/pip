import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './system-prompt-builder'

describe('buildSystemPrompt', () => {
  it('builds system prompt with display geometry and point tag rules', () => {
    const prompt = buildSystemPrompt({
      displays: [
        { displayId: 10, screenIndex: 0, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true },
        { displayId: 20, screenIndex: 1, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
      ]
    })

    expect(prompt).toContain('Pip, an intelligent AI screen companion')
    expect(prompt).toContain('Screen 1 (ID: 10): 1920x1080 at origin (0, 0) [Primary]')
    expect(prompt).toContain('Screen 2 (ID: 20): 1920x1080 at origin (1920, 0)')
    expect(prompt).toContain('[POINT:x,y:element_label]')
    expect(prompt).toContain('[POINT:none]')
  })

  it('includes accessibility tree context when provided', () => {
    const prompt = buildSystemPrompt({
      accessibilityTreeText: 'Button "Submit" at (100, 200)'
    })

    expect(prompt).toContain('=== ACCESSIBILITY TREE CONTEXT ===')
    expect(prompt).toContain('Button "Submit" at (100, 200)')
  })
})
