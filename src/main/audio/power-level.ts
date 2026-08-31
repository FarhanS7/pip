/**
 * Audio Power Level Computation
 *
 * Computes RMS (Root Mean Square) audio power level from raw PCM audio buffers.
 * Applies exponential smoothing to produce fluid visualizer bar values (0.0 to 1.0).
 *
 * Formula:
 *   RMS = sqrt( sum(sample^2) / n )
 *   smoothed = max(rms * boost, prev * decayFactor)
 *
 * References:
 *   PHASE_1_MODULES_AND_TASKS.md Task B.2 scoped checklist
 */

export interface PowerLevelOptions {
  /** Gain multiplier boost (default: 1.8) */
  boostFactor?: number
  /** Exponential decay smoothing multiplier (default: 0.72) */
  decayFactor?: number
}

/**
 * Computes RMS audio power level from PCM16 or Float32 audio samples.
 *
 * @param samples - Float32Array (values -1.0 to 1.0) or Int16Array (values -32768 to 32767)
 * @param previousLevel - Previous normalized power level for exponential smoothing
 * @param options - Custom boost and decay parameters
 * @returns Normalized audio power level from 0.0 (silence) to 1.0 (max volume)
 */
export function computeAudioPowerLevel(
  samples: ArrayBufferView,
  previousLevel: number = 0,
  options: PowerLevelOptions = {}
): number {
  const boostFactor = options.boostFactor ?? 1.8
  const decayFactor = options.decayFactor ?? 0.72

  if (!samples || samples.byteLength === 0) {
    return Math.max(0, previousLevel * decayFactor)
  }

  let sumSquares = 0
  let sampleCount = 0

  if (samples instanceof Float32Array) {
    sampleCount = samples.length
    for (let i = 0; i < sampleCount; i++) {
      const val = samples[i]
      sumSquares += val * val
    }
  } else if (samples instanceof Int16Array) {
    sampleCount = samples.length
    for (let i = 0; i < sampleCount; i++) {
      const val = samples[i] / 32768.0 // Normalize to [-1.0, 1.0]
      sumSquares += val * val
    }
  } else {
    // Unsupported buffer view type
    return Math.max(0, previousLevel * decayFactor)
  }

  if (sampleCount === 0) {
    return Math.max(0, previousLevel * decayFactor)
  }

  const rawRms = Math.sqrt(sumSquares / sampleCount)
  const boostedRms = Math.min(1.0, rawRms * boostFactor)

  // Exponential smoothing with decay
  const smoothedLevel = Math.max(boostedRms, previousLevel * decayFactor)

  return Math.min(1.0, Math.max(0.0, smoothedLevel))
}
