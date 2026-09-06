import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fixture = vi.hoisted(() => ({ directory: '', send: vi.fn(), handlers: new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>() }))
vi.mock('electron', () => ({
  app: { getPath: () => fixture.directory, getVersion: () => '0.1.0' },
  ipcMain: { on: vi.fn(), handle: (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => fixture.handlers.set(channel, handler) },
  BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: fixture.send } }] }
}))
// Use actual electron-store and its atomic disk writes, with only the Electron host mocked.
import { DEFAULT_SETTINGS } from '../../shared/settings'
import { IpcChannel } from '../../shared/channels'

describe('Settings persistence and recovery', () => {
  beforeEach(() => {
    vi.resetModules()
    fixture.directory = mkdtempSync(join(tmpdir(), 'pip-settings-test-'))
    fixture.send.mockClear()
    fixture.handlers.clear()
  })
  afterEach(() => { rmSync(fixture.directory, { recursive: true, force: true }) })
  const path = () => join(fixture.directory, 'pip-settings.json')
  const load = async () => {
    const settings = await import('./settings')
    await settings.initSettingsStore()
    return settings
  }

  it('initializes once, persists updates and loads them after restart', async () => {
    const settings = await import('./settings')
    await Promise.all([settings.initSettingsStore(), settings.initSettingsStore()])
    expect(settings.getSettings()).toEqual(DEFAULT_SETTINGS)
    settings.setSetting('cursorEnabled', false)
    settings.setSetting('selectedAIProvider', 'openai')
    vi.resetModules()
    const restarted = await load()
    expect(restarted.getSetting('cursorEnabled')).toBe(false)
    expect(restarted.getSetting('selectedAIProvider')).toBe('openai')
    expect(JSON.parse(readFileSync(path(), 'utf8')).schemaVersion).toBe(1)
    expect(readdirSync(fixture.directory).some(name => name.includes('.migration-'))).toBe(false)
  })

  it('migrates legacy fields individually and preserves an exact backup', async () => {
    const original = JSON.stringify({ cursorEnabled: false, selectedAIProvider: 'openai', selectedTTSProvider: 'invalid', reset: true })
    writeFileSync(path(), original)
    const settings = await load()
    expect(settings.getSettings()).toEqual({ ...DEFAULT_SETTINGS, cursorEnabled: false, selectedAIProvider: 'openai' })
    const backup = readdirSync(fixture.directory).find(name => name.includes('.migration-'))!
    expect(readFileSync(join(fixture.directory, backup), 'utf8')).toBe(original)
    expect(JSON.parse(readFileSync(path(), 'utf8'))).not.toHaveProperty('reset')
  })

  it.each(['{broken', 'null', '[]', '42'])('recovers corrupt document %s with an exact backup', async original => {
    writeFileSync(path(), original)
    const settings = await load()
    expect(settings.getSettings()).toEqual(DEFAULT_SETTINGS)
    expect(settings.getSettingsNotice()).toContain('backed up')
    const backup = readdirSync(fixture.directory).find(name => name.includes('.corrupt-'))!
    expect(readFileSync(join(fixture.directory, backup), 'utf8')).toBe(original)
    settings.setSetting('cursorEnabled', false)
    expect(settings.getSetting('cursorEnabled')).toBe(false)
  })

  it('preserves newer documents and refuses to overwrite them', async () => {
    const original = '{"schemaVersion":2,"futurePreference":"keep"}'
    writeFileSync(path(), original)
    const settings = await load()
    expect(settings.getSettingsNotice()).toContain('cannot be saved')
    expect(() => settings.setSetting('cursorEnabled', false)).toThrow('unavailable')
    expect(() => settings.resetSettingsToDefaults()).toThrow('unavailable')
    expect(readFileSync(path(), 'utf8')).toBe(original)
  })

  it.each([
    ['reset', true], ['__proto__', {}], ['cursorEnabled', 'false'],
    ['selectedAIProvider', 'invalid'], ['selectedAIModel', ''],
    ['selectedSTTProvider', null], ['selectedTTSProvider', 'invalid'],
    ['pushToTalkHotkey', '\n'], ['pushToTalkHotkey', 'x'.repeat(129)]
  ])('rejects invalid update %s without persistence or broadcast', async (key, value) => {
    const settings = await load()
    const original = readFileSync(path(), 'utf8')
    expect(() => settings.setSetting(key, value)).toThrow('Invalid')
    expect(readFileSync(path(), 'utf8')).toBe(original)
    expect(settings.getSettings()).toEqual(DEFAULT_SETTINGS)
    expect(fixture.send).not.toHaveBeenCalled()
  })

  it('resets persistently and broadcasts defaults', async () => {
    const settings = await load()
    settings.setSetting('cursorEnabled', false)
    fixture.send.mockClear()
    settings.resetSettingsToDefaults()
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith(IpcChannel.SETTINGS_CHANGED, DEFAULT_SETTINGS)
    vi.resetModules()
    expect((await load()).getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('dispatches reset through its dedicated IPC channel and rejects malformed updates', async () => {
    const settings = await load()
    const { registerIpcHandlers } = await import('../ipc/handlers')
    registerIpcHandlers()
    const update = fixture.handlers.get(IpcChannel.SETTINGS_SET)!
    await update({}, { key: 'cursorEnabled', value: false })
    expect(settings.getSetting('cursorEnabled')).toBe(false)
    await expect(update({}, null)).rejects.toThrow('Invalid settings request')
    await expect(update({}, { key: 'reset', value: true })).rejects.toThrow('Invalid')
    await fixture.handlers.get(IpcChannel.SETTINGS_RESET)!({})
    expect(settings.getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps active values and emits nothing if a disk write fails', async () => {
    const settings = await load()
    settings.setSetting('cursorEnabled', false)
    fixture.send.mockClear()
    // Move the fixture file away and replace its directory with a file, forcing ENOTDIR.
    rmSync(fixture.directory, { recursive: true, force: true })
    writeFileSync(fixture.directory, 'blocked')
    try {
      expect(() => settings.resetSettingsToDefaults()).toThrow()
      expect(settings.getSetting('cursorEnabled')).toBe(false)
      expect(fixture.send).not.toHaveBeenCalled()
    } finally {
      rmSync(fixture.directory, { force: true })
    }
  })
})
