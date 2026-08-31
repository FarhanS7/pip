import { describe, it, expect, vi } from 'vitest'

// Mock Electron desktopCapturer and screen
vi.mock('electron', () => {
  const mockNativeImage = {
    getSize: () => ({ width: 1920, height: 1080 }),
    resize: (_opts: { width: number; height: number }) => mockNativeImage,
    toJPEG: (_quality: number) => Buffer.from('fake-jpeg-data')
  }

  return {
    desktopCapturer: {
      getSources: vi.fn(async () => [
        {
          id: 'screen:0:0',
          name: 'Screen 1',
          display_id: '100',
          thumbnail: mockNativeImage
        }
      ])
    },
    screen: {
      getAllDisplays: vi.fn(() => [
        {
          id: 100,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 }
        }
      ])
    }
  }
})

import { captureAllScreens } from './screen-capture'

describe('Screen Capture', () => {
  it('captures connected displays and outputs formatted JPEG base64 data', async () => {
    const captures = await captureAllScreens()

    expect(captures).toHaveLength(1)
    expect(captures[0].displayId).toBe(100)
    expect(captures[0].screenIndex).toBe(0)
    expect(captures[0].bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
    expect(captures[0].jpegBase64).toBe(Buffer.from('fake-jpeg-data').toString('base64'))
  })
})
