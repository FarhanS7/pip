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
 * Regex matching [POINT:x,y:label] or [POINT:x,y:label:screenN] or [POINT:none].
 */
const POINT_TAG_SINGLE_REGEX = /\[POINT:\s*(?:(none)|(?:x=)?(-?\d+)\s*,\s*(?:y=)?(-?\d+))(?:[\s:]+([^:\]]+))?(?:[\s:]+screen(\d+))?\s*\]/i

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

  const cleanText = responseText
    .replace(/(?:\*\*|\*|`)*\[POINT:[^\]]*(?:\]|$)(?:\*\*|\*|`)*/gi, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  const allTagMatches = responseText.match(/\[POINT:[^\]]*(?:\]|$)/gi)

  if (!allTagMatches || allTagMatches.length !== 1) {
    return {
      spokenText: cleanText,
      coordinate: null,
      elementLabel: null,
      screenNumber: null
    }
  }

  for (const tag of allTagMatches) {
    const match = tag.match(POINT_TAG_SINGLE_REGEX)
    if (!match) continue

    const isNone = Boolean(match[1] && match[1].toLowerCase() === 'none')

    if (isNone) {
      return {
        spokenText: cleanText,
        coordinate: null,
        elementLabel: 'none',
        screenNumber: null
      }
    }

    const x = parseInt(match[2], 10)
    const y = parseInt(match[3], 10)
    const label = match[4] ? match[4].trim() : null
    const screenNumber = match[5] ? parseInt(match[5], 10) : null

    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || (screenNumber !== null && (!Number.isSafeInteger(screenNumber) || screenNumber < 1))) {
      continue
    }

    return {
      spokenText: cleanText,
      coordinate: { x, y },
      elementLabel: label,
      screenNumber
    }
  }

  return {
    spokenText: cleanText,
    coordinate: null,
    elementLabel: null,
    screenNumber: null
  }
}
