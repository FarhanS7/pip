/**
 * Browser SpeechSynthesis TTS Provider (Free Fallback)
 *
 * Implements TTSProvider using local SpeechSynthesis API.
 * Includes workaround for Chrome bug where long speech pauses after 15 seconds.
 *
 * References:
 *   PHASE_1_MODULES_AND_TASKS.md Task D.2 scoped checklist
 */

import { BrowserWindow } from 'electron'
import { TTSProvider } from './tts-provider'
import { createLogger } from '../logger'

const log = createLogger('browser-tts')

export class BrowserTTSProvider implements TTSProvider {
  public readonly name = 'browser'
  public readonly displayName = 'Browser SpeechSynthesis (Fallback)'
  public readonly requiresApiKey = false

  public async speak(text: string): Promise<void> {
    if (!text || !text.trim()) return

    log.info('Browser TTS speaking via renderer IPC', { length: text.length })

    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('tts:speak', { text })
      }
    }
  }

  public stop(): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('tts:stop')
      }
    }
    log.info('Browser TTS stopped')
  }
}

