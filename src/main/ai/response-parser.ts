/**
 * AI Response Parser
 *
 * Extracts `[POINT:x,y:label:screenN]` or `[POINT:none]` tags from AI streaming text.
 * Strips coordinate tags from the output so spoken TTS only receives natural text.
 *
 * Examples:
 *   Input: "click that button up there. [POINT:1100,42:color inspector]"
 *   Output: { spokenText: "click that button up there.", coordinate: {x: 1100, y: 42}, elementLabel: "color inspector", screenNumber: null }
 *
 *   Input: "html stands for hypertext markup language. [POINT:none]"
 *   Output: { spokenText: "html stands for hypertext markup language.", coordinate: null, elementLabel: "none", screenNumber: null }
 *
 *   Input: "that's on your second monitor. [POINT:400,300:terminal:screen2]"
 *   Output: { spokenText: "that's on your second monitor.", coordinate: {x: 400, y: 300}, elementLabel: "terminal", screenNumber: 2 }
 */

export interface PointingParseResult {
  spokenText: string
  coordinate: { x: number; y: number } | null
  elementLabel: string | null
  screenNumber: number | null
}

/**
 * Regex matching [POINT:x,y:label] or [POINT:x,y:label:screenN] or [POINT:none] at the end of a response string.
 * Group 1: 'none' OR x coordinate
 * Group 2: y coordinate (optional if 'none')
 * Group 3: element label (optional)
 * Group 4: screen tag e.g. 'screen2' (optional)
 */
const POINT_TAG_REGEX = /\[POINT:\s*(?:(none)|(-?\d+)\s*,\s*(-?\d+))(?:[\s:]+([^:\]]+))?(?:[\s:]+screen(\d+))?\s*\]\s*$/i

/**
 * Parses point tags from AI response text and returns clean spoken text and coordinates.
 */
export function parsePointingCoordinates(responseText: string): PointingParseResult {
  if (!responseText || typeof responseText !== 'string') {
    return {
      spokenText: '',
      coordinate: null,
      elementLabel: null,
      screenNumber: null
    }
  }

  const match = responseText.match(POINT_TAG_REGEX)

  if (!match) {
    return {
      spokenText: responseText.trim(),
      coordinate: null,
      elementLabel: null,
      screenNumber: null
    }
  }

  const tagFullMatch = match[0]
  const isNone = Boolean(match[1] && match[1].toLowerCase() === 'none')

  // Remove the tag from the spoken text and clean up whitespace
  const spokenText = responseText.substring(0, responseText.length - tagFullMatch.length).trim()

  if (isNone) {
    return {
      spokenText,
      coordinate: null,
      elementLabel: 'none',
      screenNumber: null
    }
  }

  const x = parseInt(match[2], 10)
  const y = parseInt(match[3], 10)
  const label = match[4] ? match[4].trim() : null
  const screenNumber = match[5] ? parseInt(match[5], 10) : null

  if (isNaN(x) || isNaN(y)) {
    return {
      spokenText: responseText.trim(),
      coordinate: null,
      elementLabel: null,
      screenNumber: null
    }
  }

  return {
    spokenText,
    coordinate: { x, y },
    elementLabel: label,
    screenNumber
  }
}
