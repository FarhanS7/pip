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

export interface CapturedDisplay {
  /** OS display ID */
  displayId: number
  /** 0-based screen index */
  screenIndex: number
  /** Screen bounds in global display space */
  bounds: { x: number; y: number; width: number; height: number }
  /** Base64-encoded JPEG image string */
  jpegBase64: string
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

  try {
    const displays = screen.getAllDisplays()
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
      // Match source by display_id or fallback to index matching
      const source = sources.find(s => s.display_id === String(display.id)) ?? sources[index] ?? sources[0]

      if (!source || !source.thumbnail) {
        log.warn('Missing thumbnail for display', { displayId: display.id, index })
        continue
      }

      // Resize image if needed while preserving aspect ratio
      const image = source.thumbnail
      const size = image.getSize()
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
        jpegBase64
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
