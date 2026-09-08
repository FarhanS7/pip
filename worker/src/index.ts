/**
 * Pip Proxy Worker
 *
 * Edge proxy for API key protection and multi-provider streaming.
 * Securely holds Anthropic, OpenAI, Google AI, AssemblyAI, and ElevenLabs secrets.
 *
 * Routes:
 *   GET  /health            → Worker health check
 *   POST /chat              → Multi-provider AI streaming (Claude, OpenAI, Gemini)
 *   POST /tts               → Multi-provider TTS audio generation (ElevenLabs, OpenAI)
 *   POST /transcribe-token  → Temporary short-lived AssemblyAI WebSocket token
 */

import {
  MAX_BODY_SIZE_BYTES,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  validateChatRequestBody,
  validateTTSRequestBody,
  sanitizeErrorMessage
} from './validation.js'
import { isKillSwitchActive } from './admin.js'

interface Env {
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  GOOGLE_AI_KEY?: string
  ASSEMBLYAI_API_KEY?: string
  ELEVENLABS_API_KEY?: string
  ELEVENLABS_VOICE_ID?: string
  PIP_SHARED_SECRET?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Pip-Auth, X-Request-ID'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID()
    const responseHeaders = {
      ...CORS_HEADERS,
      'X-Request-ID': requestId
    }

    const url = new URL(request.url)

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'pip-proxy' }), {
          status: 200,
          headers: { ...responseHeaders, 'content-type': 'application/json' }
        })
      }

      if (await isKillSwitchActive(env)) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily disabled by administration' }),
          { status: 503, headers: { ...responseHeaders, 'content-type': 'application/json' } }
        )
      }

      const expectedSecret = env.PIP_SHARED_SECRET
      if (!expectedSecret?.trim() || expectedSecret.trim() === 'your-shared-secret-placeholder') {
        return new Response(
          JSON.stringify({ error: 'Service authentication is not configured' }),
          { status: 503, headers: { ...responseHeaders, 'content-type': 'application/json' } }
        )
      }

      const authHeader = request.headers.get('X-Pip-Auth')
      if (!authHeader || !(await credentialsMatch(authHeader, expectedSecret))) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Missing or invalid X-Pip-Auth header' }),
          { status: 401, headers: { ...responseHeaders, 'content-type': 'application/json' } }
        )
      }

      if (url.pathname === '/chat' && request.method === 'POST') {
        return await handleChat(request, env, responseHeaders, requestId)
      }

      if (url.pathname === '/tts' && request.method === 'POST') {
        return await handleTTS(request, env, responseHeaders, requestId)
      }

      if ((url.pathname === '/transcribe-token' || url.pathname === '/transcribe-token/') &&
          (request.method === 'POST' || request.method === 'GET')) {
        return await handleTranscribeToken(env, responseHeaders, requestId)
      }
    } catch (error) {
      console.error(`[${url.pathname}] Unhandled proxy error:`, error)
      return new Response(
        JSON.stringify({ error: sanitizeErrorMessage(error) }),
        { status: 500, headers: { ...responseHeaders, 'content-type': 'application/json' } }
      )
    }

    return new Response('Not found', { status: 404, headers: responseHeaders })
  }
}

async function credentialsMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ])
  return crypto.subtle.timingSafeEqual(providedDigest, expectedDigest)
}

/**
 * Handle AI chat completions (Claude, OpenAI, Gemini).
 */
