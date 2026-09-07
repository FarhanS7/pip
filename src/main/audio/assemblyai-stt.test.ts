import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssemblyAISTTProvider, AssemblyAISTTSession } from './assemblyai-stt'
import type WebSocket from 'ws'

const mocks = vi.hoisted(() => ({ socket: vi.fn() }))
vi.mock('ws', () => ({ default: function (url: string) { return mocks.socket(url) } }))

class Socket {
  readyState = 1
  bufferedAmount = 0
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  send = vi.fn()
  close = vi.fn(() => { this.readyState = 3 })
  terminate = this.close
  message(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }) }
}
function fixture(signal?: AbortSignal) {
  const socket = new Socket()
  const session = new AssemblyAISTTSession(socket as unknown as WebSocket, signal)
  return { socket, session }
}
async function started(signal?: AbortSignal) {
  const result = fixture(signal)
  result.socket.message({ type: 'Begin', id: 'fixture' })
  await result.session.ready
  return result
}
const turn = (order: number, text: string, final = false, formatted = false) => ({
  type: 'Turn', turn_order: order, transcript: text, end_of_turn: final, turn_is_formatted: formatted
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('AssemblyAI v3 transport', () => {
  it('exchanges binary audio and final transcripts over a real loopback WebSocket', async () => {
    const actual = await vi.importActual<typeof import('ws')>('ws')
    const server = new actual.WebSocketServer({ host: '127.0.0.1', port: 0 })
    await new Promise<void>(resolve => server.once('listening', resolve))
    const address = server.address()
    if (typeof address === 'string' || !address) throw new Error('Missing loopback address')
    const received = vi.fn()
    server.on('connection', peer => {
      peer.send(JSON.stringify({ type: 'Begin' }))
      peer.on('message', (data, binary) => {
        if (binary) received(Buffer.isBuffer(data) ? data.byteLength : -1)
        else if (JSON.parse(String(data)).type === 'Terminate') {
          peer.send(JSON.stringify(turn(0, 'loopback final', true)))
          peer.send(JSON.stringify({ type: 'Termination' }))
        }
      })
    })
    const controller = new AbortController()
    const session = new AssemblyAISTTSession(new actual.WebSocket(`ws://127.0.0.1:${address.port}`), controller.signal)
    try {
      await session.ready
      const transcript = vi.fn(); session.onTranscript(transcript)
      session.sendAudio(new ArrayBuffer(3200))
      await session.close()
      expect(received).toHaveBeenCalledWith(3200)
      expect(transcript).toHaveBeenLastCalledWith({ text: 'loopback final', isFinal: true })
    } finally {
      controller.abort()
      for (const peer of server.clients) peer.terminate()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  it('waits for Begin, aggregates ordered turns and replaces formatted revisions without duplication', async () => {
    const { socket, session } = fixture()
    expect(() => session.sendAudio(new ArrayBuffer(3200))).toThrow()
    socket.message({ type: 'Begin' }); await session.ready
    const transcript = vi.fn(); session.onTranscript(transcript)
    socket.message(turn(0, 'hello'))
    socket.message(turn(0, 'hello', true))
    socket.message(turn(1, 'next', true))
    socket.message(turn(0, 'Hello.', true, true))
    socket.message(turn(0, 'stale partial'))
    expect(transcript).toHaveBeenLastCalledWith({ text: 'Hello. next', isFinal: true })
    expect(transcript).toHaveBeenCalledTimes(4)
    const closed = session.close()
    socket.message({ type: 'Termination' }); await closed
  })

  it('waits for the final Turn and Termination after Stop, then detaches handlers', async () => {
    const { socket, session } = await started()
    const transcript = vi.fn(); session.onTranscript(transcript)
    socket.message(turn(0, 'partial'))
    const closed = session.close(); const done = vi.fn(); void closed.then(done)
    expect(session.close()).toBe(closed)
    expect(socket.send).toHaveBeenLastCalledWith('{"type":"Terminate"}')
    expect(() => session.sendAudio(new ArrayBuffer(3200))).toThrow()
    await Promise.resolve(); expect(done).not.toHaveBeenCalled()
    socket.message(turn(0, 'final words', true))
    expect(transcript).toHaveBeenLastCalledWith({ text: 'final words', isFinal: true })
    socket.message({ type: 'Termination' }); await closed
    expect(socket.close).toHaveBeenCalledOnce()
    expect(socket.onmessage).toBeNull()
  })

  it('rejects termination with an unfinished partial', async () => {
    const { socket, session } = await started()
    socket.message(turn(0, 'unfinished'))
    const closed = session.close(); const rejected = expect(closed).rejects.toMatchObject({ code: 'STT_INCOMPLETE' })
    socket.message({ type: 'Termination' }); await rejected
  })

  it.each(['onerror', 'onclose'] as const)('reports %s and fails pending finalization', async event => {
    const { socket, session } = await started()
    const error = vi.fn(); session.onError(error)
    const closed = session.close(); const rejected = expect(closed).rejects.toThrow()
    socket[event]?.(); await rejected
    expect(error).toHaveBeenCalledOnce(); expect(socket.close).toHaveBeenCalledOnce()
  })

  it('bounds startup and closes a socket that never sends Begin', async () => {
    vi.useFakeTimers()
    const { socket, session } = fixture()
    const rejected = expect(session.ready).rejects.toMatchObject({ code: 'WS_CONNECT_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(10000); await rejected
    expect(socket.close).toHaveBeenCalledOnce()
  })

  it('bounds finalization and aborts immediately during finalization', async () => {
    vi.useFakeTimers()
    const first = await started()
    const rejected = expect(first.session.close()).rejects.toMatchObject({ code: 'STT_FINALIZATION_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(10000); await rejected
    const controller = new AbortController()
    const second = await started(controller.signal)
    const cancelled = expect(second.session.close()).rejects.toMatchObject({ code: 'STT_CANCELLED' })
    controller.abort(); await cancelled
    expect(second.socket.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects malformed messages and pads a short final audio chunk', async () => {
    const { socket, session } = await started()
    const bytes = new Uint8Array([1, 2])
    session.sendAudio(bytes.buffer)
    const sent = socket.send.mock.calls[0][0] as Uint8Array
    expect(sent.byteLength).toBe(1600); expect([...sent.slice(0, 3)]).toEqual([1, 2, 0])
    socket.bufferedAmount = 160001
    expect(() => session.sendAudio(new ArrayBuffer(3200))).toThrow()
    const error = vi.fn(); session.onError(error)
    socket.message({ type: 'Turn', turn_order: -1, transcript: 'invalid', end_of_turn: true })
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'STT_PROTOCOL_ERROR' }))
  })

  it('validates the token, URL-encodes it and waits for Begin rather than socket creation', async () => {
    const socket = new Socket()
    const construct = mocks.socket.mockReset().mockReturnValue(socket)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'fixture&token=other' }))))
    const pending = new AssemblyAISTTProvider('http://fixture', 'fixture-secret').createSession()
    await vi.waitFor(() => expect(construct).toHaveBeenCalledOnce())
    const url = new URL(construct.mock.calls[0][0] as unknown as string)
    expect(url.searchParams.get('token')).toBe('fixture&token=other')
    socket.message({ type: 'Begin' }); const session = await pending
    const closed = session.close(); socket.message({ type: 'Termination' }); await closed
  })

  it('does not expose response bodies or tokens in errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive fixture', { status: 403 })))
    await expect(new AssemblyAISTTProvider().createSession()).rejects.toThrow('Transcription could not complete')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 123 }))))
    await expect(new AssemblyAISTTProvider().createSession()).rejects.toThrow('Transcription could not complete')
  })

  it('aborts a pending token request on cancellation', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new Error('aborted')))
    })))
    const pending = new AssemblyAISTTProvider().createSession(controller.signal)
    const rejected = expect(pending).rejects.toThrow()
    controller.abort(); await rejected
  })
})
