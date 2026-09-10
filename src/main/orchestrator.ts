import { BrowserWindow } from 'electron'
import { voiceStateMachine } from './state/voice-state-machine'
import type { SettingsPayload, IpcEventPayloads } from '../shared/types/ipc'
import { getSettings } from './state/settings'
import { createSTTProvider, STTSession } from './audio/stt-provider'
import { createAIProvider, ChatMessage } from './ai/ai-provider'
import { createTTSProvider, TTSProvider } from './tts/tts-provider'
import { captureAllScreens, displaySnapshotMatches } from './screen/screen-capture'
import { buildSystemPrompt, DisplayInfo } from './ai/system-prompt-builder'
import { parsePointingCoordinates } from './ai/response-parser'
import { mapToGlobalScreenCoordinates } from './state/coordinate-mapper'
import { conversationHistory } from './state/conversation'
import { IpcChannel } from './ipc/channels'
import { createLogger } from './logger'
import { waitForAudio } from './audio/wait-for-audio'
import { queryAccessibilityTree, formatAccessibilityForPrompt, AccessibilitySnapshot } from './accessibility/accessibility-adapter'
import { isCaptureAllowed } from './privacy/capture-policy'
import { extractProtectedRegions, applyMaskingToBase64, sanitizeAccessibilityText } from './privacy/field-masking'

const log = createLogger('orchestrator')
interface Turn {
  typed: boolean
  id: number
  controller: AbortController
  settings: SettingsPayload
  utterance: string
  acceptingTranscript: boolean
  ready: Promise<void>
  stt: STTSession | null
  closing: Promise<void> | null
  tts: TTSProvider | null
  processing: boolean
  audioDrain: Promise<void>
  resolveAudioDrain: () => void
  audioClosed: boolean
  audioSequence: number
  audioSamples: number
}

export class Orchestrator {
  private turn: Turn | null = null
  private unsubscribeState: (() => void) | null
  private completedTts: TTSProvider | null = null
  private pendingText: string | null = null

  constructor() {
    this.unsubscribeState = voiceStateMachine.onStateChange(state => {
      if (state === 'listening') this.beginTurn()
      else if (state === 'idle') this.releaseTurn()
      else if (state === 'processing') {
        if (!this.turn && this.pendingText !== null) this.beginTurn(this.pendingText)
        if (!this.turn || this.turn.processing) return
        const turn = this.turn
        turn.processing = true
        void this.processTurn(turn).catch(error => {
          if (!this.owns(turn)) return
          log.error('Voice turn failed', { turnId: turn.id, error: String(error) })
          this.cancel('turn-error')
        })
      }
    })
  }

  private owns(turn: Turn): boolean {
    return this.turn === turn && !turn.controller.signal.aborted
  }

  public setUtterance(text: string, turnId: number): void {
    const turn = this.turn
    if (turn && turn.id === turnId && turn.acceptingTranscript && voiceStateMachine.getState() === 'listening' && text.trim()) {
      turn.utterance = text.trim()
    }
  }

  public submitText(text: string): void {
    if (typeof text !== 'string' || !text.trim() || text.length > 16000) throw new Error('Invalid request')
    if (voiceStateMachine.getState() !== 'idle') throw new Error('Finish or cancel the current request first')
    this.pendingText = text.trim()
    try { voiceStateMachine.transitionTo('processing', 'typed-input') }
    finally { this.pendingText = null }
  }

  public finishBrowserRecognition(text: string, turnId: number): void {
    const turn = this.turn
    if (!turn || !this.owns(turn) || turn.id !== turnId || turn.typed || turn.audioClosed || turn.settings.selectedSTTProvider !== 'web-speech') return
    turn.utterance = text.trim()
    turn.audioClosed = true
    turn.resolveAudioDrain()
    if (!turn.utterance) this.cancel('no-transcript')
    else if (voiceStateMachine.getState() === 'listening') voiceStateMachine.transitionTo('processing', 'browser-speech-ended')
  }