async function handleChat(
  request: Request,
  env: Env,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const contentLengthStr = request.headers.get('content-length')
  if (contentLengthStr && parseInt(contentLengthStr, 10) > MAX_BODY_SIZE_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload exceeds maximum allowed size (16 MiB)' }), {
      status: 413,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }

  const bodyText = await request.text()
  const val = validateChatRequestBody(bodyText)
  if (!val.valid || !val.data) {
    return new Response(JSON.stringify({ error: val.error || 'Invalid request' }), {
      status: val.status || 400,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }

  const { provider, model, bodyJson } = val.data

  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured on Worker' }), {
        status: 500,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    }

    delete bodyJson.provider

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
          'x-request-id': requestId
        },
        body: JSON.stringify(bodyJson),
        signal: AbortSignal.timeout(DEFAULT_UPSTREAM_TIMEOUT_MS)
      })

      return new Response(response.body, {
        status: response.status,
        headers: {
          ...headers,
          'content-type': response.headers.get('content-type') || 'text/event-stream',
          'cache-control': 'no-cache'
        }
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: `OpenAI upstream request failed: ${sanitizeErrorMessage(err)}` }), {
        status: 502,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    }
  }

  if (provider === 'gemini') {
    if (!env.GOOGLE_AI_KEY) {
      return new Response(JSON.stringify({ error: 'GOOGLE_AI_KEY not configured on Worker' }), {
        status: 500,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    }

    const apiKey = env.GOOGLE_AI_KEY.trim().replace(/^["']|["']$/g, '')
    const targetModel = model || 'gemini-3.6-flash'
    delete bodyJson.provider
    delete bodyJson.model

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
            'x-request-id': requestId
          },
          body: JSON.stringify(bodyJson),
          signal: AbortSignal.timeout(DEFAULT_UPSTREAM_TIMEOUT_MS)
        }
      )

      if (resp.ok) {
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            ...headers,
            'content-type': resp.headers.get('content-type') || 'text/event-stream',
            'cache-control': 'no-cache'
          }
        })
      }

      const errorBody = await resp.text()
      return new Response(JSON.stringify({ error: `Gemini request failed (${resp.status}): ${sanitizeErrorMessage(errorBody)}` }), {
        status: resp.status,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: `Gemini upstream request failed: ${sanitizeErrorMessage(err)}` }), {
        status: 502,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    }
  }

  // Default provider: Anthropic Claude
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on Worker' }), {
      status: 500,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }

  delete bodyJson.provider

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-request-id': requestId
      },
      body: JSON.stringify(bodyJson),
      signal: AbortSignal.timeout(DEFAULT_UPSTREAM_TIMEOUT_MS)
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...headers,
        'content-type': response.headers.get('content-type') || 'text/event-stream',
        'cache-control': 'no-cache'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: `Claude upstream request failed: ${sanitizeErrorMessage(err)}` }), {
      status: 502,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }
}

/**
 * Handle TTS speech generation (ElevenLabs, OpenAI TTS).
 */
async function handleTTS(
  request: Request,
  env: Env,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const contentLengthStr = request.headers.get('content-length')
  if (contentLengthStr && parseInt(contentLengthStr, 10) > MAX_BODY_SIZE_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload exceeds maximum allowed size (16 MiB)' }), {
      status: 413,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }

  const bodyText = await request.text()
  const val = validateTTSRequestBody(bodyText)
  if (!val.valid || !val.data) {
    return new Response(JSON.stringify({ error: val.error || 'Invalid request' }), {
      status: val.status || 400,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }

  const { provider, voiceId: reqVoiceId, bodyJson } = val.data

  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured on Worker' }), {
        status: 500,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    }

    delete bodyJson.provider

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
          'x-request-id': requestId
        },
        body: JSON.stringify(bodyJson),
        signal: AbortSignal.timeout(DEFAULT_UPSTREAM_TIMEOUT_MS)
      })

      return new Response(response.body, {
        status: response.status,
        headers: {
          ...headers,
          'content-type': response.headers.get('content-type') || 'audio/mpeg'
        }
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: `OpenAI TTS upstream request failed: ${sanitizeErrorMessage(err)}` }), {
        status: 502,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    }
  }

  // Default: ElevenLabs
  if (!env.ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured on Worker' }), {
      status: 500,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }

  const voiceId = reqVoiceId || env.ELEVENLABS_VOICE_ID || 'kPzsL2i3teMYv0FxEYQ6'
  delete bodyJson.provider
  delete bodyJson.voiceId

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'content-type': 'application/json',
        'accept': 'audio/mpeg',
        'x-request-id': requestId
      },
      body: JSON.stringify(bodyJson),
      signal: AbortSignal.timeout(DEFAULT_UPSTREAM_TIMEOUT_MS)
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...headers,
        'content-type': response.headers.get('content-type') || 'audio/mpeg'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: `ElevenLabs TTS upstream request failed: ${sanitizeErrorMessage(err)}` }), {
      status: 502,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }
}

/**
 * Obtain temporary short-lived AssemblyAI real-time WebSocket token.
 */
async function handleTranscribeToken(
  env: Env,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  if (!env.ASSEMBLYAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'ASSEMBLYAI_API_KEY not configured on Worker' }), {
      status: 500,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }

  try {
    const response = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=480', {
      method: 'GET',
      headers: {
        'authorization': env.ASSEMBLYAI_API_KEY,
        'x-request-id': requestId
      },
      signal: AbortSignal.timeout(DEFAULT_UPSTREAM_TIMEOUT_MS)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(JSON.stringify({ error: sanitizeErrorMessage(errorText) }), {
        status: response.status,
        headers: { ...headers, 'content-type': 'application/json' }
      })
    }

    const data = await response.text()
    return new Response(data, {
      status: 200,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: `AssemblyAI upstream request failed: ${sanitizeErrorMessage(err)}` }), {
      status: 502,
      headers: { ...headers, 'content-type': 'application/json' }
    })
  }
}
