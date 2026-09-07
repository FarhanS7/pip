import type { PipAPI } from '../../shared/types/pip-api'

/** Serial IPC pump with a five-second PCM backlog ceiling. */
export class AudioChunkQueue {
  private queue: ArrayBuffer[] = []
  private draining: Promise<void> | null = null
  private failed = false
  private sequence = 0
  constructor(private send: (buffer: ArrayBuffer, sequence: number) => Promise<void>) {}
  enqueue(buffer: ArrayBuffer): void {
    if (this.failed) throw new Error('Audio transport failed')
    if (this.queue.length >= 50) { this.failed = true; throw new Error('Audio transport is too slow') }
    this.queue.push(buffer)
    this.draining ??= this.drain()
  }
  private async drain(): Promise<void> {
    try {
      while (this.queue.length && !this.failed) {
        const chunk = this.queue[0]
        await this.send(chunk, this.sequence++)
        this.queue.shift()
      }
    } catch (error) {
      this.failed = true
      throw error
    } finally { this.draining = null }
  }
  async flush(): Promise<void> {
    if (this.draining) await this.draining
    if (this.failed) throw new Error('Audio transport failed')
  }
  cancel(): void { this.failed = true; this.queue = [] }
  watchFailure(callback: () => void): void { void this.draining?.catch(callback) }
}

export function bindPcmMicrophone(api: PipAPI): () => void {
  let generation = 0
  let stopCurrent: (() => Promise<void>) | null = null
  const unsubscribe = api.onVoiceStateChanged(({ state, turnId }) => {
    const current = ++generation
    if (stopCurrent) { void stopCurrent(); stopCurrent = null }
    if (state !== 'listening' || turnId === undefined) return
    let stopped = false
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let worklet: AudioWorkletNode | null = null
    let stopping: Promise<void> | null = null
    let failureReported = false
    const queue = new AudioChunkQueue((buffer, sequence) => api.sendAudio(turnId, sequence, buffer))
    const cleanup = () => {
      stream?.getTracks().forEach(track => track.stop())
      source?.disconnect(); worklet?.disconnect()
      if (context) void context.close().catch(() => {})
    }
    const fail = () => {
      if (failureReported) return
      failureReported = true; stopped = true; queue.cancel(); cleanup()
      void api.reportAudioFailure(turnId).catch(() => {})
    }
    stopCurrent = () => stopping ??= (async () => {
      stopped = true
      try {
        if (worklet) {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Audio flush timed out')), 2000)
            worklet!.port.addEventListener('message', function finished(event) {
              if (event.data.stopped) {
                clearTimeout(timer); worklet!.port.removeEventListener('message', finished); resolve()
              }
            })
            worklet!.port.postMessage('stop')
          })
        }
        cleanup()
        await queue.flush()
        await api.audioStopped(turnId)
      } catch { fail() }
    })()
    void api.getSettings().then(async settings => {
      if (current !== generation || stopped || settings.selectedSTTProvider !== 'assemblyai') return
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false })
      if (current !== generation || stopped) { acquired.getTracks().forEach(track => track.stop()); return }
      stream = acquired
      stream.getTracks().forEach(track => track.addEventListener('ended', fail, { once: true }))
      context = new AudioContext()
      await context.audioWorklet.addModule(new URL('../pcm-worklet.js', window.location.href).href)
      if (current !== generation || stopped) { cleanup(); return }
      worklet = new AudioWorkletNode(context, 'pip-pcm')
      worklet.port.onmessage = event => {
        if (!(event.data.buffer instanceof ArrayBuffer) || failureReported) return
        try { queue.enqueue(event.data.buffer); queue.watchFailure(fail) } catch { fail() }
      }
      source = context.createMediaStreamSource(stream)
      source.connect(worklet)
      // The processor writes no output, keeping microphone monitoring silent.
      worklet.connect(context.destination)
      await context.resume()
      if (current !== generation || stopped) cleanup()
    }).catch(fail)
  })
  return () => { generation++; unsubscribe(); if (stopCurrent) void stopCurrent() }
}
