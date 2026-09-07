import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { STTSession } from './audio/stt-provider'
import type { VisionPromptPayload } from './ai/ai-provider'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(), capture: vi.fn(), stream: vi.fn(), speak: vi.fn(), stop: vi.fn(), send: vi.fn()
}))
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: mocks.send } }] } }))
vi.mock('./audio/stt-provider', () => ({ createSTTProvider: () => ({ createSession: mocks.createSession }) }))
vi.mock('./screen/screen-capture', () => ({ captureAllScreens: mocks.capture, displaySnapshotMatches: () => true }))
vi.mock('./ai/ai-provider', () => ({ createAIProvider: () => ({ streamChat: mocks.stream }) }))
vi.mock('./tts/tts-provider', () => ({ createTTSProvider: () => ({ speak: mocks.speak, stop: mocks.stop }) }))
import { Orchestrator } from './orchestrator'
import { voiceStateMachine } from './state/voice-state-machine'
import { conversationHistory } from './state/conversation'
import { IpcChannel } from '../shared/channels'
import * as settings from './state/settings'

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
const process = () => {
  voiceStateMachine.transitionTo('processing', 'test')
  if (settings.getSettings().selectedSTTProvider === 'web-speech') orchestrator.finishBrowserRecognition('fixture request', voiceStateMachine.getTurnId())
}
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
afterEach(() => { orchestrator.destroy(); vi.restoreAllMocks() })

describe('Voice turn ownership', () => {
  it('processes typed input without starting speech recognition or broadcasting listening', async () => {
    orchestrator.submitText('typed request')
    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(mocks.send.mock.calls.some(call => call[0] === IpcChannel.VOICE_STATE_CHANGED && call[1].state === 'listening')).toBe(false)
    await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledOnce())
    expect((mocks.stream.mock.calls[0][0] as VisionPromptPayload).messages.at(-1)?.content).toBe('typed request')
  })

  it('rejects empty, oversized and overlapping typed requests', () => {
    expect(() => orchestrator.submitText(' ')).toThrow()
    expect(() => orchestrator.submitText('a'.repeat(16001))).toThrow()
    begin()
    expect(() => orchestrator.submitText('overlap')).toThrow()
    expect(voiceStateMachine.getState()).toBe('listening')
  })

  it('waits for browser completion and cancels an empty result without capturing', async () => {
    begin(); voiceStateMachine.transitionTo('processing', 'test')
    await Promise.resolve(); expect(mocks.capture).not.toHaveBeenCalled()
    orchestrator.finishBrowserRecognition('', voiceStateMachine.getTurnId())
    await Promise.resolve()
    expect(voiceStateMachine.getState()).toBe('idle')
    expect(mocks.capture).not.toHaveBeenCalled()
  })
  it('uses the final transcript received while STT is closing', async () => {
    vi.spyOn(settings, 'getSettings').mockReturnValue({ ...settings.getSettings(), selectedSTTProvider: 'assemblyai' })
    const stt = session()
    let transcript!: Parameters<STTSession['onTranscript']>[0]
    vi.mocked(stt.onTranscript).mockImplementation(callback => { transcript = callback })
    const finalized = deferred<void>()
    vi.mocked(stt.close).mockReturnValue(finalized.promise)
    mocks.createSession.mockResolvedValue(stt)
    begin()
    const id = voiceStateMachine.getTurnId()
    await orchestrator.receiveAudio(id, 0, new ArrayBuffer(3200))
    transcript({ text: 'partial', isFinal: false })
    process(); orchestrator.audioStopped(id)
    await vi.waitFor(() => expect(stt.close).toHaveBeenCalledOnce())
    expect(mocks.capture).not.toHaveBeenCalled()
    transcript({ text: 'complete request', isFinal: true }); finalized.resolve()
    await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledOnce())
    expect((mocks.stream.mock.calls[0][0] as VisionPromptPayload).messages.at(-1)?.content).toBe('complete request')
  })

  it('does not capture or call AI if STT finalization fails', async () => {
    vi.spyOn(settings, 'getSettings').mockReturnValue({ ...settings.getSettings(), selectedSTTProvider: 'assemblyai' })
    const stt = session()
    vi.mocked(stt.close).mockRejectedValue(new Error('finalization failed'))
    mocks.createSession.mockResolvedValue(stt)
    begin()
    const id = voiceStateMachine.getTurnId()
    await orchestrator.receiveAudio(id, 0, new ArrayBuffer(3200))
    process(); orchestrator.audioStopped(id)
    await vi.waitFor(() => expect(voiceStateMachine.getState()).toBe('idle'))
    expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled()
  })

  it('cancels failed STT startup and forwards the turn cancellation signal', async () => {
    mocks.createSession.mockRejectedValue(new Error('unavailable'))
    begin()
    await vi.waitFor(() => expect(voiceStateMachine.getState()).toBe('idle'))
    expect(mocks.createSession.mock.calls[0][0].aborted).toBe(true)
    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('delivers ordered PCM and drains it before closing STT or capturing the screen', async () => {
    vi.spyOn(settings, 'getSettings').mockReturnValue({ ...settings.getSettings(), selectedSTTProvider: 'assemblyai' })
    const stt = session()
    mocks.createSession.mockResolvedValue(stt)
    begin()
    const id = voiceStateMachine.getTurnId()
    const buffer = new ArrayBuffer(3200)
    await orchestrator.receiveAudio(id, 0, buffer)
    expect(stt.sendAudio).toHaveBeenCalledExactlyOnceWith(buffer)
    await expect(orchestrator.receiveAudio(id, 0, buffer)).rejects.toThrow('sequence')
    process()
    await Promise.resolve(); await Promise.resolve()
    expect(stt.close).not.toHaveBeenCalled()
    expect(mocks.capture).not.toHaveBeenCalled()
    await orchestrator.receiveAudio(id, 1, buffer)
    orchestrator.audioStopped(id)
    await vi.waitFor(() => expect(stt.close).toHaveBeenCalledOnce())
    await expect(orchestrator.receiveAudio(id, 2, buffer)).rejects.toThrow()
  })

  it('cancels empty microphone input instead of uploading a screen with a fallback prompt', async () => {
    vi.spyOn(settings, 'getSettings').mockReturnValue({ ...settings.getSettings(), selectedSTTProvider: 'assemblyai' })
    begin(); process()
    orchestrator.audioStopped(voiceStateMachine.getTurnId())
    await Promise.resolve()
    expect(voiceStateMachine.getState()).toBe('idle')
    expect(mocks.capture).not.toHaveBeenCalled()
  })
  it('ignores renderer transcripts belonging to an older turn', async () => {
    begin()
    const oldId = voiceStateMachine.getTurnId()
    orchestrator.cancel(); begin()
    orchestrator.setUtterance('current words', voiceStateMachine.getTurnId())
    orchestrator.setUtterance('stale words', oldId)
    voiceStateMachine.transitionTo('processing', 'test')
    orchestrator.finishBrowserRecognition('current words', voiceStateMachine.getTurnId())
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
