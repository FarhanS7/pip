import type { PipAPI } from '../../shared/types/pip-api'

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

export function bindBrowserRecognition(api: PipAPI): () => void {
  let generation = 0
  let active: { id: number; session: Recognition; text: string; stopping: boolean } | null = null
  const discard = () => {
    if (!active) return
    const { session } = active
    active = null
    session.onresult = null; session.onerror = null; session.onend = null
    try { session.abort() } catch { /* Already stopped. */ }
  }
  const unsubscribe = api.onVoiceStateChanged(({ state, turnId }) => {
    if (state === 'processing' && active && active.id === turnId) {
      if (!active.stopping) {
        active.stopping = true
        try { active.session.stop() } catch { void api.reportAudioFailure(active.id).catch(() => {}); discard() }
      }
      return
    }
    const current = ++generation
    discard()
    if (state !== 'listening' || turnId === undefined) return
    void api.getSettings().then(settings => {
      if (current !== generation || settings.selectedSTTProvider !== 'web-speech') return
      const host = window as RecognitionWindow
      const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition
      if (!Constructor) { void api.reportAudioFailure(turnId).catch(() => {}); return }
      const session = new Constructor()
      const owner = { id: turnId, session, text: '', stopping: false }
      active = owner
      session.continuous = true; session.interimResults = true; session.lang = 'en-US'
      session.onresult = event => {
        if (active !== owner) return
        owner.text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim()
      }
      session.onend = () => {
        if (active !== owner) return
        const text = owner.text
        discard()
        void api.finishBrowserRecognition(text, turnId).catch(() => { void api.reportAudioFailure(turnId).catch(() => {}) })
      }
      session.onerror = () => {
        if (active !== owner) return
        discard(); void api.reportAudioFailure(turnId).catch(() => {})
      }
      session.start()
    }).catch(() => {
      if (current === generation) { discard(); void api.reportAudioFailure(turnId).catch(() => {}) }
    })
  })
  return () => { generation++; unsubscribe(); discard() }
}
