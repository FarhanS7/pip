import { describe, it, expect } from 'vitest'
import { parsePointingCoordinates } from './response-parser'

describe('parsePointingCoordinates', () => {
  it('parses coordinate with label', () => {
    const input = 'click that button up there. [POINT:1100,42:color inspector]'
    const result = parsePointingCoordinates(input)
    expect(result).toEqual({
      spokenText: 'click that button up there.',
      coordinate: { x: 1100, y: 42 },
      elementLabel: 'color inspector',
      screenNumber: null
    })
  })

  it('parses [POINT:none]', () => {
    const input = 'html stands for hypertext markup language. [POINT:none]'
    const result = parsePointingCoordinates(input)
    expect(result).toEqual({
      spokenText: 'html stands for hypertext markup language.',
      coordinate: null,
      elementLabel: 'none',
      screenNumber: null
    })
  })

  it('parses cross-monitor tag with screen identifier', () => {
    const input = "that's on your second monitor. [POINT:400,300:terminal:screen2]"
    const result = parsePointingCoordinates(input)
    expect(result).toEqual({
      spokenText: "that's on your second monitor.",
      coordinate: { x: 400, y: 300 },
      elementLabel: 'terminal',
      screenNumber: 2
    })
  })

  it('handles response with no tag', () => {
    const input = 'hello there, how can I help?'
    const result = parsePointingCoordinates(input)
    expect(result).toEqual({
      spokenText: 'hello there, how can I help?',
      coordinate: null,
      elementLabel: null,
      screenNumber: null
    })
  })

  it('handles empty input string', () => {
    const result = parsePointingCoordinates('')
    expect(result).toEqual({
      spokenText: '',
      coordinate: null,
      elementLabel: null,
      screenNumber: null
    })
  })

  it('ignores malformed tags', () => {
    const input = 'some text [POINT:invalid,data]'
    const result = parsePointingCoordinates(input)
    expect(result).toEqual({
      spokenText: 'some text [POINT:invalid,data]',
      coordinate: null,
      elementLabel: null,
      screenNumber: null
    })
  })
})
