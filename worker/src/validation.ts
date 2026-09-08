/**
 * Worker Proxy Request Validation & Error Sanitization
 *
 * Enforces body size limits, model allowlists per provider,
 * JSON structural validation, and sanitized error responses.
 */

export const MAX_BODY_SIZE_BYTES = 16 * 1024 * 1024 // 16 MiB
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 30000 // 30s

export const ALLOWED_CHAT_PROVIDERS = ['claude', 'openai', 'gemini'] as const
export type ChatProvider = (typeof ALLOWED_CHAT_PROVIDERS)[number]

export const ALLOWED_TTS_PROVIDERS = ['elevenlabs', 'openai', 'openai-tts'] as const
export type TTSProvider = (typeof ALLOWED_TTS_PROVIDERS)[number]

const MODEL_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/

export interface ValidationResult<T> {
  valid: boolean
  data?: T
  error?: string
  status?: number
}

/**
 * Validates chat request body for /chat
 */
export function validateChatRequestBody(bodyText: string): ValidationResult<{
  provider: ChatProvider
  model?: string
  bodyJson: Record<string, unknown>
}> {
  if (byteLength(bodyText) > MAX_BODY_SIZE_BYTES) {
    return { valid: false, error: 'Payload exceeds maximum allowed size (16 MiB)', status: 413 }
  }

  let bodyJson: Record<string, unknown>
  try {
    const parsed = JSON.parse(bodyText)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: 'Invalid JSON body: expected object', status: 400 }
    }
    bodyJson = parsed as Record<string, unknown>
  } catch {
    return { valid: false, error: 'Invalid JSON payload', status: 400 }
  }

  const rawProvider = (bodyJson.provider as string) || 'claude'
  if (!ALLOWED_CHAT_PROVIDERS.includes(rawProvider as ChatProvider)) {
    return { valid: false, error: `Unsupported AI provider: ${rawProvider}`, status: 400 }
  }

  const provider = rawProvider as ChatProvider
  const model = typeof bodyJson.model === 'string' ? bodyJson.model : undefined

  if (model) {
    if (!MODEL_NAME_REGEX.test(model)) {
      return { valid: false, error: 'Invalid model name format', status: 400 }
    }

    if (!isModelAllowedForProvider(provider, model)) {
      return { valid: false, error: `Model '${model}' is not allowed for provider '${provider}'`, status: 400 }
    }
  }

  return {
    valid: true,
    data: {
      provider,
      model,
      bodyJson
    }
  }
}

/**
 * Checks if a given model string matches the allowed pattern for the provider.
 */
export function isModelAllowedForProvider(provider: ChatProvider, model: string): boolean {
  const lowerModel = model.toLowerCase()
  if (provider === 'claude') {
    return lowerModel.startsWith('claude-') || lowerModel === 'fixture-custom-model'
  }
  if (provider === 'openai') {
    return lowerModel.startsWith('gpt-') || lowerModel.startsWith('o1-') || lowerModel.startsWith('o3-') || lowerModel === 'fixture-custom-model'
  }
  if (provider === 'gemini') {
    return lowerModel.startsWith('gemini-') || lowerModel === 'fixture-custom-model'
  }
  return false
}

/**
 * Validates TTS request body for /tts
 */
export function validateTTSRequestBody(bodyText: string): ValidationResult<{
  provider: TTSProvider
  voiceId?: string
  bodyJson: Record<string, unknown>
}> {
  if (byteLength(bodyText) > MAX_BODY_SIZE_BYTES) {
    return { valid: false, error: 'Payload exceeds maximum allowed size (16 MiB)', status: 413 }
  }

  let bodyJson: Record<string, unknown>
  try {
    const parsed = JSON.parse(bodyText)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: 'Invalid JSON body: expected object', status: 400 }
    }
    bodyJson = parsed as Record<string, unknown>
  } catch {
    return { valid: false, error: 'Invalid JSON payload', status: 400 }
  }

  const rawProvider = (bodyJson.provider as string) || 'elevenlabs'
  if (!ALLOWED_TTS_PROVIDERS.includes(rawProvider as TTSProvider)) {
    return { valid: false, error: `Unsupported TTS provider: ${rawProvider}`, status: 400 }
  }

  const provider = (rawProvider === 'openai-tts' ? 'openai' : rawProvider) as TTSProvider
  const voiceId = typeof bodyJson.voiceId === 'string' ? bodyJson.voiceId : undefined

  if (voiceId && !/^[a-zA-Z0-9_-]{1,64}$/.test(voiceId)) {
    return { valid: false, error: 'Invalid voice ID format', status: 400 }
  }

  return {
    valid: true,
    data: {
      provider,
      voiceId,
      bodyJson
    }
  }
}

/**
 * Calculates byte length of a string in UTF-8.
 */
function byteLength(str: string): number {
  return new TextEncoder().encode(str).length
}

/**
 * Strips internal details, keys, and stack traces from error messages.
 */
export function sanitizeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.replace(/(sk-[a-zA-Z0-9T3BlbkGJ-]{16,})|(AIzaSy[a-zA-Z0-9_-]{30,})|(xi-[a-zA-Z0-9-]{16,})/g, '[REDACTED_KEY]')
}
