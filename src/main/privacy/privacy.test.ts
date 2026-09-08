import { describe, it, expect } from 'vitest'
import {
  getCapturePolicy,
  pauseCapture,
  resumeCapture,
  blockCapture,
  setStrictMode,
  isCaptureAllowed
} from './capture-policy'
import {
  extractProtectedRegions,
  sanitizeAccessibilityText,
  applyMaskingToBase64
} from './field-masking'
import { AccessibilitySnapshot } from '../accessibility/accessibility-adapter'

describe('Capture Policy (Task B25)', () => {
  it('manages capture state transitions', () => {
    resumeCapture()
    expect(isCaptureAllowed()).toBe(true)
    expect(getCapturePolicy().state).toBe('active')

    pauseCapture('lock-screen')
    expect(isCaptureAllowed()).toBe(false)
    expect(getCapturePolicy().state).toBe('paused')
    expect(getCapturePolicy().reason).toBe('lock-screen')

    resumeCapture()
    expect(isCaptureAllowed()).toBe(true)

    blockCapture('strict-protection-failed')
    expect(isCaptureAllowed()).toBe(false)
    expect(getCapturePolicy().state).toBe('blocked')

    // Pause/resume are ignored when state is blocked
    pauseCapture('user-toggle')
    expect(getCapturePolicy().state).toBe('blocked')
    resumeCapture()
    expect(getCapturePolicy().state).toBe('blocked')
  })

  it('handles strict mode configuration', () => {
    setStrictMode(true)
    expect(getCapturePolicy().strictMode).toBe(true)
    setStrictMode(false)
    expect(getCapturePolicy().strictMode).toBe(false)
  })
})

describe('Field & Region Masking (Task B24)', () => {
  it('extracts protected password input fields from accessibility snapshot', () => {
    const mockSnapshot: AccessibilitySnapshot = {
      timestamp: Date.now(),
      truncated: false,
      elements: [
        {
          role: 'window',
          name: 'Login Screen',
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          isProtected: false,
          children: [
            {
              role: 'edit',
              name: 'Username',
              bounds: { x: 100, y: 100, width: 200, height: 30 },
              isProtected: false
            },
            {
              role: 'edit',
              name: 'Password',
              bounds: { x: 100, y: 150, width: 200, height: 30 },
              isProtected: true
            }
          ]
        }
      ]
    }

    const regions = extractProtectedRegions(mockSnapshot, [
      { x: 10, y: 10, width: 50, height: 50, reason: 'user-defined' }
    ])

    expect(regions).toHaveLength(2)
    expect(regions[0]).toEqual({ x: 10, y: 10, width: 50, height: 50, reason: 'user-defined' })
    expect(regions[1]).toEqual({ x: 100, y: 150, width: 200, height: 30, reason: 'password' })
  })

  it('sanitizes accessibility tree text by stripping password tags', () => {
    const raw = 'Header info [password]secret_pass123[/password] trailing text'
    const sanitized = sanitizeAccessibilityText(raw)
    expect(sanitized).toBe('Header info [REDACTED] trailing text')
    expect(sanitized).not.toContain('secret_pass123')
  })

  it('applies masking transformation to base64 images without throwing', () => {
    const fakeImage = 'data:image/jpeg;base64,12345'
    const masked = applyMaskingToBase64(fakeImage, [{ x: 0, y: 0, width: 10, height: 10, reason: 'password' }], { width: 100, height: 100 })
    expect(masked).toBe(fakeImage)
  })
})
