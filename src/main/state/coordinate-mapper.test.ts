import { describe, it, expect } from 'vitest'
import { mapToGlobalScreenCoordinates } from './coordinate-mapper'
import { DisplayInfo } from '../ai/system-prompt-builder'

describe('mapToGlobalScreenCoordinates', () => {
  const displays: DisplayInfo[] = [
    { displayId: 1, screenIndex: 0, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true },
    { displayId: 2, screenIndex: 1, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
  ]

  it('maps coordinates for primary display (screen 0)', () => {
    const result = mapToGlobalScreenCoordinates({ x: 500, y: 300 }, 0, displays)
    expect(result).toEqual({
      globalX: 500,
      globalY: 300,
      localX: 500,
      localY: 300,
      screenIndex: 0,
      displayId: 1
    })
  })

  it('maps coordinates for secondary display (screen 1) offset by origin x', () => {
    const result = mapToGlobalScreenCoordinates({ x: 500, y: 300 }, 1, displays)
    expect(result).toEqual({
      globalX: 2420, // 500 + 1920
      globalY: 300,
      localX: 500,
      localY: 300,
      screenIndex: 1,
      displayId: 2
    })
  })

  it('falls back to primary display if screen index out of range', () => {
    const result = mapToGlobalScreenCoordinates({ x: 100, y: 100 }, 99, displays)
    expect(result.displayId).toBe(1)
    expect(result.globalX).toBe(100)
  })
})
