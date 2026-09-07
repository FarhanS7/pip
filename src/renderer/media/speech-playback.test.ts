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

it('releases provider audio URLs and rejects play failures without reporting stopped audio as ended', async () => {
  let speak!: Parameters<PipAPI['onSpeak']>[0]
  let stop!: Parameters<PipAPI['onStopSpeaking']>[0]
  const report = vi.fn(async () => {})
  const api = {
    onSpeak: (callback: typeof speak) => { speak = callback; return vi.fn() },
    onStopSpeaking: (callback: typeof stop) => { stop = callback; return vi.fn() }, reportPlayback: report
  } as unknown as PipAPI
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), onended: null, onerror: null } as unknown as HTMLAudioElement
  const dispose = bindSpeechPlayback(api, { cancel: vi.fn() } as unknown as SpeechSynthesis, vi.fn(), () => audio)
  try {
    speak({ requestId: 1, text: '', audio: new ArrayBuffer(3) })
    expect(report).not.toHaveBeenCalled()
    const late = audio.onended!
    stop({ requestId: 1 })
    expect(revoke).toHaveBeenCalledOnce()
    late.call(audio, {} as Event)
    expect(report).not.toHaveBeenCalled()
    vi.mocked(audio.play).mockRejectedValue(new Error('decode failed'))
    speak({ requestId: 2, text: '', audio: new ArrayBuffer(3) })
    await Promise.resolve()
    expect(report).toHaveBeenCalledExactlyOnceWith(2, 'error')
    expect(revoke).toHaveBeenCalledTimes(2)
  } finally { dispose(); revoke.mockRestore() }
})
