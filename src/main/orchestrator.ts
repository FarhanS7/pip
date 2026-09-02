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
import { voiceStateMachine } from './state/voice-state-machine'
import { VoiceState } from '../shared/types/ipc'
import { getSettings } from './state/settings'
import { createSTTProvider, STTSession } from './audio/stt-provider'
import { createAIProvider, VisionPromptPayload, ChatMessage } from './ai/ai-provider'
import { createTTSProvider, TTSProvider } from './tts/tts-provider'
import { captureAllScreens, CapturedDisplay } from './screen/screen-capture'
import { buildSystemPrompt, DisplayInfo } from './ai/system-prompt-builder'
import { parsePointingCoordinates } from './ai/response-parser'
import { mapToGlobalScreenCoordinates } from './state/coordinate-mapper'
import { conversationHistory } from './state/conversation'
import { IpcChannel } from './ipc/channels'
import { createLogger } from './logger'

const log = createLogger('orchestrator')

export class Orchestrator {
  private activeSttSession: STTSession | null = null
  private currentUtterance: string = ''
  private activeTtsProvider: TTSProvider | null = null
  private unsubscribeState: (() => void) | null = null

  constructor() {
    log.info('Initializing Central Orchestrator Pipeline')
    this.unsubscribeState = voiceStateMachine.onStateChange((state, reason) => {
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
      const screens: CapturedDisplay[] = await captureAllScreens()
      if (screens.length > 0) {
        primaryJpegBase64 = screens[0].jpegBase64
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

    // 2. Format messages from conversation history + current user query
    const userQuery = this.currentUtterance.trim() || 'Please look at my screen and guide me.'

    const messages: ChatMessage[] = []
    for (const exchange of conversationHistory.getHistory()) {
      if (exchange.userTranscript) {
        messages.push({ role: 'user', content: exchange.userTranscript })
      }
      if (exchange.assistantResponse) {
        messages.push({ role: 'assistant', content: exchange.assistantResponse })
      }
    }
    messages.push({ role: 'user', content: userQuery })

    const systemPrompt = buildSystemPrompt({ displays: capturedDisplays })
    const payload: VisionPromptPayload = {
      messages,
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
        this.broadcast(IpcChannel.AI_RESPONSE_CHUNK, { text: chunk })
      }
    } catch (err) {
      log.error('AI streaming failed in orchestrator', { error: String(err) })
      fullResponse = 'Sorry, I encountered an error communicating with the AI model.'
      this.broadcast(IpcChannel.AI_RESPONSE_CHUNK, { text: fullResponse })
    }

    // 4. Parse response tags and coordinates
    const parsed = parsePointingCoordinates(fullResponse)
    conversationHistory.add(userQuery, parsed.spokenText)

    if (parsed.coordinate) {
      const screenIdx = parsed.screenNumber ? Math.max(0, parsed.screenNumber - 1) : 0
      const mapped = mapToGlobalScreenCoordinates(
        parsed.coordinate,
        screenIdx,
        capturedDisplays
      )

      log.info('AI Point detected and mapped', { coordinate: parsed.coordinate, mapped })

      this.broadcast(IpcChannel.CURSOR_POSITION, {
        x: mapped.globalX,
        y: mapped.globalY,
        label: parsed.elementLabel,
        screenIndex: mapped.screenIndex
      })
    }

    // 5. Speak response with TTS Provider
    const ttsType = getSettings().selectedTTSProvider
    log.info('Instantiating TTS provider for spoken response', { ttsType })

    try {
      this.activeTtsProvider = createTTSProvider(ttsType)
      await this.activeTtsProvider.speak(parsed.spokenText)
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
