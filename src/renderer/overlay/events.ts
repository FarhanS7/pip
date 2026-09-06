import type { PipAPI } from '../../shared/types/pip-api'
import type { CursorPositionPayload, VoiceState } from '../../shared/types/ipc'

export interface OverlayEventSink {
  setVoiceState(state: VoiceState): void
  resetResponse(): void
  setPowerLevel(level: number): void
  setPoint(point: CursorPositionPayload): void
  appendText(text: string): void
}

/** Bind the overlay to the same payload contract used by the main process. */
export function subscribeOverlayEvents(api: PipAPI, sink: OverlayEventSink): () => void {
  const unsubscribe = [
    api.onVoiceStateChanged(({ state }) => {
      sink.setVoiceState(state)
      if (state === 'listening') sink.resetResponse()
    }),
    api.onPowerLevelChanged(({ level }) => sink.setPowerLevel(level)),
    api.onPointDetected((point) => sink.setPoint(point)),
    api.onTextChunk(({ text }) => sink.appendText(text))
  ]
  return () => unsubscribe.forEach((stop) => stop())
}
