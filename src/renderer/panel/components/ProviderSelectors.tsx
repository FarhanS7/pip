/**
 * Active Provider Selector Dropdowns Component (Task H.4)
 *
 * Renders select controls for AI, STT, and TTS model providers in Control Panel.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/panel module)
 *   PHASE_1_MODULES_AND_TASKS.md Task H.4 scoped checklist
 */

import React from 'react'
import { SettingsPayload } from '../../../shared/types/ipc'

export interface ProviderSelectorsProps {
  settings: SettingsPayload
  onUpdateSetting: (key: keyof SettingsPayload, value: unknown) => void
}

export const ProviderSelectors: React.FC<ProviderSelectorsProps> = ({
  settings,
  onUpdateSetting
}) => {
  return (
    <div className="panel-card">
      <div className="panel-card-title">Model Providers</div>

      {/* AI Vision Provider */}
      <div>
        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
          AI Vision Provider
        </label>
        <select
          className="panel-select"
          value={settings.selectedAIProvider}
          onChange={(e) => onUpdateSetting('selectedAIProvider', e.target.value)}
        >
          <option value="claude">Anthropic Claude (Sonnet 5)</option>
          <option value="openai">OpenAI (GPT-4o)</option>
          <option value="gemini">Google Gemini (2.5 Flash)</option>
        </select>
      </div>

      {/* Speech-to-Text Provider */}
      <div>
        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
          Speech-to-Text (STT)
        </label>
        <select
          className="panel-select"
          value={settings.selectedSTTProvider}
          onChange={(e) => onUpdateSetting('selectedSTTProvider', e.target.value)}
        >
          <option value="assemblyai">AssemblyAI Real-Time STT</option>
          <option value="web-speech">Web Speech API (Offline)</option>
        </select>
      </div>

      {/* Text-to-Speech Provider */}
      <div>
        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
          Text-to-Speech (TTS)
        </label>
        <select
          className="panel-select"
          value={settings.selectedTTSProvider}
          onChange={(e) => onUpdateSetting('selectedTTSProvider', e.target.value)}
        >
          <option value="elevenlabs">ElevenLabs Streaming TTS</option>
          <option value="openai-tts">OpenAI TTS (tts-1)</option>
          <option value="browser">Browser SpeechSynthesis (Offline)</option>
        </select>
      </div>
    </div>
  )
}