  private beginTurn(text?: string): void {
    this.releaseTurn()
    this.completedTts?.stop()
    this.completedTts = null
    let resolveAudioDrain!: () => void
    const audioDrain = new Promise<void>(resolve => { resolveAudioDrain = resolve })
    const turn: Turn = {
      id: voiceStateMachine.getTurnId(), controller: new AbortController(), settings: getSettings(),
      typed: text !== undefined, utterance: text ?? '', acceptingTranscript: text === undefined, ready: Promise.resolve(),
      stt: null, closing: null, tts: null, processing: false,
      audioDrain, resolveAudioDrain, audioClosed: false, audioSequence: 0, audioSamples: 0
    }
    this.turn = turn
    if (!turn.typed) turn.ready = this.openStt(turn)
  }

  public async receiveAudio(turnId: number, sequence: number, buffer: ArrayBuffer): Promise<void> {
    const turn = this.turn
    if (!turn || turn.id !== turnId || turn.settings.selectedSTTProvider !== 'assemblyai') throw new Error('Inactive audio turn')
    await waitForAudio(turn.ready, turn.controller.signal)
    if (!this.owns(turn) || turn.audioClosed || turn.closing || !turn.stt || sequence !== turn.audioSequence) throw new Error('Invalid audio sequence or closed turn')
    turn.stt.sendAudio(buffer)
    turn.audioSequence++
    turn.audioSamples += buffer.byteLength / 2
    let squares = 0
    const view = new DataView(buffer)
    for (let offset = 0; offset < buffer.byteLength; offset += 2) squares += (view.getInt16(offset, true) / 32768) ** 2
    this.broadcast(IpcChannel.AUDIO_POWER_LEVEL, { level: Math.min(1, Math.sqrt(squares / (buffer.byteLength / 2))) })
  }

  public audioStopped(turnId: number): void {
    const turn = this.turn
    if (!turn || turn.id !== turnId || turn.settings.selectedSTTProvider !== 'assemblyai') return
    turn.audioClosed = true
    turn.resolveAudioDrain()
    if (!turn.audioSamples) this.cancel('no-microphone-audio')
  }

  public audioFailed(turnId: number): void {
    if (this.turn?.id === turnId) this.cancel('microphone-failed')
  }

  private async openStt(turn: Turn): Promise<void> {
    try {
      const session = await createSTTProvider(turn.settings.selectedSTTProvider).createSession(turn.controller.signal)
      turn.stt = session
      if (!this.owns(turn)) { await this.closeStt(turn); return }
      session.onTranscript(event => {
        if (this.owns(turn) && turn.acceptingTranscript) turn.utterance = event.text
      })
      session.onError(error => {
        if (this.owns(turn)) {
          log.warn('STT session error', { turnId: turn.id, error: String(error) })
          this.cancel('stt-error')
        }
      })
    } catch (error) {
      if (this.owns(turn)) {
        log.warn('STT unavailable for turn', { turnId: turn.id, error: String(error) })
        this.cancel('stt-unavailable')
      }
    }
  }

  private closeStt(turn: Turn): Promise<void> {
    if (!turn.stt) return Promise.resolve()
    turn.closing ??= Promise.resolve().then(() => turn.stt!.close())
    return turn.closing
  }

  private releaseTurn(): void {
    const turn = this.turn
    this.turn = null // Revoke ownership before abort or callbacks can run.
    if (!turn) return
    turn.acceptingTranscript = false
    turn.controller.abort()
    try { turn.tts?.stop() } catch (error) { log.warn('TTS stop failed', { error: String(error) }) }
    void this.closeStt(turn).catch(error => log.warn('STT cleanup failed', { turnId: turn.id, error: String(error) }))
  }

  public cancel(reason = 'user-cancelled'): void {
    this.releaseTurn()
    this.completedTts?.stop()
    this.completedTts = null
    voiceStateMachine.reset(reason)
  }

