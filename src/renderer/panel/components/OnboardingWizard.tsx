/**
 * Onboarding Wizard Component (Task B26)
 *
 * Multi-step setup flow for new users:
 * 1. Permission checks (Microphone, Screen Capture, Accessibility)
 * 2. Model & Voice provider configuration
 * 3. Audio & speech test
 * 4. Setup complete
 */

import React, { useState, useEffect } from 'react'
import { SettingsPayload } from '../../../shared/types/ipc'

interface OnboardingWizardProps {
  settings: SettingsPayload
  onUpdateSetting: (key: keyof SettingsPayload, value: unknown) => Promise<void>
  onComplete: () => void
}

export function OnboardingWizard({ settings, onUpdateSetting, onComplete }: OnboardingWizardProps): React.JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [permissions, setPermissions] = useState<{ microphone: string; accessibility: string; screenCapture: string }>({
    microphone: 'unknown',
    accessibility: 'unknown',
    screenCapture: 'unknown'
  })
  const [testAudioActive, setTestAudioActive] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!window.pipAPI) return
    window.pipAPI.getPermissions().then(setPermissions).catch(() => {
      // Fallback if permission check fails
    })
  }, [])

  const handleRequestPermission = async (type: string) => {
    if (!window.pipAPI) return
    try {
      await window.pipAPI.requestPermission(type)
      const updated = await window.pipAPI.getPermissions()
      setPermissions(updated)
    } catch {
      // Keep existing state
    }
  }

  const handleAudioTest = () => {
    setTestAudioActive(true)
    setTestStatus('Testing speech playback...')
    try {
      const utterance = new SpeechSynthesisUtterance('Hello! Pip voice synthesis is working.')
      utterance.onend = () => {
        setTestAudioActive(false)
        setTestStatus('Speech test completed successfully!')
      }
      utterance.onerror = () => {
        setTestAudioActive(false)
        setTestStatus('Speech test failed. Please check system audio output.')
      }
      window.speechSynthesis.speak(utterance)
    } catch {
      setTestAudioActive(false)
      setTestStatus('Speech synthesis not available in this browser context.')
    }
  }

  return (
    <div className="onboarding-wizard" style={{ padding: '16px', background: '#1e1e2e', color: '#cdd6f4', borderRadius: '8px', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#89b4fa' }}>Welcome to Pip! First-Time Setup</h2>

      {/* Step Indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
        <span style={{ fontWeight: step === 1 ? 'bold' : 'normal', color: step === 1 ? '#f9e2af' : '#a6adc8' }}>1. Permissions</span>
        <span>&gt;</span>
        <span style={{ fontWeight: step === 2 ? 'bold' : 'normal', color: step === 2 ? '#f9e2af' : '#a6adc8' }}>2. AI & Voice</span>
        <span>&gt;</span>
        <span style={{ fontWeight: step === 3 ? 'bold' : 'normal', color: step === 3 ? '#f9e2af' : '#a6adc8' }}>3. Test Audio</span>
        <span>&gt;</span>
        <span style={{ fontWeight: step === 4 ? 'bold' : 'normal', color: step === 4 ? '#f9e2af' : '#a6adc8' }}>4. Ready</span>
      </div>

      {/* Step 1: Permissions */}
      {step === 1 && (
        <div>
          <h3>Step 1: Check System Permissions</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Pip requires microphone and screen capture permissions to hear your questions and assist with your screen.</p>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.9rem' }}>
            <li style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Microphone Access: <strong>{permissions.microphone}</strong></span>
              <button type="button" onClick={() => handleRequestPermission('microphone')}>Grant Mic</button>
            </li>
            <li style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Screen Recording: <strong>{permissions.screenCapture}</strong></span>
              <button type="button" onClick={() => handleRequestPermission('screenCapture')}>Grant Screen</button>
            </li>
            <li style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Accessibility API: <strong>{permissions.accessibility}</strong></span>
              <button type="button" onClick={() => handleRequestPermission('accessibility')}>Grant Accessibility</button>
            </li>
          </ul>
          <button type="button" style={{ marginTop: '12px' }} onClick={() => setStep(2)}>Next: Configure AI Models &gt;</button>
        </div>
      )}

      {/* Step 2: Model & Voice Setup */}
      {step === 2 && (
        <div>
          <h3>Step 2: Choose AI & Speech Providers</h3>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="onboard-ai-provider" style={{ display: 'block', fontSize: '0.85rem' }}>AI Vision Provider:</label>
            <select
              id="onboard-ai-provider"
              value={settings.selectedAIProvider}
              onChange={e => onUpdateSetting('selectedAIProvider', e.target.value)}
              style={{ width: '100%', padding: '6px', marginTop: '4px' }}
            >
              <option value="gemini">Google Gemini (Gemini 3.6 Flash)</option>
              <option value="claude">Anthropic Claude (Claude Sonnet 3.5)</option>
              <option value="openai">OpenAI GPT-4o</option>
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="onboard-stt-provider" style={{ display: 'block', fontSize: '0.85rem' }}>Speech-to-Text Provider:</label>
            <select
              id="onboard-stt-provider"
              value={settings.selectedSTTProvider}
              onChange={e => onUpdateSetting('selectedSTTProvider', e.target.value)}
              style={{ width: '100%', padding: '6px', marginTop: '4px' }}
            >
              <option value="web-speech">Browser Web Speech API (Free / Zero Setup)</option>
              <option value="assemblyai">AssemblyAI v3 Streaming STT</option>
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="onboard-tts-provider" style={{ display: 'block', fontSize: '0.85rem' }}>Text-to-Speech Provider:</label>
            <select
              id="onboard-tts-provider"
              value={settings.selectedTTSProvider}
              onChange={e => onUpdateSetting('selectedTTSProvider', e.target.value)}
              style={{ width: '100%', padding: '6px', marginTop: '4px' }}
            >
              <option value="browser">Browser Native Speech (Free / Built-in)</option>
              <option value="elevenlabs">ElevenLabs Neural Voice</option>
              <option value="openai-tts">OpenAI TTS</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => setStep(1)}>&lt; Back</button>
            <button type="button" onClick={() => setStep(3)}>Next: Test Audio &gt;</button>
          </div>
        </div>
      )}

      {/* Step 3: Audio Test */}
      {step === 3 && (
        <div>
          <h3>Step 3: Test Audio & Voice Output</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Click below to test speech output before starting.</p>
          <button type="button" disabled={testAudioActive} onClick={handleAudioTest}>
            {testAudioActive ? 'Testing Audio...' : '🔊 Play Test Voice'}
          </button>
          {testStatus && <p style={{ fontSize: '0.85rem', marginTop: '8px', color: '#a6e3a1' }}>{testStatus}</p>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button type="button" onClick={() => setStep(2)}>&lt; Back</button>
            <button type="button" onClick={() => setStep(4)}>Next: Complete Setup &gt;</button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && (
        <div>
          <h3>Step 4: You are Ready!</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
            Press <kbd style={{ background: '#313244', padding: '2px 6px', borderRadius: '4px' }}>{settings.pushToTalkHotkey}</kbd> anytime to talk to Pip.
          </p>
          <p style={{ fontSize: '0.85rem', color: '#a6adc8', marginBottom: '16px' }}>
            Pip sits quietly in your system tray and will point to elements on screen when you ask questions.
          </p>
          <button
            type="button"
            style={{ background: '#a6e3a1', color: '#11111b', fontWeight: 'bold', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
            onClick={onComplete}
          >
            🚀 Start Using Pip
          </button>
        </div>
      )}
    </div>
  )
}
