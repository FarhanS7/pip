import type { DisplayInfo } from '../ai/system-prompt-builder'
export interface Point { x: number; y: number }
export interface MappedPoint {
  globalX: number; globalY: number; localX: number; localY: number; screenIndex: number; displayId: number
}

/** Screenshot pixels -> display-local DIP -> global desktop DIP. Never guess a display. */
export function mapToGlobalScreenCoordinates(point: Point, index: number, displays: DisplayInfo[]): MappedPoint | null {
  const display = displays.find(item => item.screenIndex === index)
  if (!display || !Number.isSafeInteger(index) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  const size = display.imageSize
  if (!size || size.width <= 0 || size.height <= 0 || point.x < 0 || point.y < 0 || point.x >= size.width || point.y >= size.height) return null
  const bounds = display.bounds
  if (![bounds.x, bounds.y, bounds.width, bounds.height, size.width, size.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null
  const localX = Math.min(bounds.width - 1, Math.round(point.x * bounds.width / size.width))
  const localY = Math.min(bounds.height - 1, Math.round(point.y * bounds.height / size.height))
  return { globalX: localX + bounds.x, globalY: localY + bounds.y, localX, localY, screenIndex: index, displayId: display.displayId }
}