  private async processTurn(turn: Turn): Promise<void> {
    // A quick key release must wait for the session it started, not capture early.
    await waitForAudio(turn.ready, turn.controller.signal)
    if (!this.owns(turn)) return
    if (!turn.typed) await waitForAudio(turn.audioDrain, turn.controller.signal)
    if (!this.owns(turn)) return
    await this.closeStt(turn)
    if (!this.owns(turn)) return
    turn.acceptingTranscript = false

    let displays: DisplayInfo[] = []
    if (!turn.utterance.trim()) {
      this.cancel('no-transcript'); return
    }
    let images: { screenIndex: number; jpegBase64: string }[] = []

    // Query accessibility tree for enhanced grounding & protected region extraction
    let accessibilityTreeText = ''
    let axSnapshot: AccessibilitySnapshot | null = null
    try {
      axSnapshot = await queryAccessibilityTree()
      if (!this.owns(turn)) return
      accessibilityTreeText = sanitizeAccessibilityText(formatAccessibilityForPrompt(axSnapshot))
    } catch (error) {
      log.debug('Accessibility query skipped', { error: String(error) })
    }
    if (!this.owns(turn)) return
    const protectedRegions = extractProtectedRegions(axSnapshot)

    // Check capture policy before attempting screen capture
    if (!isCaptureAllowed()) {
      log.info('Screen capture paused or blocked by policy', { turnId: turn.id })
    } else {
      try {
        const screens = await captureAllScreens()
        if (!this.owns(turn)) return
        if (screens.length > 4 || screens.reduce((sum, screen) => sum + screen.jpegBase64.length, 0) > 8 * 1024 * 1024) {
          this.cancel('capture-limit'); return
        }
        images = screens.map(screen => ({
          screenIndex: screen.screenIndex,
          jpegBase64: applyMaskingToBase64(screen.jpegBase64, protectedRegions, screen.imageSize)
        }))
        displays = screens.map(screen => ({
          displayId: screen.displayId, screenIndex: screen.screenIndex, bounds: screen.bounds, isPrimary: screen.isPrimary, imageSize: screen.imageSize
        }))
      } catch (error) {
        if (!this.owns(turn)) return
        log.warn('Screen capture failed', { turnId: turn.id, error: String(error) })
      }
    }
    if (!this.owns(turn)) return
    const query = turn.utterance.trim()
    const messages: ChatMessage[] = []
    for (const exchange of conversationHistory.getHistory()) {
      if (exchange.userTranscript) messages.push({ role: 'user', content: exchange.userTranscript })
      if (exchange.assistantResponse) messages.push({ role: 'assistant', content: exchange.assistantResponse })
    }
    messages.push({ role: 'user', content: query })
    const provider = createAIProvider(turn.settings.selectedAIProvider, turn.settings.selectedAIModel)
    voiceStateMachine.transitionTo('responding', 'ai-stream-start')
    let response = ''
    for await (const chunk of provider.streamChat({
      messages, images, systemPrompt: buildSystemPrompt({ displays, accessibilityTreeText }), signal: turn.controller.signal
    })) {
      if (!this.owns(turn)) return
      response += chunk
      this.broadcast(IpcChannel.AI_RESPONSE_CHUNK, { text: chunk })
    }
    if (!this.owns(turn)) return
    if (!response.trim()) throw new Error('Empty AI response')
    const parsed = parsePointingCoordinates(response)
    if (parsed.coordinate && displaySnapshotMatches(displays)) {
      const mapped = mapToGlobalScreenCoordinates(parsed.coordinate, (parsed.screenNumber ?? ((displays[0]?.screenIndex ?? 0) + 1)) - 1, displays)
      if (mapped) {
      this.broadcast(IpcChannel.CURSOR_POSITION, {
        x: mapped.globalX, y: mapped.globalY, label: parsed.elementLabel, screenIndex: mapped.screenIndex
      })
      }
    }
    turn.tts = createTTSProvider(turn.settings.selectedTTSProvider)
    await turn.tts.speak(parsed.spokenText, turn.controller.signal)
    if (!this.owns(turn)) return
    // Only a still-current completed turn is included in future conversation context.
    conversationHistory.add(query, parsed.spokenText)
    this.completedTts = turn.tts
    turn.tts = null
    voiceStateMachine.transitionTo('idle', 'tts-ended')
  }

  private broadcast<C extends keyof IpcEventPayloads>(channel: C, payload: IpcEventPayloads[C]): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
  }

  public destroy(): void {
    this.unsubscribeState?.()
    this.unsubscribeState = null
    this.cancel('orchestrator-destroyed')
  }
}

let orchestratorInstance: Orchestrator | null = null
export function initOrchestrator(): Orchestrator { return orchestratorInstance ??= new Orchestrator() }
export function destroyOrchestrator(): void {
  orchestratorInstance?.destroy()
  orchestratorInstance = null
}
