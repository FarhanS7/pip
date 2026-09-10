/**
 * Multi-Monitor Screen Capture
 *
 * Captures full-screen JPEG images of all connected displays using Electron's `desktopCapturer`.
 * Downscales images to max 1280px longest edge at 80% JPEG quality for optimal AI vision token budget.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/screen module)
 *   PHASE_1_MODULES_AND_TASKS.md Task E.1 scoped checklist
 */

import { desktopCapturer, screen } from 'electron'
import { ScreenCaptureError } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('screen-capture')

export function displaySnapshotMatches(displays: { displayId: number; bounds: { x: number; y: number; width: number; height: number } }[]): boolean {
  const current = screen.getAllDisplays()
  return displays.every(snapshot => {
    const display = current.find(item => item.id === snapshot.displayId)
    return display && ['x', 'y', 'width', 'height'].every(key => display.bounds[key as keyof typeof display.bounds] === snapshot.bounds[key as keyof typeof snapshot.bounds])
  })
}

export interface CapturedDisplay {
  /** OS display ID */
  displayId: number
  /** 0-based screen index */
  screenIndex: number
  /** Screen bounds in global display space */
  bounds: { x: number; y: number; width: number; height: number }
  /** Base64-encoded JPEG image string */
  jpegBase64: string
  imageSize: { width: number; height: number }
  isPrimary: boolean
}

export interface ScreenCaptureOptions {
  /** Maximum length of the longest edge in pixels (default: 1280) */
  maxLongestEdge?: number
  /** JPEG quality from 1 to 100 (default: 80) */
  jpegQuality?: number
}

/**
 * Capture screenshots of all connected displays.
 *
 * @param options - Downscaling and quality options
 * @returns Array of CapturedDisplay objects, ordered by display index
 */
export async function captureAllScreens(
  options: ScreenCaptureOptions = {}
): Promise<CapturedDisplay[]> {
  const maxLongestEdge = options.maxLongestEdge ?? 1280
  const jpegQuality = options.jpegQuality ?? 80
  if (!Number.isInteger(maxLongestEdge) || maxLongestEdge < 64 || maxLongestEdge > 4096 ||
      !Number.isInteger(jpegQuality) || jpegQuality < 1 || jpegQuality > 100) throw new ScreenCaptureError('INVALID_CAPTURE_OPTIONS', 'Invalid capture dimensions or quality')

  try {
    const displays = screen.getAllDisplays()
    const primaryId = screen.getPrimaryDisplay().id
    log.info('Starting screen capture', { displayCount: displays.length })

    // Fetch sources for screen capture
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: maxLongestEdge, height: maxLongestEdge }
    })

    if (!sources || sources.length === 0) {
      throw new ScreenCaptureError('NO_SCREEN_SOURCES', 'desktopCapturer returned no screen sources')
    }

    const capturedDisplays: CapturedDisplay[] = []

    for (let index = 0; index < displays.length; index++) {
      const display = displays[index]
      // Source enumeration order is not display identity.
      let matches = sources.filter(s => s.display_id === String(display.id))
      if (matches.length === 0) {
        matches = sources.filter(s => Boolean(s.id && (s.id.includes(String(display.id)) || s.id.includes(`screen:${index}`))))
      }
      let source = matches.length === 1 ? matches[0] : undefined
      const hasNoDisplayIds = sources.every(s => !s.display_id || s.display_id === '')
      if (!source && hasNoDisplayIds && sources.length === displays.length) {
        source = sources[index]
      } else if (!source && hasNoDisplayIds && displays.length === 1 && sources.length > 0) {
        source = sources[0]
      }

      if (!source || !source.thumbnail) {
        log.warn('Missing thumbnail for display', { displayId: display.id, index })
        continue
      }

      // Resize image if needed while preserving aspect ratio
      const image = source.thumbnail
      const size = image.getSize()
      if (size.width <= 0 || size.height <= 0) continue
      let resizedImage = image

      if (size.width > maxLongestEdge || size.height > maxLongestEdge) {
        const aspectRatio = size.width / size.height
        let newWidth: number
        let newHeight: number

        if (size.width >= size.height) {
          newWidth = maxLongestEdge
          newHeight = Math.round(maxLongestEdge / aspectRatio)
        } else {
          newHeight = maxLongestEdge
          newWidth = Math.round(maxLongestEdge * aspectRatio)
        }

        resizedImage = image.resize({ width: newWidth, height: newHeight })
      }

      // Compress to JPEG buffer
      const jpegBuffer = resizedImage.toJPEG(jpegQuality)
      const jpegBase64 = jpegBuffer.toString('base64')

      capturedDisplays.push({
        displayId: display.id,
        screenIndex: index,
        bounds: { ...display.bounds },
        jpegBase64,
        imageSize: resizedImage.getSize(), isPrimary: display.id === primaryId
      })

      log.debug('Display captured successfully', {
        displayId: display.id,
        index,
        imageSize: resizedImage.getSize(),
        jpegSizeKb: Math.round(jpegBuffer.length / 1024)
      })
    }

    log.info('Screen capture complete', { capturedCount: capturedDisplays.length })
    return capturedDisplays
  } catch (error) {
    log.error('Screen capture failed', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw new ScreenCaptureError(
      'CAPTURE_FAILED',
      'Failed to capture screen sources',
      'high',
      error instanceof Error ? error : undefined
    )
  }
}
