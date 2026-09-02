import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron BrowserWindow
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock Screen Capture
vi.mock('./screen/screen-capture', () => ({
  captureAllScreens: vi.fn(async () => [
    {
      displayId: 100,
      screenIndex: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      jpegBase64: 'mock-jpeg-base64-data'
    }
  ])
}))

// Mock AI Provider Factory
vi.mock('./ai/ai-provider', () => ({
  createAIProvider: vi.fn(() => ({
    name: 'mock-ai',
    displayName: 'Mock AI Provider',
    defaultModel: 'mock-model',
    async *streamChat() {
      yield 'Click the submit button. '
      yield '[POINT:100,200:submit button]'
    }
  }))
}))

// Mock STT Provider Factory
vi.mock('./audio/stt-provider', () => ({
  createSTTProvider: vi.fn(() => ({
    name: 'mock-stt',
    displayName: 'Mock STT Provider',
    requiresApiKey: false,
    async createSession() {
      return {
        id: 'mock-session-1',
        sendAudio: vi.fn(),
        onTranscript: vi.fn((cb) => cb({ text: 'Where is the submit button?', isFinal: true })),
        onError: vi.fn(),
        close: vi.fn(async () => {})
      }
    }
  }))
}))

// Mock TTS Provider Factory
vi.mock('./tts/tts-provider', () => ({
  createTTSProvider: vi.fn(() => ({
    name: 'mock-tts',
    displayName: 'Mock TTS Provider',
    requiresApiKey: false,
    speak: vi.fn(async () => {}),
    stop: vi.fn()
  }))
}))

import { initOrchestrator, Orchestrator } from './orchestrator'
import { voiceStateMachine } from './state/voice-state-machine'

describe('Central Orchestrator Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    voiceStateMachine.reset('test-reset')
  })

  it('initializes Orchestrator singleton', () => {
    const instance = initOrchestrator()
    expect(instance).toBeInstanceOf(Orchestrator)
  })

  it('executes full pipeline flow idle -> listening -> processing -> responding -> idle', async () => {
    initOrchestrator()

    // 1. Transition to listening
    voiceStateMachine.transitionTo('listening', 'hotkey-press')
    expect(voiceStateMachine.getState()).toBe('listening')

    // 2. Transition to processing
    voiceStateMachine.transitionTo('processing', 'hotkey-release')

    // Wait for async processing pipeline to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    // State machine automatically transitions through responding to idle
    expect(voiceStateMachine.getState()).toBe('idle')
  })
})
