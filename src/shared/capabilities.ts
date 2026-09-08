/**
 * Provider & Model Capability Catalog (Task B21)
 *
 * Defines capability metadata, vision support, and certification status
 * for AI models, STT providers, and TTS providers.
 */

export interface ModelCapability {
  id: string
  provider: 'claude' | 'openai' | 'gemini'
  displayName: string
  supportsVision: boolean
  certified: boolean
  recommended: boolean
  notes?: string
}

export interface STTCapability {
  id: 'assemblyai' | 'web-speech'
  displayName: string
  certified: boolean
  requiresApiKey: boolean
}

export interface TTSCapability {
  id: 'elevenlabs' | 'openai-tts' | 'browser'
  displayName: string
  certified: boolean
  requiresApiKey: boolean
}

export const AI_MODEL_CAPABILITIES: ReadonlyArray<ModelCapability> = Object.freeze([
  {
    id: 'gemini-3.6-flash',
    provider: 'gemini',
    displayName: 'Google Gemini 3.6 Flash',
    supportsVision: true,
    certified: true,
    recommended: true,
    notes: 'Primary certified vision streaming model (lowest cost & latency).'
  },
  {
    id: 'gemini-3.6-pro',
    provider: 'gemini',
    displayName: 'Google Gemini 3.6 Pro',
    supportsVision: true,
    certified: true,
    recommended: false,
    notes: 'High reasoning capacity model.'
  },
  {
    id: 'claude-sonnet-5',
    provider: 'claude',
    displayName: 'Anthropic Claude Sonnet 3.5 / 3.7',
    supportsVision: true,
    certified: true,
    recommended: true,
    notes: 'Certified Claude model with high screen grounding accuracy.'
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'OpenAI GPT-4o',
    supportsVision: true,
    certified: true,
    recommended: true,
    notes: 'Certified OpenAI vision model.'
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'OpenAI GPT-4o Mini',
    supportsVision: true,
    certified: true,
    recommended: false,
    notes: 'Fast lightweight OpenAI model.'
  }
])

export const STT_CAPABILITIES: ReadonlyArray<STTCapability> = Object.freeze([
  {
    id: 'assemblyai',
    displayName: 'AssemblyAI Real-Time WebSocket v3',
    certified: true,
    requiresApiKey: true
  },
  {
    id: 'web-speech',
    displayName: 'Browser Web Speech API (Free / Local)',
    certified: true,
    requiresApiKey: false
  }
])

export const TTS_CAPABILITIES: ReadonlyArray<TTSCapability> = Object.freeze([
  {
    id: 'elevenlabs',
    displayName: 'ElevenLabs Text-to-Speech (High Quality)',
    certified: true,
    requiresApiKey: true
  },
  {
    id: 'openai-tts',
    displayName: 'OpenAI TTS (Alloy)',
    certified: true,
    requiresApiKey: true
  },
  {
    id: 'browser',
    displayName: 'Browser Speech Synthesis (Free / Local)',
    certified: true,
    requiresApiKey: false
  }
])

export function getModelCapability(modelId: string): ModelCapability | undefined {
  return AI_MODEL_CAPABILITIES.find(m => m.id === modelId)
}

export function isCombinationCertified(
  aiProvider: string,
  aiModel: string,
  sttProvider: string,
  ttsProvider: string
): { certified: boolean; reason?: string } {
  const modelCap = getModelCapability(aiModel)
  if (!modelCap) {
    return { certified: false, reason: `Model '${aiModel}' is not recognized in the capability catalog.` }
  }
  if (modelCap.provider !== aiProvider) {
    return { certified: false, reason: `Model '${aiModel}' does not belong to provider '${aiProvider}'.` }
  }
  if (!modelCap.supportsVision) {
    return { certified: false, reason: `Model '${aiModel}' does not support screen vision analysis.` }
  }
  if (!modelCap.certified) {
    return { certified: false, reason: `Model '${aiModel}' is not currently certified for production use.` }
  }

  const sttCap = STT_CAPABILITIES.find(s => s.id === sttProvider)
  if (!sttCap || !sttCap.certified) {
    return { certified: false, reason: `STT provider '${sttProvider}' is not certified.` }
  }

  const ttsCap = TTS_CAPABILITIES.find(t => t.id === ttsProvider)
  if (!ttsCap || !ttsCap.certified) {
    return { certified: false, reason: `TTS provider '${ttsProvider}' is not certified.` }
  }

  return { certified: true }
}
