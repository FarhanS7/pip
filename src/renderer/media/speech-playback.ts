import type { PipAPI } from '../../shared/types/pip-api'

/** Browser and provider audio share one owner and the same completion handshake. */
export function bindSpeechPlayback(
  api: PipAPI, synthesis: SpeechSynthesis, create: (text: string) => SpeechSynthesisUtterance,
  createAudio: (url: string) => HTMLAudioElement = url => new Audio(url)
): () => void {
  let active: { requestId: number; cleanup: () => void } | null = null
  function stop(): void {
    const previous = active; active = null
    previous?.cleanup()
    synthesis.cancel()
  }
  const unsubscribeSpeak = api.onSpeak(({ requestId, text, audio }) => {
    stop()
    const finish = (status: 'ended' | 'error') => {
      if (active?.requestId !== requestId) return
      stop()
      void api.reportPlayback(requestId, status).catch(() => {})
    }
    try {
      if (audio) {
        if (!(audio instanceof ArrayBuffer) || !audio.byteLength || audio.byteLength > 12 * 1024 * 1024) throw new Error('Invalid audio')
        const url = URL.createObjectURL(new Blob([audio], { type: 'audio/mpeg' }))
        let player: HTMLAudioElement
        try { player = createAudio(url) } catch (error) { URL.revokeObjectURL(url); throw error }
        active = { requestId, cleanup: () => {
          player.onended = null; player.onerror = null
          player.pause(); player.removeAttribute('src'); player.load()
          URL.revokeObjectURL(url)
        } }
        player.onended = () => finish('ended')
        player.onerror = () => finish('error')
        void player.play().catch(() => finish('error'))
      } else {
        const utterance = create(text)
        active = { requestId, cleanup: () => { utterance.onend = null; utterance.onerror = null } }
        utterance.onend = () => finish('ended')
        utterance.onerror = () => finish('error')
        synthesis.speak(utterance)
      }
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
