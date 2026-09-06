import type { PipAPI } from '../../shared/types/pip-api'

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

/** Transitional browser adapter; PCM capture/provider finalization are B13-B15. */
export function bindBrowserRecognition(api: PipAPI): () => void {
  let generation = 0
  let recognition: Recognition | null = null
  const stop = () => {
    if (recognition) {
      recognition.onresult = null; recognition.onerror = null
      try { recognition.abort() } catch { /* Already stopped. */ }
      recognition = null
    }
  }
  const unsubscribe = api.onVoiceStateChanged(({ state, turnId }) => {
    const current = ++generation
    stop()
    if (state !== 'listening' || turnId === undefined) return
    void api.getSettings().then(settings => {
      if (current !== generation || settings.selectedSTTProvider !== 'web-speech') return
      const host = window as RecognitionWindow
      const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition
      if (!Constructor) { console.warn('Browser speech recognition is unavailable'); return }
      const session = new Constructor()
      recognition = session
      session.continuous = true; session.interimResults = true; session.lang = 'en-US'
      session.onresult = event => {
        if (current !== generation) return
        const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join('')
        if (text.trim()) void api.updateTranscript(text, turnId).catch(() => {})
      }
      session.onerror = () => console.warn('Browser speech recognition failed')
      session.start()
    }).catch(() => { if (current === generation) stop() })
  })
  return () => { generation++; unsubscribe(); stop() }
}
