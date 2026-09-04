/**
 * Settings Manager
 *
 * Persists user configuration using `electron-store`.
 * Provides type-safe accessors, defaults, and emits IPC change broadcasts.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.3 (electron-store JSON configuration)
 *   PHASE_1_MODULES_AND_TASKS.md Task F.3 scoped checklist
 */

import { BrowserWindow } from 'electron'
import { IpcChannel } from '../ipc/channels'
import { SettingsPayload } from '../../shared/types/ipc'
import { createLogger } from '../logger'

const log = createLogger('settings')

export const DEFAULT_SETTINGS: SettingsPayload = {
  selectedAIProvider: 'gemini',
  selectedAIModel: 'gemini-3.6-flash',
  selectedSTTProvider: 'web-speech',
  selectedTTSProvider: 'browser',
  pushToTalkHotkey: 'CommandOrControl+Alt+Space',
  cursorEnabled: true
}

let store: any = null
let inMemoryStore: SettingsPayload = { ...DEFAULT_SETTINGS }

/**
 * Initialize the settings store asynchronously to support pure ESM electron-store in Electron CJS main process.
 */
export async function initSettingsStore(): Promise<any> {
  if (!store) {
    try {
      const { default: Store } = await import('electron-store')
      store = new Store<SettingsPayload>({
        name: 'pip-settings',
        defaults: DEFAULT_SETTINGS
      })
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsPayload)[]) {
        (inMemoryStore as any)[key] = store.get(key, DEFAULT_SETTINGS[key])
      }
      log.info('Settings store initialized', { path: store.path })
    } catch (err) {
      log.warn('Could not load electron-store ESM, using in-memory store', { error: String(err) })
    }
  }
  return store
}

/**
 * Get all current settings.
 */
export function getSettings(): SettingsPayload {
  if (store) {
    return {
      selectedAIProvider: store.get('selectedAIProvider', inMemoryStore.selectedAIProvider),
      selectedAIModel: store.get('selectedAIModel', inMemoryStore.selectedAIModel),
      selectedSTTProvider: store.get('selectedSTTProvider', inMemoryStore.selectedSTTProvider),
      selectedTTSProvider: store.get('selectedTTSProvider', inMemoryStore.selectedTTSProvider),
      pushToTalkHotkey: store.get('pushToTalkHotkey', inMemoryStore.pushToTalkHotkey),
      cursorEnabled: store.get('cursorEnabled', inMemoryStore.cursorEnabled)
    }
  }
  return { ...inMemoryStore }
}

/**
 * Get a specific setting by key.
 */
export function getSetting<K extends keyof SettingsPayload>(key: K): SettingsPayload[K] {
  if (store) {
    return store.get(key, inMemoryStore[key])
  }
  return inMemoryStore[key]
}

/**
 * Update a specific setting by key and broadcast the change via IPC.
 */
export function setSetting<K extends keyof SettingsPayload>(key: K, value: SettingsPayload[K]): void {
  inMemoryStore[key] = value
  if (store) {
    store.set(key, value)
  }
  log.info('Setting updated', { key, value })

  const updatedSettings = getSettings()
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannel.SETTINGS_CHANGED, updatedSettings)
    }
  }
}

/**
 * Reset all settings to defaults.
 */
export function resetSettingsToDefaults(): void {
  inMemoryStore = { ...DEFAULT_SETTINGS }
  if (store) {
    store.store = { ...DEFAULT_SETTINGS }
  }
  log.info('Settings reset to defaults')
}

