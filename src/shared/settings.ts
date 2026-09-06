import type { SettingsPayload } from './types/ipc'
export const PROVIDER_DEFAULT_MODELS = {
  claude: 'claude-sonnet-5', openai: 'gpt-4o', gemini: 'gemini-3.6-flash'
} as const

export const DEFAULT_SETTINGS: Readonly<SettingsPayload> = Object.freeze({
  selectedAIProvider: 'gemini',
  selectedAIModel: PROVIDER_DEFAULT_MODELS.gemini,
  selectedSTTProvider: 'web-speech',
  selectedTTSProvider: 'browser',
  pushToTalkHotkey: 'CommandOrControl+Alt+Space',
  cursorEnabled: true
})

const validators: { [K in keyof SettingsPayload]: (value: unknown) => boolean } = {
  selectedAIProvider: value => typeof value === 'string' && ['claude', 'openai', 'gemini'].includes(value),
  selectedAIModel: value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(value),
  selectedSTTProvider: value => value === 'assemblyai' || value === 'web-speech',
  selectedTTSProvider: value => value === 'elevenlabs' || value === 'openai-tts' || value === 'browser',
  // Native accelerator registration and rollback are handled by B10.
  pushToTalkHotkey: value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128 && !/[\r\n]/.test(value) && !value.includes(String.fromCharCode(0)),
  cursorEnabled: value => typeof value === 'boolean'
}

export function isSettingKey(key: unknown): key is keyof SettingsPayload {
  return typeof key === 'string' && Object.hasOwn(validators, key)
}

export function validateSetting(key: unknown, value: unknown): asserts key is keyof SettingsPayload {
  if (!isSettingKey(key) || !validators[key](value)) throw new Error('Invalid setting or value')
}

export function normalizeSettings(raw: Record<string, unknown>): SettingsPayload {
  const result = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsPayload)[]) {
    if (validators[key](raw[key])) Object.assign(result, { [key]: raw[key] })
  }
  if (!validators.selectedAIModel(raw.selectedAIModel) ||
    Object.entries(PROVIDER_DEFAULT_MODELS).some(([provider, model]) => provider !== result.selectedAIProvider && model === result.selectedAIModel)) {
    result.selectedAIModel = PROVIDER_DEFAULT_MODELS[result.selectedAIProvider]
  }
  return result
}
