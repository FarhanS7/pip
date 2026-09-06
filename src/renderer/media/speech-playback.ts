import type { PipAPI } from '../../shared/types/pip-api'

/** Only the media renderer creates speech utterances. */
export function bindSpeechPlayback(api: PipAPI, synthesis: SpeechSynthesis, create: (text: string) => SpeechSynthesisUtterance): () => void {
  let active: { requestId: number; utterance: SpeechSynthesisUtterance } | null = null
  function stop(): void {
    if (active) { active.utterance.onend = null; active.utterance.onerror = null; active = null }
    synthesis.cancel()
  }
  const unsubscribeSpeak = api.onSpeak(({ requestId, text }) => {
    stop()
    try {
      const utterance = create(text)
      active = { requestId, utterance }
      const finish = (status: 'ended' | 'error') => {
        if (active?.requestId !== requestId) return
        active = null
        utterance.onend = null; utterance.onerror = null
        void api.reportPlayback(requestId, status).catch(() => { /* Main has a bounded acknowledgement timeout. */ })
      }
      utterance.onend = () => finish('ended')
      utterance.onerror = () => finish('error')
      synthesis.speak(utterance)
    } catch {
      stop()
      void api.reportPlayback(requestId, 'error').catch(() => {})
    }
  })
  const unsubscribeStop = api.onStopSpeaking(({ requestId }) => {
    if (active?.requestId === requestId) stop()
  })
  return () => { unsubscribeSpeak(); unsubscribeStop(); stop() }
}
