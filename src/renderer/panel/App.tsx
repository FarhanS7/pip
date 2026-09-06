/**
 * Panel App — Control Panel Root Component
 *
 * Mounts StatusHeader, VoiceToggleButton, ProviderSelectors, and HotkeyConfigurator.
 * Wires configuration state persistence and IPC events.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/panel module)
 *   PHASE_1_MODULES_AND_TASKS.md Task H.1-H.6 scoped checklist
 */

import React, { useEffect, useState } from 'react'
import './index.css'
import { StatusHeader } from './components/StatusHeader'
import { VoiceToggleButton } from './components/VoiceToggleButton'
import { ProviderSelectors } from './components/ProviderSelectors'
import { HotkeyConfigurator } from './components/HotkeyConfigurator'
import { SettingsPayload } from '../../shared/types/ipc'

import { DEFAULT_SETTINGS } from '../../shared/settings'

function App(): React.JSX.Element {
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle')
  const [settings, setSettings] = useState<SettingsPayload>(DEFAULT_SETTINGS)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.pipAPI) return

    // Load initial persisted settings
    window.pipAPI.getSettings().then((loadedSettings) => {
      if (loadedSettings) {
        setSettings(loadedSettings)
      }
    }).catch(() => {
      setSettingsError('Could not load settings. Please restart Pip.')
    })
    window.pipAPI.getSettingsNotice().then(setSettingsError).catch(() => {
      setSettingsError('Could not check settings storage. Please restart Pip.')
    })

    const unsubVoice = window.pipAPI.onVoiceStateChanged((payload) => {
      setVoiceState(payload.state)
    })

    const unsubSettings = window.pipAPI.onSettingsChanged((newSettings) => {
      setSettings(newSettings)
    })

    return () => {
      unsubVoice()
      unsubSettings()
    }
  }, [])

  const handleUpdateSetting = async (key: keyof SettingsPayload, value: unknown) => {
    if (!window.pipAPI) return
    try {
      await window.pipAPI.setSetting(key, value)
      setSettingsError(null)
    } catch {
      setSettingsError('Setting was not saved. Check the value, storage access, and shortcut availability. Finish any voice turn before changing the shortcut.')
    }
  }

  const handleResetSettings = async () => {
    if (!window.pipAPI) return
    try {
      await window.pipAPI.resetSettings()
      setSettingsError(null)
    } catch {
      setSettingsError('Settings could not be reset. Existing preferences were kept.')
    }
  }

  const handleToggleVoice = () => {
    if (!window.pipAPI) return
    if (voiceState === 'idle') {
      window.pipAPI.triggerPushToTalkPress()
    } else if (voiceState === 'listening') {
      window.pipAPI.triggerPushToTalkRelease()
    } else {
      void window.pipAPI.cancelTurn().catch(() => setSettingsError('Could not stop the voice turn. Please try again.'))
    }
  }

  return (
    <div className="panel-container">
      {settingsError && <p role="alert">{settingsError}</p>}
      {/* Real-Time Status Header */}
      <StatusHeader voiceState={voiceState} />

      {/* Manual Voice Trigger Button */}
      <VoiceToggleButton voiceState={voiceState} onToggle={handleToggleVoice} />

      {/* Model Provider Selectors */}
      <ProviderSelectors settings={settings} onUpdateSetting={handleUpdateSetting} />

      {/* Shortcut & Overlay Configuration */}
      <HotkeyConfigurator settings={settings} onUpdateSetting={handleUpdateSetting} />
      <button type="button" onClick={handleResetSettings}>Reset settings to defaults</button>
    </div>
  )
}

export default App
