import { describe, it, expect } from 'vitest'
import { mapToGlobalScreenCoordinates } from './coordinate-mapper'
import type { DisplayInfo } from '../ai/system-prompt-builder'
const displays: DisplayInfo[] = [
  { displayId: 1, screenIndex: 0, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, imageSize: { width: 1280, height: 720 }, isPrimary: true },
  { displayId: 2, screenIndex: 1, bounds: { x: -1440, y: -240, width: 1440, height: 2560 }, imageSize: { width: 720, height: 1280 } }
]
describe('Screenshot coordinate mapping', () => {
  it('scales resized screenshots into desktop DIP without multiplying by DPI twice', () => {
    expect(mapToGlobalScreenCoordinates({ x: 640, y: 360 }, 0, displays)).toMatchObject({ globalX: 960, globalY: 540 })
  })
  it('handles portrait displays and negative desktop origins', () => {
    expect(mapToGlobalScreenCoordinates({ x: 360, y: 640 }, 1, displays)).toEqual({ globalX: -720, globalY: 1040, localX: 720, localY: 1280, displayId: 2, screenIndex: 1 })
  })
  it('rejects unavailable displays and out-of-image or nonfinite points', () => {
    expect(mapToGlobalScreenCoordinates({ x: 100, y: 100 }, 99, displays)).toBeNull()
    for (const x of [-1, 1280, Infinity, NaN]) expect(mapToGlobalScreenCoordinates({ x, y: 0 }, 0, displays)).toBeNull()
    expect(mapToGlobalScreenCoordinates({ x: 0, y: 0 }, 0, [])).toBeNull()
  })
})
