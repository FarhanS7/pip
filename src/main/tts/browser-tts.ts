import type { TTSProvider } from './tts-provider'
import { createMediaWindow, mediaPlayback } from '../windows/media-window'

export class BrowserTTSProvider implements TTSProvider {
  readonly name = 'browser'
  readonly displayName = 'Browser SpeechSynthesis'
  readonly requiresApiKey = false
  async speak(text: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (!text.trim()) return
    createMediaWindow()
    await mediaPlayback.speak(text, signal)
  }
  stop(): void { mediaPlayback.stop() }
}
