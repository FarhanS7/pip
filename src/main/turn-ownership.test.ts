import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { STTSession } from './audio/stt-provider'
import type { VisionPromptPayload } from './ai/ai-provider'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(), capture: vi.fn(), stream: vi.fn(), speak: vi.fn(), stop: vi.fn(), send: vi.fn()
}))
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: mocks.send } }] } }))
vi.mock('./audio/stt-provider', () => ({ createSTTProvider: () => ({ createSession: mocks.createSession }) }))
vi.mock('./screen/screen-capture', () => ({ captureAllScreens: mocks.capture }))
vi.mock('./ai/ai-provider', () => ({ createAIProvider: () => ({ streamChat: mocks.stream }) }))
vi.mock('./tts/tts-provider', () => ({ createTTSProvider: () => ({ speak: mocks.speak, stop: mocks.stop }) }))
import { Orchestrator } from './orchestrator'
import { voiceStateMachine } from './state/voice-state-machine'
import { conversationHistory } from './state/conversation'
import { IpcChannel } from '../shared/channels'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function session(): STTSession {
  return { id: 'fixture', sendAudio: vi.fn(), onTranscript: vi.fn(), onError: vi.fn(), close: vi.fn(async () => {}) }
}
let orchestrator: Orchestrator
const begin = () => voiceStateMachine.transitionTo('listening', 'test')
const process = () => voiceStateMachine.transitionTo('processing', 'test')
beforeEach(() => {
  vi.resetAllMocks()
  voiceStateMachine.reset()
  conversationHistory.clear()
  mocks.createSession.mockResolvedValue(session())
  mocks.capture.mockResolvedValue([])
  mocks.stream.mockImplementation(async function* () { yield 'fixture response' })
  mocks.speak.mockResolvedValue(undefined)
  orchestrator = new Orchestrator()
})
afterEach(() => orchestrator.destroy())

describe('Voice turn ownership', () => {
  it('ignores renderer transcripts belonging to an older turn', async () => {
    begin()
    const oldId = voiceStateMachine.getTurnId()
    orchestrator.cancel(); begin()
    orchestrator.setUtterance('current words', voiceStateMachine.getTurnId())
    orchestrator.setUtterance('stale words', oldId)
    process()
    await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledOnce())
    expect((mocks.stream.mock.calls[0][0] as VisionPromptPayload).messages.at(-1)?.content).toBe('current words')
  })
  it('waits for delayed STT initialization on quick release and closes exactly once', async () => {
    const opened = deferred<STTSession>()
    const stt = session()
    mocks.createSession.mockReturnValueOnce(opened.promise)
    begin(); process()
    await Promise.resolve()
    expect(mocks.capture).not.toHaveBeenCalled()
    opened.resolve(stt)
    await vi.waitFor(() => expect(voiceStateMachine.getState()).toBe('idle'))
    expect(stt.close).toHaveBeenCalledOnce()
    expect(mocks.capture).toHaveBeenCalledOnce()
  })

  it('closes a late STT session after cancellation without starting capture', async () => {
    const opened = deferred<STTSession>()
    const stt = session()
    mocks.createSession.mockReturnValueOnce(opened.promise)
    begin(); process(); orchestrator.cancel()
    opened.resolve(stt)
    await vi.waitFor(() => expect(stt.close).toHaveBeenCalledOnce())
    expect(mocks.capture).not.toHaveBeenCalled()
    expect(conversationHistory.length).toBe(0)
  })

  it('discards a canceled capture result and leaves a new turn listening', async () => {
    const capture = deferred<[]>()
    mocks.capture.mockReturnValueOnce(capture.promise)
    begin(); process()
    await vi.waitFor(() => expect(mocks.capture).toHaveBeenCalledOnce())
    orchestrator.cancel(); begin()
    capture.resolve([])
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.stream).not.toHaveBeenCalled()
    expect(voiceStateMachine.getState()).toBe('listening')
  })

  it('aborts the old stream and ignores its late chunk after barge-in', async () => {
    const chunk = deferred<string>()
    mocks.stream.mockImplementationOnce(async function* () { yield await chunk.promise })
    begin(); process()
    await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledOnce())
    const payload = mocks.stream.mock.calls[0][0] as VisionPromptPayload
    begin()
    expect(payload.signal?.aborted).toBe(true)
    mocks.send.mockClear()
    chunk.resolve('stale [POINT:1,2:old]')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.send).not.toHaveBeenCalledWith(IpcChannel.AI_RESPONSE_CHUNK, expect.anything())
    expect(mocks.send).not.toHaveBeenCalledWith(IpcChannel.CURSOR_POSITION, expect.anything())
    expect(mocks.speak).not.toHaveBeenCalled()
    expect(conversationHistory.length).toBe(0)
    expect(voiceStateMachine.getState()).toBe('listening')
  })

  it('ignores an old streaming rejection after cancellation', async () => {
    const chunk = deferred<string>()
    mocks.stream.mockImplementationOnce(async function* () { yield await chunk.promise })
    begin(); process()
    await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledOnce())
    orchestrator.cancel(); begin()
    chunk.reject(new Error('late transport failure'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(voiceStateMachine.getState()).toBe('listening')
    expect(conversationHistory.length).toBe(0)
  })

  it('stops TTS and ignores its late completion when a new turn starts', async () => {
    const speech = deferred<void>()
    mocks.speak.mockReturnValueOnce(speech.promise)
    begin(); process()
    await vi.waitFor(() => expect(mocks.speak).toHaveBeenCalledOnce())
    const signal = mocks.speak.mock.calls[0][1] as AbortSignal
    begin()
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(signal.aborted).toBe(true)
    speech.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(voiceStateMachine.getState()).toBe('listening')
    expect(conversationHistory.length).toBe(0)
  })

  it('runs cleanup on forced reset and repeated cancellation is safe', async () => {
    const stt = session()
    mocks.createSession.mockResolvedValue(stt)
    begin()
    await Promise.resolve()
    voiceStateMachine.reset('external-reset')
    orchestrator.cancel(); orchestrator.cancel()
    await vi.waitFor(() => expect(stt.close).toHaveBeenCalledOnce())
    expect(voiceStateMachine.getState()).toBe('idle')
    expect(mocks.capture).not.toHaveBeenCalled()
  })
})
