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
 * Apply black rectangle masking to a JPEG base64 image buffer using Electron's nativeImage.
 */
import * as electronModule from 'electron'

export function applyMaskingToBase64(
  jpegBase64: string,
  regions: MaskRegion[],
  _imageSize?: { width: number; height: number }
): string {
  if (!jpegBase64 || regions.length === 0) return jpegBase64

  log.info('Applying pixel masking to protected regions', {
    count: regions.length,
    reasons: regions.map(r => r.reason)
  })

  try {
    const nativeImage = electronModule.nativeImage
    if (!nativeImage || typeof nativeImage.createFromBuffer !== 'function') {
      log.debug('nativeImage unavailable, skipping pixel manipulation')
      return jpegBase64
    }

    const img = nativeImage.createFromBuffer(Buffer.from(jpegBase64, 'base64'))
    const size = img.getSize()
    if (size.width === 0 || size.height === 0) return jpegBase64

    const bitmap = img.toBitmap()
    const imgWidth = size.width
    const imgHeight = size.height

    for (const region of regions) {
      const startX = Math.max(0, Math.min(imgWidth, Math.round(region.x)))
      const startY = Math.max(0, Math.min(imgHeight, Math.round(region.y)))
      const endX = Math.max(0, Math.min(imgWidth, Math.round(region.x + region.width)))
      const endY = Math.max(0, Math.min(imgHeight, Math.round(region.y + region.height)))

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * imgWidth + x) * 4
          bitmap[idx] = 0       // Red
          bitmap[idx + 1] = 0   // Green
          bitmap[idx + 2] = 0   // Blue
          bitmap[idx + 3] = 255 // Alpha
        }
      }
    }

    const maskedImg = nativeImage.createFromBitmap(bitmap, { width: imgWidth, height: imgHeight })
    return maskedImg.toJPEG(90).toString('base64')
  } catch (error) {
    log.error('Pixel masking failed', { error: String(error) })
    return jpegBase64
  }
}

/**
 * Strip password values from accessibility tree text.
 */
export function sanitizeAccessibilityText(text: string): string {
  // Remove any content between password field markers
  return text.replace(/\[password\].*?\[\/password\]/gi, '[REDACTED]')
}
