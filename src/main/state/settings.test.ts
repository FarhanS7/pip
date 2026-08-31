import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron-store before importing settings
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private memoryData: Record<string, unknown> = {}
      constructor(options?: { defaults?: Record<string, unknown> }) {
        if (options?.defaults) {
          this.memoryData = { ...options.defaults }
        }
      }
      get(key: string, defaultValue?: unknown) {
        return this.memoryData[key] ?? defaultValue
      }
      set(key: string, value: unknown) {
        this.memoryData[key] = value
      }
      get path() {
        return '/mock/path/pip-settings.json'
      }
      set store(val: Record<string, unknown>) {
        this.memoryData = { ...val }
      }
    }
  }
})

// Mock electron BrowserWindow
vi.mock('electron', () => {
  return {
    BrowserWindow: {
      getAllWindows: vi.fn(() => [])
    }
  }
})

import { getSettings, getSetting, setSetting, DEFAULT_SETTINGS } from './settings'

describe('Settings Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default settings when uninitialized', () => {
    const settings = getSettings()
    expect(settings).toEqual(DEFAULT_SETTINGS)
  })

  it('updates and retrieves a specific setting', () => {
    setSetting('selectedAIProvider', 'openai')
    expect(getSetting('selectedAIProvider')).toBe('openai')

    setSetting('cursorEnabled', false)
    expect(getSetting('cursorEnabled')).toBe(false)
  })
})
