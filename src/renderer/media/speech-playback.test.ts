import { it, expect, vi } from 'vitest'
import type { PipAPI } from '../../shared/types/pip-api'
import { bindSpeechPlayback } from './speech-playback'

it('acknowledges actual speech completion and suppresses stopped utterance callbacks', () => {
  let speak!: Parameters<PipAPI['onSpeak']>[0]
  let stop!: Parameters<PipAPI['onStopSpeaking']>[0]
  const report = vi.fn(async () => {})
  const removeSpeak = vi.fn(), removeStop = vi.fn()
  const api = {
    onSpeak: (callback: typeof speak) => { speak = callback; return removeSpeak },
    onStopSpeaking: (callback: typeof stop) => { stop = callback; return removeStop }, reportPlayback: report
  } as unknown as PipAPI
  const synthesis = { speak: vi.fn(), cancel: vi.fn() } as unknown as SpeechSynthesis
  const utterances: SpeechSynthesisUtterance[] = []
  const dispose = bindSpeechPlayback(api, synthesis, () => {
    const utterance = {} as SpeechSynthesisUtterance
    utterances.push(utterance); return utterance
  })
  speak({ requestId: 1, text: 'first' })
  expect(report).not.toHaveBeenCalled()
  const late = utterances[0].onend!
  stop({ requestId: 1 })
  speak({ requestId: 2, text: 'second' })
  late.call(utterances[0], {} as SpeechSynthesisEvent)
  expect(report).not.toHaveBeenCalled()
  utterances[1].onend!.call(utterances[1], {} as SpeechSynthesisEvent)
  expect(report).toHaveBeenCalledExactlyOnceWith(2, 'ended')
  dispose()
  expect(removeSpeak).toHaveBeenCalledOnce()
  expect(removeStop).toHaveBeenCalledOnce()
})
