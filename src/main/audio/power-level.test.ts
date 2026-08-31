import { describe, it, expect } from 'vitest'
import { computeAudioPowerLevel } from './power-level'

describe('computeAudioPowerLevel', () => {
  it('returns 0.0 for pure silence buffer', () => {
    const silence = new Float32Array(512)
    const level = computeAudioPowerLevel(silence, 0)
    expect(level).toBe(0.0)
  })

  it('computes power level for full scale sine wave', () => {
    const samples = new Float32Array(512)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / 512) * Math.PI * 2)
    }
    const level = computeAudioPowerLevel(samples, 0)
    expect(level).toBeGreaterThan(0.5)
    expect(level).toBeLessThanOrEqual(1.0)
  })

  it('handles Int16Array PCM buffers', () => {
    const samples = new Int16Array(512)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 16384 // 50% amplitude
    }
    const level = computeAudioPowerLevel(samples, 0)
    expect(level).toBeGreaterThan(0.5)
    expect(level).toBeLessThanOrEqual(1.0)
  })

  it('applies exponential decay when silent buffer follows loud buffer', () => {
    const silence = new Float32Array(512)
    const decayLevel = computeAudioPowerLevel(silence, 0.8)
    expect(decayLevel).toBeCloseTo(0.8 * 0.72, 2)
  })
})
