export interface SpeechRequest { requestId: number; text: string }
export interface PlaybackResult { requestId: number; status: 'ended' | 'error' }

/** Single playback owner. Transport readiness and completion are independent. */
export class PlaybackController {
  private ready = false
  private sequence = 0
  private pending: { id: number; finish: (error?: Error) => void } | null = null
  private waiters = new Set<(error?: Error) => void>()
  constructor(private send: (command: 'speak' | 'stop', payload: SpeechRequest | { requestId: number }) => void) {}

  markReady(): void {
    this.ready = true
    for (const resolve of [...this.waiters]) resolve()
  }
  disconnect(): void {
    this.ready = false
    for (const reject of [...this.waiters]) reject(new Error('Media renderer unavailable'))
    this.pending?.finish(new Error('Media renderer unavailable'))
  }
  private awaitReady(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (this.ready) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer); this.waiters.delete(finish); signal?.removeEventListener('abort', abort)
        if (error) reject(error); else resolve()
      }
      const abort = () => finish(new Error('Playback cancelled'))
      const timer = setTimeout(() => finish(new Error('Media renderer did not become ready')), 10000)
      this.waiters.add(finish)
      signal?.addEventListener('abort', abort, { once: true })
    })
  }
  async speak(text: string, signal?: AbortSignal): Promise<void> {
    const id = ++this.sequence
    this.stopActive()
    await this.awaitReady(signal)
    signal?.throwIfAborted()
    if (id !== this.sequence) throw new Error('Playback superseded')
    return new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        if (this.pending?.id !== id) return
        this.pending = null
        clearTimeout(timer); signal?.removeEventListener('abort', abort)
        if (error) reject(error); else resolve()
      }
      const abort = () => { this.sendStop(id); finish(new Error('Playback cancelled')) }
      const timer = setTimeout(() => { this.sendStop(id); finish(new Error('Playback timed out')) }, 180000)
      this.pending = { id, finish }
      signal?.addEventListener('abort', abort, { once: true })
      try { this.send('speak', { requestId: id, text }) } catch { finish(new Error('Media renderer unavailable')) }
    })
  }
  complete(result: PlaybackResult): void {
    if (this.pending?.id !== result.requestId) return
    this.pending.finish(result.status === 'ended' ? undefined : new Error('Audio playback failed'))
  }
  stop(): void { this.sequence++; this.stopActive() }
  private sendStop(id: number): void { try { this.send('stop', { requestId: id }) } catch { /* Renderer may have crashed. */ } }
  private stopActive(): void {
    if (this.pending) { this.sendStop(this.pending.id); this.pending.finish(new Error('Playback cancelled')) }
  }
}
