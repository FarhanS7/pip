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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Pip-Auth'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'pip-proxy' }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
        })
      }

      // NOTE: Whichever task first implements a real call to this Worker (C.2, D.3, or B.5)
      // MUST send the X-Pip-Auth header matching env.PIP_SHARED_SECRET.
      const authHeader = request.headers.get('X-Pip-Auth')
      if (!env.PIP_SHARED_SECRET || authHeader !== env.PIP_SHARED_SECRET) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Missing or invalid X-Pip-Auth header' }),
          { status: 401, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } }
        )
      }

      if (url.pathname === '/chat' && request.method === 'POST') {
        return await handleChat(request, env)
      }

      if (url.pathname === '/tts' && request.method === 'POST') {
        return await handleTTS(request, env)
      }

      if ((url.pathname === '/transcribe-token' || url.pathname === '/transcribe-token/') &&
          (request.method === 'POST' || request.method === 'GET')) {
        return await handleTranscribeToken(env)
      }
    } catch (error) {
      console.error(`[${url.pathname}] Unhandled proxy error:`, error)
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } }
      )
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS })
  }
}

/**
 * Handle AI chat completions (Claude, OpenAI, Gemini).
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
  const bodyText = await request.text()
  let bodyJson: Record<string, unknown> = {}
  try {
    bodyJson = JSON.parse(bodyText)
  } catch {
    // Fall back to raw body text
  }

  const provider = (bodyJson.provider as string) || 'claude'

  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured on Worker' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
      })
    }

    // Strip custom provider field before forwarding to OpenAI
    delete bodyJson.provider

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(bodyJson)
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'content-type': response.headers.get('content-type') || 'text/event-stream',
        'cache-control': 'no-cache'
      }
    })
  }

  if (provider === 'gemini') {
    if (!env.GOOGLE_AI_KEY) {
      return new Response(JSON.stringify({ error: 'GOOGLE_AI_KEY not configured on Worker' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
      })
    }

    const model = (bodyJson.model as string) || 'gemini-2.5-flash'
    delete bodyJson.provider
    delete bodyJson.model

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GOOGLE_AI_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bodyJson)
      }
    )

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'content-type': response.headers.get('content-type') || 'text/event-stream',
        'cache-control': 'no-cache'
      }
    })
  }

  // Default provider: Anthropic Claude
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on Worker' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
    })
  }

  delete bodyJson.provider

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(bodyJson)
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'content-type': response.headers.get('content-type') || 'text/event-stream',
      'cache-control': 'no-cache'
    }
  })
}

/**
 * Handle TTS speech generation (ElevenLabs, OpenAI TTS).
 */
async function handleTTS(request: Request, env: Env): Promise<Response> {
  const bodyText = await request.text()
  let bodyJson: Record<string, unknown> = {}
  try {
    bodyJson = JSON.parse(bodyText)
  } catch {
    // Fall back
  }

  const provider = (bodyJson.provider as string) || 'elevenlabs'

  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured on Worker' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
      })
    }

    delete bodyJson.provider

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(bodyJson)
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'content-type': response.headers.get('content-type') || 'audio/mpeg'
      }
    })
  }

  // Default: ElevenLabs
  if (!env.ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured on Worker' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
    })
  }

  const voiceId = (bodyJson.voiceId as string) || env.ELEVENLABS_VOICE_ID || 'kPzsL2i3teMYv0FxEYQ6'
  delete bodyJson.provider
  delete bodyJson.voiceId

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'content-type': 'application/json',
      'accept': 'audio/mpeg'
    },
    body: JSON.stringify(bodyJson)
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'content-type': response.headers.get('content-type') || 'audio/mpeg'
    }
  })
}

/**
 * Obtain temporary short-lived AssemblyAI real-time WebSocket token.
 */
async function handleTranscribeToken(env: Env): Promise<Response> {
  if (!env.ASSEMBLYAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'ASSEMBLYAI_API_KEY not configured on Worker' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
    })
  }

  const response = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=480', {
    method: 'GET',
    headers: {
      'authorization': env.ASSEMBLYAI_API_KEY
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    return new Response(errorText, {
      status: response.status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
    })
  }

  const data = await response.text()
  return new Response(data, {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
  })
}
