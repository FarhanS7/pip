/* Mono 16 kHz PCM16 encoder. Weighted averaging preserves phase across render blocks. */
class PipPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ratio = sampleRate / 16000
    this.weight = 0
    this.sum = 0
    this.samples = []
    this.running = true
    this.port.onmessage = event => {
      if (event.data === 'stop') {
        if (this.samples.length) this.emit()
        this.running = false
        this.port.postMessage({ stopped: true })
      }
    }
  }
  emit() {
    const buffer = new ArrayBuffer(this.samples.length * 2)
    const view = new DataView(buffer)
    this.samples.forEach((sample, index) => {
      const value = Math.max(-1, Math.min(1, sample))
      view.setInt16(index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true)
    })
    this.port.postMessage({ buffer }, [buffer])
    this.samples = []
  }
  process(inputs) {
    if (!this.running) return false
    const channels = inputs[0]
    if (!channels || !channels.length) return true
    for (let index = 0; index < channels[0].length; index++) {
      let mono = 0
      for (const channel of channels) mono += Number.isFinite(channel[index]) ? channel[index] / channels.length : 0
      let remaining = 1
      while (remaining > 1e-9) {
        const amount = Math.min(remaining, this.ratio - this.weight)
        this.sum += mono * amount
        this.weight += amount
        remaining -= amount
        if (this.weight >= this.ratio - 1e-9) {
          this.samples.push(this.sum / this.weight)
          this.sum = 0; this.weight = 0
          if (this.samples.length === 1600) this.emit()
        }
      }
    }
    return true
  }
}
registerProcessor('pip-pcm', PipPcmProcessor)
