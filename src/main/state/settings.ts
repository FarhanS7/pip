import { app, BrowserWindow } from 'electron'
import type Store from 'electron-store'
import { readFileSync, copyFileSync, renameSync, constants } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { IpcChannel } from '../ipc/channels'
import type { SettingsPayload } from '../../shared/types/ipc'
import { DEFAULT_SETTINGS, PROVIDER_DEFAULT_MODELS, normalizeSettings, validateSetting } from '../../shared/settings'
import { createLogger } from '../logger'

export { DEFAULT_SETTINGS } from '../../shared/settings'
const log = createLogger('settings')
const SCHEMA_VERSION = 1
let store: Store<Record<string, unknown>> | null = null
let current: SettingsPayload = { ...DEFAULT_SETTINGS }
let initialization: Promise<void> | null = null
let notice: string | null = null
type SettingsEffect = (next: SettingsPayload) => { commit(): void; rollback(): void }
let prepareEffect: SettingsEffect | null = null
export function setSettingsEffect(effect: SettingsEffect): void { prepareEffect = effect }
export function reportSettingsNotice(message: string): void { notice = message }

/** Initialize once before IPC, windows, or the orchestrator can change settings. */
export function initSettingsStore(): Promise<void> {
  initialization ??= loadSettings()
  return initialization
}

async function loadSettings(): Promise<void> {
  try {
    const path = join(app.getPath('userData'), 'pip-settings.json')
    let raw: Record<string, unknown> = {}
    let contents: string | undefined
    try {
      contents = readFileSync(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (contents !== undefined) {
      try {
        const parsed: unknown = JSON.parse(contents)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('Invalid settings document')
        raw = parsed as Record<string, unknown>
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
        // Preserve the exact corrupt file before creating a clean store.
        renameSync(path, `${path}.corrupt-${randomUUID()}.bak`)
        notice = 'Invalid settings were backed up. Defaults have been restored.'
        contents = undefined
      }
    }
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== SCHEMA_VERSION) {
      throw new Error('Unsupported settings version')
    }
    const normalized = normalizeSettings(raw)
    if (normalized.selectedAIProvider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
      log.info('Anthropic API key not detected in environment, falling back to Gemini provider')
      normalized.selectedAIProvider = 'gemini'
      normalized.selectedAIModel = PROVIDER_DEFAULT_MODELS.gemini
    }
    if (normalized.selectedTTSProvider === 'elevenlabs' && !process.env.ELEVENLABS_API_KEY) {
      log.info('ElevenLabs API key not detected in environment, falling back to Browser TTS provider')
      normalized.selectedTTSProvider = 'browser'
    }
    const document = { ...normalized, schemaVersion: SCHEMA_VERSION, ...(raw.__internal__ === undefined ? {} : { __internal__: raw.__internal__ }) }
    const changed = raw.schemaVersion !== SCHEMA_VERSION ||
      Object.entries(normalized).some(([key, value]) => raw[key] !== value) ||
      Object.keys(raw).some(key => key !== 'schemaVersion' && key !== '__internal__' && !Object.hasOwn(normalized, key))
    if (contents !== undefined && changed) {
      copyFileSync(path, `${path}.migration-${randomUUID()}.bak`, constants.COPYFILE_EXCL)
    }
    const { default: ElectronStore } = await import('electron-store')
    const candidate = new ElectronStore<Record<string, unknown>>({ name: 'pip-settings', cwd: app.getPath('userData'), clearInvalidConfig: false })
    if (changed) candidate.store = document
    store = candidate
    current = normalized
  } catch (error) {
    notice = 'Settings could not be loaded. Using defaults; changes cannot be saved. Your existing file is preserved. Restart after resolving the storage problem.'
    log.warn('Settings storage unavailable', { error: String(error) })
  }
}

export function getSettings(): SettingsPayload { return { ...current } }
export function getSettingsNotice(): string | null { return notice }
export function getSetting<K extends keyof SettingsPayload>(key: K): SettingsPayload[K] { return current[key] }

function commit(next: SettingsPayload): void {
  if (!store) throw new Error('Settings storage is unavailable; changes were not saved')
  // electron-store commits atomically. Do not publish in-memory state on write failure.
  const effect = prepareEffect?.(next)
  try {
    store.store = { ...store.store, ...next, schemaVersion: SCHEMA_VERSION }
  } catch (error) {
    effect?.rollback()
    throw error
  }
  current = next
  effect?.commit()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IpcChannel.SETTINGS_CHANGED, getSettings())
  }
}

export function setSetting(key: unknown, value: unknown): void {
  validateSetting(key, value)
  const next = { ...current, [key]: value }
  if (key === 'selectedAIProvider' && next.selectedAIProvider !== current.selectedAIProvider) {
    next.selectedAIModel = PROVIDER_DEFAULT_MODELS[next.selectedAIProvider]
  }
  commit(next)
}

export function resetSettingsToDefaults(): void { commit({ ...DEFAULT_SETTINGS }) }
