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
import { SettingsPayload, VoiceStateChangedPayload } from '../../shared/types/ipc'

const DEFAULT_SETTINGS: SettingsPayload = {
  selectedAIProvider: 'claude',
  selectedAIModel: 'claude-sonnet-5',
  selectedSTTProvider: 'assemblyai',
  selectedTTSProvider: 'elevenlabs',
  pushToTalkHotkey: 'CommandOrControl+Alt+Space',
  cursorEnabled: true
}

declare global {
  interface Window {
    pipAPI?: {
      getSettings: () => Promise<SettingsPayload>
      setSetting: (key: keyof SettingsPayload, value: unknown) => Promise<void>
      onVoiceStateChanged: (callback: (payload: VoiceStateChangedPayload) => void) => () => void
      onSettingsChanged: (callback: (payload: SettingsPayload) => void) => () => void
      triggerPushToTalkPress: () => void
      triggerPushToTalkRelease: () => void
    }
  }
}

function App(): React.JSX.Element {
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle')
  const [settings, setSettings] = useState<SettingsPayload>(DEFAULT_SETTINGS)

  useEffect(() => {
    if (!window.pipAPI) return

    // Load initial persisted settings
    window.pipAPI.getSettings().then((loadedSettings) => {
      if (loadedSettings) {
        setSettings(loadedSettings)
      }
    }).catch(() => {
      // Fall back to defaults if uninitialized
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

  const handleUpdateSetting = (key: keyof SettingsPayload, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    if (window.pipAPI) {
      window.pipAPI.setSetting(key, value)
    }
  }

  const handleToggleVoice = () => {
    if (!window.pipAPI) return
    if (voiceState === 'idle') {
      window.pipAPI.triggerPushToTalkPress()
    } else {
      window.pipAPI.triggerPushToTalkRelease()
    }
  }

  return (
    <div className="panel-container">
      {/* Real-Time Status Header */}
      <StatusHeader voiceState={voiceState} />

      {/* Manual Voice Trigger Button */}
      <VoiceToggleButton voiceState={voiceState} onToggle={handleToggleVoice} />

      {/* Model Provider Selectors */}
      <ProviderSelectors settings={settings} onUpdateSetting={handleUpdateSetting} />

      {/* Shortcut & Overlay Configuration */}
      <HotkeyConfigurator settings={settings} onUpdateSetting={handleUpdateSetting} />
    </div>
  )
}

export default App
