/**
 * Central Orchestrator Pipeline (Task F.4)
 *
 * Connects Voice State Machine, STT, Multi-Monitor Screen Capture, AI Vision Streaming Providers,
 * Response Parser, Coordinate Mapper, TTS, and IPC broadcasts into a cohesive end-to-end loop.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main module)
 *   PHASE_1_MODULES_AND_TASKS.md Task F.4 scoped checklist
 */

import { BrowserWindow } from 'electron'
import { voiceStateMachine, VoiceState } from './state/voice-state-machine'
import { getSettings } from './state/settings'
import { createSTTProvider, STTSession } from './audio/stt-provider'
import { createAIProvider, VisionPromptPayload } from './ai/ai-provider'
import { createTTSProvider, TTSProvider } from './tts/tts-provider'
import { captureAllDisplays } from './screen/screen-capture'
import { buildSystemPrompt, DisplayInfo } from './ai/system-prompt-builder'
import { parseAIResponseTag } from './ai/response-parser'
import { mapToGlobalScreenCoordinates } from './state/coordinate-mapper'
import { conversationHistory } from './state/conversation'
import { IpcChannel } from './ipc/channels'
import { createLogger } from './logger'

const log = createLogger('orchestrator')

export class Orchestrator {
  private activeSttSession: STTSession | null = null
  private currentUtterance: string = ''
  private activeTtsProvider: TTSProvider | null = null
  private isUnsubscribed: boolean = false
  private unsubscribeState: (() => void) | null = null

  constructor() {
    log.info('Initializing Central Orchestrator Pipeline')
    this.unsubscribeState = voiceStateMachine.subscribe((state, reason) => {
      this.handleStateChange(state, reason).catch((err) => {
        log.error('Error handling orchestrator state change', { state, reason, error: String(err) })
        voiceStateMachine.reset('orchestrator-error')
      })
    })
  }

  private async handleStateChange(state: VoiceState, reason?: string): Promise<void> {
    log.info('Orchestrator state change received', { state, reason })

    switch (state) {
      case 'listening':
        await this.startListening()
        break
      case 'processing':
        await this.startProcessing()
        break
      case 'responding':
        // Handled in startProcessing stream loop
        break
      case 'idle':
        await this.handleIdle()
        break
    }
  }

  private async startListening(): Promise<void> {
    this.currentUtterance = ''
    this.stopTTS()

    try {
      const sttType = getSettings().selectedSTTProvider
      log.info('Creating STT session for listening', { sttType })
      const sttProvider = createSTTProvider(sttType)
      this.activeSttSession = await sttProvider.createSession()

      this.activeSttSession.onTranscript((evt) => {
        this.currentUtterance = evt.text
        log.debug('STT transcript updated', { text: evt.text, isFinal: evt.isFinal })
      })

      this.activeSttSession.onError((err) => {
        log.error('STT session error', { error: err.message })
      })
    } catch (err) {
      log.warn('Could not initialize active STT provider, falling back to ambient mode', { error: String(err) })
    }
  }

  private async startProcessing(): Promise<void> {
    if (this.activeSttSession) {
      try {
        await this.activeSttSession.close()
      } catch {
        // Ignore session close error
      }
      this.activeSttSession = null
    }

    log.info('Starting vision processing', { prompt: this.currentUtterance })

    // 1. Capture screen displays
    let capturedDisplays: DisplayInfo[] = []
    let primaryJpegBase64: string | undefined = undefined

    try {
      const screens = await captureAllDisplays()
      if (screens.length > 0) {
        primaryJpegBase64 = screens[0].base64Jpeg
        capturedDisplays = screens.map((s, idx) => ({
          displayId: s.displayId,
          screenIndex: idx,
          bounds: s.bounds,
          isPrimary: idx === 0
        }))
      }
    } catch (err) {
      log.error('Screen capture failed in orchestrator', { error: String(err) })
    }

    // 2. Format user query and system prompt
    const userQuery = this.currentUtterance.trim() || 'Please look at my screen and guide me.'
    conversationHistory.addTurn('user', userQuery)

    const systemPrompt = buildSystemPrompt({ displays: capturedDisplays })
    const payload: VisionPromptPayload = {
      messages: conversationHistory.getMessages(),
      screenshotJpegBase64: primaryJpegBase64,
      systemPrompt
    }

    // 3. Initiate AI Provider streaming
    const aiType = getSettings().selectedAIProvider
    log.info('Instantiating AI Vision provider', { aiType })
    const aiProvider = createAIProvider(aiType)

    // Transition state machine to responding
    voiceStateMachine.transitionTo('responding', 'ai-stream-start')

    let fullResponse = ''
    try {
      const stream = aiProvider.streamChat(payload)
      for await (const chunk of stream) {
        fullResponse += chunk
        this.broadcast(IpcChannel.AI_RESPONSE_CHUNK, { chunk })
      }
    } catch (err) {
      log.error('AI streaming failed in orchestrator', { error: String(err) })
      fullResponse = 'Sorry, I encountered an error communicating with the AI model.'
      this.broadcast(IpcChannel.AI_RESPONSE_CHUNK, { chunk: fullResponse })
    }

    // 4. Parse response tags and coordinates
    const parsed = parseAIResponseTag(fullResponse)
    conversationHistory.addTurn('assistant', parsed.cleanText)

    if (parsed.point) {
      const screenIdx = parsed.screenNumber ? Math.max(0, parsed.screenNumber - 1) : 0
      const mapped = mapToGlobalScreenCoordinates(
        parsed.point,
        screenIdx,
        capturedDisplays
      )

      log.info('AI Point detected and mapped', { point: parsed.point, mapped })

      this.broadcast(IpcChannel.AI_POINT_DETECTED, {
        globalX: mapped.globalX,
        globalY: mapped.globalY,
        label: parsed.elementLabel ?? ''
      })
    }

    // 5. Speak response with TTS Provider
    const ttsType = getSettings().selectedTTSProvider
    log.info('Instantiating TTS provider for spoken response', { ttsType })

    try {
      this.activeTtsProvider = createTTSProvider(ttsType)
      await this.activeTtsProvider.speak(parsed.cleanText)
    } catch (err) {
      log.error('TTS playback failed in orchestrator', { error: String(err) })
    } finally {
      this.activeTtsProvider = null
      voiceStateMachine.transitionTo('idle', 'tts-ended')
    }
  }

  private async handleIdle(): Promise<void> {
    if (this.activeSttSession) {
      await this.activeSttSession.close()
      this.activeSttSession = null
    }
    this.stopTTS()
  }

  private stopTTS(): void {
    if (this.activeTtsProvider) {
      this.activeTtsProvider.stop()
      this.activeTtsProvider = null
    }
  }

  private broadcast(channel: string, payload: unknown): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload)
      }
    }
  }

  public destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState()
      this.unsubscribeState = null
    }
    if (this.activeSttSession) {
      this.activeSttSession.close()
      this.activeSttSession = null
    }
    this.stopTTS()
  }
}

let orchestratorInstance: Orchestrator | null = null

/**
 * Initialize the global Orchestrator pipeline.
 */
export function initOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator()
  }
  return orchestratorInstance
}
