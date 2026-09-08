import { describe, expect, it } from 'vitest'
import {
  AI_MODEL_CAPABILITIES,
  STT_CAPABILITIES,
  TTS_CAPABILITIES,
  isCombinationCertified,
  getModelCapability
} from '../../shared/capabilities'

describe('Provider Capability Catalog & Certification (B21)', () => {
  it('contains certified primary defaults for all supported AI providers', () => {
    const gemini = getModelCapability('gemini-3.6-flash')
    expect(gemini).toBeDefined()
    expect(gemini?.supportsVision).toBe(true)
    expect(gemini?.certified).toBe(true)

    const claude = getModelCapability('claude-sonnet-5')
    expect(claude).toBeDefined()
    expect(claude?.supportsVision).toBe(true)
    expect(claude?.certified).toBe(true)

    const openai = getModelCapability('gpt-4o')
    expect(openai).toBeDefined()
    expect(openai?.supportsVision).toBe(true)
    expect(openai?.certified).toBe(true)
  })

  it('validates certified combination checks correctly', () => {
    // Certified combination
    const res1 = isCombinationCertified('gemini', 'gemini-3.6-flash', 'web-speech', 'browser')
    expect(res1.certified).toBe(true)

    // Provider mismatch
    const res2 = isCombinationCertified('claude', 'gemini-3.6-flash', 'web-speech', 'browser')
    expect(res2.certified).toBe(false)
    expect(res2.reason).toContain('does not belong to provider')

    // Unknown model
    const res3 = isCombinationCertified('gemini', 'unknown-model-xyz', 'web-speech', 'browser')
    expect(res3.certified).toBe(false)
    expect(res3.reason).toContain('not recognized')
  })

  it('verifies that all defined capabilities have valid fields', () => {
    for (const model of AI_MODEL_CAPABILITIES) {
      expect(model.id).toBeTruthy()
      expect(['claude', 'openai', 'gemini']).toContain(model.provider)
      expect(typeof model.supportsVision).toBe('boolean')
    }

    for (const stt of STT_CAPABILITIES) {
      expect(stt.id).toBeTruthy()
      expect(typeof stt.certified).toBe('boolean')
    }

    for (const tts of TTS_CAPABILITIES) {
      expect(tts.id).toBeTruthy()
      expect(typeof tts.certified).toBe('boolean')
    }
  })

  // Live smoke test harness (run manually with live credentials when RUN_LIVE_CERTIFICATION=true)
  if (process.env.RUN_LIVE_CERTIFICATION === 'true') {
    it('runs live provider certification smoke test', async () => {
      const workerUrl = process.env.PIP_WORKER_URL || 'http://127.0.0.1:8787'
      const secret = process.env.PIP_SHARED_SECRET || ''

      const response = await fetch(`${workerUrl}/health`)
      expect(response.status).toBe(200)

      if (secret) {
        const tokenResp = await fetch(`${workerUrl}/transcribe-token`, {
          headers: { 'X-Pip-Auth': secret }
        })
        expect(tokenResp.status).toBe(200)
      }
    })
  }
})
