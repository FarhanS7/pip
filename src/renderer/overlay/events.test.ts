import { describe, it, expect, vi } from 'vitest'
import { subscribeCursorVisibility } from './events'
import type { PipAPI } from '../../shared/types/pip-api'
import type { SettingsPayload } from '../../shared/types/ipc'
import { DEFAULT_SETTINGS } from '../../shared/settings'

describe('Cursor settings binding', () => {
  it('loads saved visibility and unsubscribes on unmount', async () => {
    const stop = vi.fn()
    const api = { getSettings: async () => ({ ...DEFAULT_SETTINGS, cursorEnabled: false }), onSettingsChanged: () => stop } as unknown as PipAPI
    const update = vi.fn()
    const dispose = subscribeCursorVisibility(api, update)
    await Promise.resolve()
    expect(update).toHaveBeenCalledWith(false)
    dispose()
    expect(stop).toHaveBeenCalledOnce()
  })
  it('does not overwrite a live toggle with a delayed initial read', async () => {
    let resolve!: (settings: SettingsPayload) => void
    let changed!: (settings: SettingsPayload) => void
    const api = {
      getSettings: () => new Promise<SettingsPayload>(done => { resolve = done }),
      onSettingsChanged: (callback: typeof changed) => { changed = callback; return vi.fn() }
    } as unknown as PipAPI
    const update = vi.fn()
    const stop = subscribeCursorVisibility(api, update)
    changed({ ...DEFAULT_SETTINGS, cursorEnabled: false })
    resolve({ ...DEFAULT_SETTINGS, cursorEnabled: true })
    await Promise.resolve()
    expect(update).toHaveBeenCalledExactlyOnceWith(false)
    stop()
  })
})
