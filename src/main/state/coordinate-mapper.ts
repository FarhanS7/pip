/**
 * Multi-Monitor Coordinate Mapper (Task F.5)
 *
 * Transforms local display image point coordinates into global desktop screen coordinates.
 * Formula:
 *   globalX = localX + display.bounds.x
 *   globalY = localY + display.bounds.y
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/state module)
 *   PHASE_1_MODULES_AND_TASKS.md Task F.5 scoped checklist
 */

import { DisplayInfo } from '../ai/system-prompt-builder'

export interface Point {
  x: number
  y: number
}

export interface MappedPoint {
  globalX: number
  globalY: number
  localX: number
  localY: number
  screenIndex: number
  displayId: number
}

/**
 * Maps local display coordinates to global desktop coordinates.
 *
 * @param localPoint - Target point relative to the display image (0,0 top-left of display)
 * @param targetScreenIndex - 0-based screen index (or target screen index)
 * @param displays - List of connected display infos
 * @returns MappedPoint object containing both local and global screen coordinates
 */
export function mapToGlobalScreenCoordinates(
  localPoint: Point,
  targetScreenIndex: number,
  displays: DisplayInfo[]
): MappedPoint {
  if (!displays || displays.length === 0) {
    // Default fallback if display list is empty
    return {
      globalX: localPoint.x,
      globalY: localPoint.y,
      localX: localPoint.x,
      localY: localPoint.y,
      screenIndex: 0,
      displayId: 0
    }
  }

  // Find target display by screen index, fallback to primary or first display
  const targetDisplay = displays.find(d => d.screenIndex === targetScreenIndex)
    ?? displays.find(d => d.isPrimary)
    ?? displays[0]

  const bounds = targetDisplay.bounds ?? { x: 0, y: 0, width: 1920, height: 1080 }

  const globalX = Math.round(localPoint.x + bounds.x)
  const globalY = Math.round(localPoint.y + bounds.y)

  return {
    globalX,
    globalY,
    localX: localPoint.x,
    localY: localPoint.y,
    screenIndex: targetDisplay.screenIndex,
    displayId: targetDisplay.displayId
  }
}
