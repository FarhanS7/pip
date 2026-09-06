import { describe, it, expect, vi, afterEach } from 'vitest'
import { PlaybackController } from './playback-controller'
afterEach(() => vi.useRealTimers())
describe('Playback ownership and acknowledgement', () => {
  it('waits for readiness and matching completion instead of completing after send', async () => {
    const send = vi.fn()
    const media = new PlaybackController(send)
    const finished = vi.fn()
    const playback = media.speak('hello').then(finished)
    expect(send).not.toHaveBeenCalled()
    media.markReady()
    await Promise.resolve(); await Promise.resolve()
    const request = send.mock.calls[0][1]
    expect(send).toHaveBeenCalledWith('speak', { requestId: request.requestId, text: 'hello' })
    expect(finished).not.toHaveBeenCalled()
    media.complete({ requestId: request.requestId + 1, status: 'ended' })
    await Promise.resolve()
    expect(finished).not.toHaveBeenCalled()
    media.complete({ requestId: request.requestId, status: 'ended' })
    await playback
    expect(finished).toHaveBeenCalledOnce()
  })
  it('cancels a pending playback and ignores its stale completion', async () => {
    const send = vi.fn(), media = new PlaybackController(send)
    media.markReady()
    const controller = new AbortController()
    const first = media.speak('first', controller.signal)
    const rejected = expect(first).rejects.toThrow('cancelled')
    await Promise.resolve()
    const oldId = send.mock.calls[0][1].requestId
    controller.abort()
    await rejected
    const second = media.speak('second')
    await Promise.resolve()
    const nextId = send.mock.calls.at(-1)![1].requestId
    media.complete({ requestId: oldId, status: 'ended' })
    media.complete({ requestId: nextId, status: 'ended' })
    await second
    expect(send).toHaveBeenCalledWith('stop', { requestId: oldId })
  })
  it('rejects crash and playback errors rather than reporting success', async () => {
    const send = vi.fn(), media = new PlaybackController(send)
    media.markReady()
    const failed = media.speak('failure')
    const rejected = expect(failed).rejects.toThrow('failed')
    await Promise.resolve()
    media.complete({ requestId: send.mock.calls[0][1].requestId, status: 'error' })
    await rejected
    const crashed = media.speak('crash')
    const crashResult = expect(crashed).rejects.toThrow('unavailable')
    await Promise.resolve()
    media.disconnect()
    await crashResult
  })
  it('bounds readiness and playback waits and cancels before readiness without sending', async () => {
    vi.useFakeTimers()
    const send = vi.fn(), media = new PlaybackController(send)
    const waiting = expect(media.speak('not ready')).rejects.toThrow('ready')
    await vi.advanceTimersByTimeAsync(10000)
    await waiting
    const abort = new AbortController()
    const canceled = expect(media.speak('cancel', abort.signal)).rejects.toThrow('cancelled')
    abort.abort(); await canceled
    expect(send).not.toHaveBeenCalled()
    media.markReady()
    const timed = expect(media.speak('never ends')).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(180000)
    await timed
    expect(send).toHaveBeenCalledWith('stop', expect.anything())
  })
})
