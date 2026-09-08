import type { STTProvider, STTSession, STTTranscriptEvent } from './stt-provider'
import { STTError } from '../errors'
import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'

const failure = (code: string) => new STTError(code, 'Transcription could not complete. Please try again.')

/** v3 lifecycle: Begin -> Turn revisions -> Terminate -> Termination. */
export class AssemblyAISTTSession implements STTSession {
  readonly id = `assemblyai-${randomUUID()}`
  readonly ready: Promise<void>
  private resolveReady!: () => void
  private rejectReady!: (error: Error) => void
  private begun = false
  private closed = false
  private error: Error | null = null
  private closing: Promise<void> | null = null
  private resolveClose?: () => void
  private rejectClose?: (error: Error) => void
  private timer: ReturnType<typeof setTimeout>
  private turns = new Map<number, { text: string; final: boolean; formatted: boolean }>()
  private transcripts = new Set<(event: STTTranscriptEvent) => void>()
  private errors = new Set<(error: Error) => void>()
  private abort = () => this.fail(failure('STT_CANCELLED'))

  constructor(private ws: WebSocket, private signal?: AbortSignal) {
    this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject })
    this.timer = setTimeout(() => this.fail(failure('WS_CONNECT_TIMEOUT')), 10000)
    ws.onmessage = event => {
      if (this.closed) return
      try {
        const data: unknown = JSON.parse(String(event.data))
        if (!data || typeof data !== 'object') throw new Error()
        const message = data as Record<string, unknown>
        if (message.type === 'Begin') {
          this.begun = true; clearTimeout(this.timer); this.resolveReady()
        } else if (message.type === 'Turn') {
          if (!this.begun || !Number.isSafeInteger(message.turn_order) || (message.turn_order as number) < 0 ||
              typeof message.transcript !== 'string' || typeof message.end_of_turn !== 'boolean') throw new Error()
          const order = message.turn_order as number
          const previous = this.turns.get(order)
          if (previous?.final && !message.end_of_turn) return
          if (previous?.formatted && !message.turn_is_formatted) return
          this.turns.set(order, { text: message.transcript.trim(), final: message.end_of_turn, formatted: message.turn_is_formatted === true })
          const segments = [...this.turns].sort(([a], [b]) => a - b).map(([, turn]) => turn)
          const text = segments.map(turn => turn.text).filter(Boolean).join(' ')
          if (text.length > 32000 || segments.length > 1000) throw new Error()
          for (const callback of this.transcripts) callback({ text, isFinal: segments.every(turn => turn.final) })
        } else if (message.type === 'Termination') {
          if (!this.closing || [...this.turns.values()].some(turn => !turn.final)) {
            this.fail(failure('STT_INCOMPLETE')); return
          }
          this.resolveClose?.(); this.cleanup()
        } else if (message.type === 'Error' || message.error) this.fail(failure('STT_PROVIDER_ERROR'))
      } catch { this.fail(failure('STT_PROTOCOL_ERROR')) }
    }
    ws.onerror = () => this.fail(failure('ASSEMBLYAI_WS_ERROR'))
    ws.onclose = () => this.fail(failure('STT_UNEXPECTED_CLOSE'))
    signal?.addEventListener('abort', this.abort, { once: true })
    if (signal?.aborted) this.abort()
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (!this.begun || this.closed || this.closing || this.ws.readyState !== 1) throw failure('STT_SESSION_CLOSED')
    if (chunk.byteLength < 2 || chunk.byteLength > 3200 || chunk.byteLength % 2) throw failure('STT_INVALID_AUDIO')
    if (this.ws.bufferedAmount > 160000) throw failure('STT_BACKPRESSURE')
    // The final worklet tail may be shorter than the API's 50 ms minimum.
    if (chunk.byteLength < 1600) {
      const padded = new Uint8Array(1600); padded.set(new Uint8Array(chunk)); this.ws.send(padded)
    } else this.ws.send(chunk)
  }

  onTranscript(callback: (event: STTTranscriptEvent) => void): void { this.transcripts.add(callback) }
  onError(callback: (error: Error) => void): void {
    if (this.error) callback(this.error)
    else this.errors.add(callback)
  }

  close(): Promise<void> {
    if (this.closing) return this.closing
    if (this.closed) return this.error ? Promise.reject(this.error) : Promise.resolve()
    this.closing = new Promise((resolve, reject) => { this.resolveClose = resolve; this.rejectClose = reject })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.fail(failure('STT_FINALIZATION_TIMEOUT')), 10000)
    try { this.ws.send(JSON.stringify({ type: 'Terminate' })) }
    catch { this.fail(failure('STT_TERMINATE_FAILED')) }
    return this.closing
  }

  private fail(error: Error): void {
    if (this.closed) return
    this.error = error
    this.rejectReady(error); this.rejectClose?.(error)
    const callbacks = [...this.errors]
    this.cleanup()
    for (const callback of callbacks) callback(error)
  }

  private cleanup(): void {
    this.closed = true; clearTimeout(this.timer)
    this.signal?.removeEventListener('abort', this.abort)
    this.ws.onmessage = null; this.ws.onerror = () => {}; this.ws.onclose = null
    try {
      // Cancellation also tells the provider to stop billing before local close.
      if (!this.closing && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'Terminate' }))
      if (this.error) this.ws.terminate()
      else this.ws.close()
    } catch { /* Already disconnected. */ }
    this.transcripts.clear(); this.errors.clear(); this.turns.clear()
  }
}

import { getAppConfig } from '../config'

export class AssemblyAISTTProvider implements STTProvider {
  readonly name = 'assemblyai'
  readonly displayName = 'AssemblyAI Real-Time STT'
  readonly requiresApiKey = true
  private readonly workerUrl: string
  private readonly sharedSecret: string

  constructor(workerUrl?: string, sharedSecret?: string) {
    const config = getAppConfig()
    this.workerUrl = (workerUrl || config.workerUrl).replace(/\/+$/, '')
    this.sharedSecret = sharedSecret ?? config.sharedSecret
  }

  async createSession(signal?: AbortSignal): Promise<STTSession> {
    signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, 10000)
    let token: string
    try {
      const response = await fetch(`${this.workerUrl}/transcribe-token`, {
        method: 'GET', headers: { 'X-Pip-Auth': this.sharedSecret }, signal: controller.signal
      })
      if (!response.ok) throw failure('TOKEN_FETCH_HTTP_ERROR')
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string' || !data.token.trim() || data.token.length > 8192) throw failure('INVALID_TOKEN_RESPONSE')
      token = data.token
    } catch { throw failure('TOKEN_FETCH_FAILED') }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    signal?.throwIfAborted()
    const query = new URLSearchParams({ token, sample_rate: '16000', encoding: 'pcm_s16le' })
    const session = new AssemblyAISTTSession(new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${query}`), signal)
    await session.ready
    return session
  }
}
