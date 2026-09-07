import { afterEach, describe, it, expect, vi } from 'vitest'
import type { DesktopCapturerSource, Display, NativeImage } from 'electron'
const fixtures = vi.hoisted(() => ({ displays: vi.fn(), sources: vi.fn() }))
vi.mock('electron', () => ({
  screen: { getAllDisplays: fixtures.displays, getPrimaryDisplay: () => ({ id: 100 }) },
  desktopCapturer: { getSources: fixtures.sources }
}))
import { captureAllScreens } from './screen-capture'
const display = (id: number) => ({ id, bounds: { x: id === 100 ? 0 : -1920, y: 0, width: 1920, height: 1080 } }) as Display
function image(width = 1920, height = 1080, label = 'fixture'): NativeImage {
  return { getSize: () => ({ width, height }), resize: (size: { width: number; height: number }) => image(size.width, size.height, label), toJPEG: () => Buffer.from(label) } as unknown as NativeImage
}
const source = (id: number) => ({ display_id: String(id), thumbnail: image(1920, 1080, String(id)) }) as DesktopCapturerSource
afterEach(() => vi.resetAllMocks())
describe('Screen capture identity', () => {
  it('matches reordered sources by display ID and records actual resized geometry', async () => {
    fixtures.displays.mockReturnValue([display(100), display(200)])
    fixtures.sources.mockResolvedValue([source(200), source(100)])
    const captures = await captureAllScreens()
    expect(captures.map(item => item.jpegBase64)).toEqual([Buffer.from('100').toString('base64'), Buffer.from('200').toString('base64')])
    expect(captures[0]).toMatchObject({ displayId: 100, screenIndex: 0, isPrimary: true, imageSize: { width: 1280, height: 720 } })
    expect(captures[1].bounds.x).toBe(-1920)
  })
  it('does not assign missing or ambiguous sources to another monitor', async () => {
    fixtures.displays.mockReturnValue([display(100), display(200)])
    fixtures.sources.mockResolvedValue([source(200)])
    expect((await captureAllScreens()).map(item => item.screenIndex)).toEqual([1])
    fixtures.sources.mockResolvedValue([source(200), source(200)])
    expect(await captureAllScreens()).toEqual([])
  })
  it('rejects invalid capture limits', async () => {
    await expect(captureAllScreens({ maxLongestEdge: Infinity })).rejects.toThrow()
    await expect(captureAllScreens({ jpegQuality: 0 })).rejects.toThrow()
    expect(fixtures.sources).not.toHaveBeenCalled()
  })
})

it('detects moved or disconnected displays before pointing', async () => {
  const { displaySnapshotMatches } = await import('./screen-capture')
  fixtures.displays.mockReturnValue([display(100)])
  const snapshot = [{ displayId: 100, bounds: display(100).bounds }]
  expect(displaySnapshotMatches(snapshot)).toBe(true)
  fixtures.displays.mockReturnValue([{ ...display(100), bounds: { ...display(100).bounds, x: 200 } }])
  expect(displaySnapshotMatches(snapshot)).toBe(false)
  fixtures.displays.mockReturnValue([])
  expect(displaySnapshotMatches(snapshot)).toBe(false)
})
