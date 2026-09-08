/**
 * Privacy Field Masking (Task B24)
 *
 * Masks protected password fields and user-defined sensitive regions
 * in screenshots before they leave the device.
 */

import { AccessibilitySnapshot } from '../accessibility/accessibility-adapter'
import { createLogger } from '../logger'

const log = createLogger('privacy')

export interface MaskRegion {
  x: number
  y: number
  width: number
  height: number
  reason: 'password' | 'user-defined'
}

/**
 * Extract regions that must be masked from an accessibility snapshot.
 * Protected fields (password inputs) are automatically detected.
 */
export function extractProtectedRegions(
  snapshot: AccessibilitySnapshot | null,
  userRegions: MaskRegion[] = []
): MaskRegion[] {
  const regions: MaskRegion[] = [...userRegions]

  if (snapshot) {
    for (const el of snapshot.elements) {
      collectProtectedElements(el, regions)
    }
  }

  return regions
}

function collectProtectedElements(
  el: { role: string; name: string; bounds: { x: number; y: number; width: number; height: number }; isProtected: boolean; children?: typeof el[] },
  regions: MaskRegion[]
): void {
  if (el.isProtected && el.bounds.width > 0 && el.bounds.height > 0) {
    regions.push({
      x: el.bounds.x,
      y: el.bounds.y,
      width: el.bounds.width,
      height: el.bounds.height,
      reason: 'password'
    })
  }
  if (el.children) {
    for (const child of el.children) {
      collectProtectedElements(child, regions)
    }
  }
}

/**
 * Apply black rectangle masking to a JPEG base64 image buffer.
 * Regions are specified in the image's coordinate space.
 *
 * Note: For the initial implementation, we mark regions for masking
 * and strip the accessibility data. Full pixel-level masking requires
 * native image manipulation which will be added with the native helper.
 */
export function applyMaskingToBase64(
  jpegBase64: string,
  _regions: MaskRegion[],
  _imageSize: { width: number; height: number }
): string {
  // Phase 1: Return image as-is when no protected regions detected.
  // Full pixel masking via sharp/canvas will be added with the native helper (B23 full).
  // For now, the accessibility adapter already scrubs password VALUES from the tree text.
  if (_regions.length === 0) return jpegBase64

  log.info('Protected regions detected for masking', {
    count: _regions.length,
    reasons: _regions.map(r => r.reason)
  })

  // TODO B24-full: Apply actual pixel-level black rectangle masking using
  // Electron's nativeImage or a lightweight image processing library.
  // For now, we log that masking was requested but cannot modify pixels
  // without adding a native dependency. The accessibility text is already scrubbed.
  return jpegBase64
}

/**
 * Strip password values from accessibility tree text.
 */
export function sanitizeAccessibilityText(text: string): string {
  // Remove any content between password field markers
  return text.replace(/\[password\].*?\[\/password\]/gi, '[REDACTED]')
}
