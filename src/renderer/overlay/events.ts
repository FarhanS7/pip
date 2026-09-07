import type { PipAPI } from '../../shared/types/pip-api'
import type { CursorPositionPayload, VoiceState } from '../../shared/types/ipc'

export interface OverlayEventSink {
  setVoiceState(state: VoiceState): void
  setTurnId?(turnId: number): void
  resetResponse(): void
  setPowerLevel(level: number): void
  setPoint(point: CursorPositionPayload): void
  appendText(text: string): void
}

/** Bind the overlay to the same payload contract used by the main process. */
export function subscribeOverlayEvents(api: PipAPI, sink: OverlayEventSink): () => void {
  const unsubscribe = [
    api.onVoiceStateChanged(({ state, turnId }) => {
      if (turnId !== undefined) sink.setTurnId?.(turnId)
      sink.setVoiceState(state)
      if (state === 'listening' || state === 'processing') sink.resetResponse()
    }),
    api.onPowerLevelChanged(({ level }) => sink.setPowerLevel(level)),
    api.onPointDetected((point) => sink.setPoint(point)),
    api.onTextChunk(({ text }) => sink.appendText(text))
  ]
  return () => unsubscribe.forEach((stop) => stop())
}

/** Prefer live changes over a slower initial read, including during renderer mount. */
export function subscribeCursorVisibility(api: PipAPI, update: (enabled: boolean) => void): () => void {
  let stale = false
  const stop = api.onSettingsChanged(settings => {
    stale = true
    update(settings.cursorEnabled)
  })
  void api.getSettings().then(settings => {
    if (!stale) update(settings.cursorEnabled)
  }).catch(() => { /* Keep visuals hidden until a valid settings event arrives. */ })
  return () => { stale = true; stop() }
}
