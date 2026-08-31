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

import Store from 'electron-store'
import { BrowserWindow } from 'electron'
import { IpcChannel } from '../ipc/channels'
import { SettingsPayload } from '../../shared/types/ipc'
import { createLogger } from '../logger'

const log = createLogger('settings')

export const DEFAULT_SETTINGS: SettingsPayload = {
  selectedAIProvider: 'claude',
  selectedAIModel: 'claude-3-5-sonnet-20241022',
  selectedSTTProvider: 'assemblyai',
  selectedTTSProvider: 'elevenlabs',
  pushToTalkHotkey: 'CommandOrControl+Alt+Space',
  cursorEnabled: true
}

let store: Store<SettingsPayload> | null = null

/**
 * Initialize the settings store.
 */
export function initSettingsStore(): Store<SettingsPayload> {
  if (!store) {
    store = new Store<SettingsPayload>({
      name: 'pip-settings',
      defaults: DEFAULT_SETTINGS
    })
    log.info('Settings store initialized', { path: store.path })
  }
  return store
}

/**
 * Get all current settings.
 */
export function getSettings(): SettingsPayload {
  const s = initSettingsStore()
  return {
    selectedAIProvider: s.get('selectedAIProvider', DEFAULT_SETTINGS.selectedAIProvider),
    selectedAIModel: s.get('selectedAIModel', DEFAULT_SETTINGS.selectedAIModel),
    selectedSTTProvider: s.get('selectedSTTProvider', DEFAULT_SETTINGS.selectedSTTProvider),
    selectedTTSProvider: s.get('selectedTTSProvider', DEFAULT_SETTINGS.selectedTTSProvider),
    pushToTalkHotkey: s.get('pushToTalkHotkey', DEFAULT_SETTINGS.pushToTalkHotkey),
    cursorEnabled: s.get('cursorEnabled', DEFAULT_SETTINGS.cursorEnabled)
  }
}

/**
 * Get a specific setting by key.
 */
export function getSetting<K extends keyof SettingsPayload>(key: K): SettingsPayload[K] {
  const s = initSettingsStore()
  return s.get(key, DEFAULT_SETTINGS[key])
}

/**
 * Update a specific setting by key and broadcast the change via IPC.
 */
export function setSetting<K extends keyof SettingsPayload>(key: K, value: SettingsPayload[K]): void {
  const s = initSettingsStore()
  s.set(key, value)
  log.info('Setting updated', { key, value })

  // Broadcast settings change to all renderer windows
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
  const s = initSettingsStore()
  s.store = { ...DEFAULT_SETTINGS }
  log.info('Settings reset to defaults')
}
