/**
 * AssemblyAI Real-Time Streaming STT Provider (Task B.5)
 *
 * Implements STTProvider and STTSession for AssemblyAI WebSocket streaming.
 * Obtains temporary tokens via Cloudflare Worker proxy (/transcribe-token) with X-Pip-Auth.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.1 (main/audio module)
 *   PHASE_1_MODULES_AND_TASKS.md Task B.5 scoped checklist
 */

import { STTProvider, STTSession, STTTranscriptEvent } from './stt-provider'
import { STTError } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('assemblyai-stt')

export class AssemblyAISTTSession implements STTSession {
  public readonly id: string
  private ws: WebSocket | null = null
  private transcriptCallbacks: Set<(event: STTTranscriptEvent) => void> = new Set()
  private errorCallbacks: Set<(error: Error) => void> = new Set()
  private isClosed: boolean = false

  constructor(ws: WebSocket) {
    this.id = `assemblyai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    this.ws = ws

    this.ws.onmessage = (event) => {
      if (this.isClosed) return
      try {
        const data = JSON.parse(event.data.toString())
        if (data.message_type === 'PartialTranscript' || data.type === 'PartialTranscript') {
          const text = data.text || ''
          if (text.trim()) {
            this.emitTranscript(text.trim(), false)
          }
        } else if (data.message_type === 'FinalTranscript' || data.type === 'FinalTranscript' || data.text) {
          const text = data.text || ''
          if (text.trim()) {
            this.emitTranscript(text.trim(), true)
          }
        }
      } catch (err) {
        log.warn('Failed to parse AssemblyAI WebSocket message', { error: String(err) })
      }
    }

    this.ws.onerror = (event) => {
      log.error('AssemblyAI WebSocket error', { event })
      this.emitError(new STTError('ASSEMBLYAI_WS_ERROR', 'AssemblyAI WebSocket encountered an error'))
    }

    this.ws.onclose = (event) => {
      log.info('AssemblyAI WebSocket closed', { code: event.code, reason: event.reason })
    }
  }

  public sendAudio(chunk: ArrayBuffer): void {
    if (this.isClosed || !this.ws || this.ws.readyState !== 1 /* OPEN */) {
      return
    }
    this.ws.send(chunk)
  }

  public onTranscript(callback: (event: STTTranscriptEvent) => void): void {
    this.transcriptCallbacks.add(callback)
  }

  public onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback)
  }

  private emitTranscript(text: string, isFinal: boolean): void {
    for (const callback of this.transcriptCallbacks) {
      try {
        callback({ text, isFinal })
      } catch (err) {
        log.error('Transcript callback error', { error: String(err) })
      }
    }
  }

  private emitError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error)
      } catch (err) {
        log.error('Error callback error', { error: String(err) })
      }
    }
  }

  public async close(): Promise<void> {
    if (this.isClosed) return
    this.isClosed = true
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.transcriptCallbacks.clear()
    this.errorCallbacks.clear()
    log.info('AssemblyAISTTSession closed', { sessionId: this.id })
  }
}

export class AssemblyAISTTProvider implements STTProvider {
  public readonly name = 'assemblyai'
  public readonly displayName = 'AssemblyAI Real-Time STT'
  public readonly requiresApiKey = true

  private readonly workerUrl: string
  private readonly sharedSecret: string

  constructor(
    workerUrl: string = process.env.PIP_WORKER_URL || 'http://127.0.0.1:8787',
    sharedSecret: string = process.env.PIP_SHARED_SECRET || 'your-shared-secret-placeholder'
  ) {
    this.workerUrl = workerUrl
    this.sharedSecret = sharedSecret
  }

  public async createSession(): Promise<STTSession> {
    log.info('Creating AssemblyAI STT session via Worker token')

    let response: Response
    try {
      response = await fetch(`${this.workerUrl}/transcribe-token`, {
        method: 'GET',
        headers: {
          'X-Pip-Auth': this.sharedSecret
        }
      })
    } catch (err) {
      log.error('Failed to fetch transcribe token from Worker', { error: String(err) })
      throw new STTError('TOKEN_FETCH_FAILED', `Failed to fetch AssemblyAI token: ${String(err)}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new STTError('TOKEN_FETCH_HTTP_ERROR', `Worker returned HTTP ${response.status}: ${errorText}`)
    }

    const tokenData = await response.json()
    const token = tokenData.token || tokenData.temp_token

    if (!token) {
      throw new STTError('INVALID_TOKEN_RESPONSE', 'Worker returned response without token')
    }

    const wsUrl = `wss://streaming.assemblyai.com/v3/ws?token=${token}&sample_rate=16000`
    const ws = new WebSocket(wsUrl)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new STTError('WS_CONNECT_TIMEOUT', 'AssemblyAI WebSocket connection timed out'))
      }, 10000)

      ws.onopen = () => {
        clearTimeout(timeout)
        log.info('AssemblyAI WebSocket connection established')
        resolve()
      }

      ws.onerror = (err) => {
        clearTimeout(timeout)
        reject(new STTError('WS_CONNECT_FAILED', `AssemblyAI WebSocket connect failed: ${String(err)}`))
      }
    })

    return new AssemblyAISTTSession(ws)
  }
}
