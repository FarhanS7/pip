import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PipAPI } from '../shared/types/pip-api'
import type { OverlayEventSink } from '../renderer/overlay/events'

const bridge = vi.hoisted(() => {
  const listeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>()
  return {
    exposed: new Map<string, unknown>(),
    listeners,
    emit(channel: string, payload: unknown) {
      listeners.get(channel)?.forEach((listener) => listener({ sender: 'fixture' }, payload))
    }
  }
})

// Mock Electron BrowserWindow
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, value: unknown) => bridge.exposed.set(name, value)
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: (channel: string, listener: (event: unknown, payload: unknown) => void) => {
      const listeners = bridge.listeners.get(channel) ?? new Set()
      listeners.add(listener)
      bridge.listeners.set(channel, listeners)
    },
    removeListener: (channel: string, listener: (event: unknown, payload: unknown) => void) => {
      bridge.listeners.get(channel)?.delete(listener)
    }
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock Screen Capture
vi.mock('./screen/screen-capture', () => ({
  displaySnapshotMatches: () => true,
  captureAllScreens: vi.fn(async () => [
    {
      displayId: 100,
      screenIndex: 0,
      imageSize: { width: 1920, height: 1080 }, isPrimary: true,
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
import '../preload/index'
import { BrowserWindow } from 'electron'
import { IpcChannel } from '../shared/channels'
import { subscribeOverlayEvents } from '../renderer/overlay/events'

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
    initOrchestrator().finishBrowserRecognition('Where is the submit button?', voiceStateMachine.getTurnId())

    // Wait for async processing pipeline to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    // State machine automatically transitions through responding to idle
    expect(voiceStateMachine.getState()).toBe('idle')
  })

  it('exposes named speech methods without a raw invoke/on bridge', () => {
    expect(bridge.exposed.has('pip')).toBe(false)
    const api = bridge.exposed.get('pipAPI') as PipAPI
    expect(api).not.toHaveProperty('invoke')
    const callback = vi.fn()
    const stop = api.onSpeak(callback)
    bridge.emit(IpcChannel.TTS_SPEAK, { text: 'fixture speech' })
    expect(callback).toHaveBeenCalledExactlyOnceWith({ text: 'fixture speech' })
    stop()
    bridge.emit(IpcChannel.TTS_SPEAK, { text: 'after unmount' })
    expect(callback).toHaveBeenCalledOnce()
  })

  it('delivers streamed text and a parsed point through preload into overlay handlers', async () => {
    const api = bridge.exposed.get('pipAPI') as PipAPI
    const sink: OverlayEventSink = {
      setVoiceState: vi.fn(), resetResponse: vi.fn(), setPowerLevel: vi.fn(),
      setPoint: vi.fn(), appendText: vi.fn()
    }
    const stop = subscribeOverlayEvents(api, sink)
    const send = vi.fn(bridge.emit)
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
      { isDestroyed: () => false, webContents: { send } } as unknown as BrowserWindow
    ])
    try {
      initOrchestrator()
      voiceStateMachine.transitionTo('listening', 'bridge-test')
      voiceStateMachine.transitionTo('processing', 'bridge-test')
      initOrchestrator().finishBrowserRecognition('Where is the submit button?', voiceStateMachine.getTurnId())
      await vi.waitFor(() => expect(sink.setPoint).toHaveBeenCalledWith({
        x: 100, y: 200, label: 'submit button', screenIndex: 0
      }))
      expect(sink.appendText).toHaveBeenNthCalledWith(1, 'Click the submit button. ')
      expect(sink.appendText).toHaveBeenNthCalledWith(2, '[POINT:100,200:submit button]')
      expect(sink.resetResponse).toHaveBeenCalledTimes(2)
      expect(sink.setVoiceState).toHaveBeenCalledWith('responding')
      bridge.emit(IpcChannel.AUDIO_POWER_LEVEL, { level: 0.5 })
      expect(sink.setPowerLevel).toHaveBeenCalledWith(0.5)
    } finally {
      stop()
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([])
    }
  })

  it('removes exact preload listeners on overlay unmount without affecting another subscriber', () => {
    const api = bridge.exposed.get('pipAPI') as PipAPI
    const makeSink = (): OverlayEventSink => ({
      setVoiceState: vi.fn(), resetResponse: vi.fn(), setPowerLevel: vi.fn(),
      setPoint: vi.fn(), appendText: vi.fn()
    })
    const first = makeSink()
    const second = makeSink()
    const stopFirst = subscribeOverlayEvents(api, first)
    const stopSecond = subscribeOverlayEvents(api, second)
    stopFirst()
    stopFirst()
    bridge.emit(IpcChannel.AI_RESPONSE_CHUNK, { text: 'only second' })
    bridge.emit(IpcChannel.CURSOR_POSITION, { x: 0, y: -100, label: null, screenIndex: 1 })
    expect(first.appendText).not.toHaveBeenCalled()
    expect(first.setPoint).not.toHaveBeenCalled()
    expect(second.appendText).toHaveBeenCalledExactlyOnceWith('only second')
    expect(second.setPoint).toHaveBeenCalledExactlyOnceWith({ x: 0, y: -100, label: null, screenIndex: 1 })
    stopSecond()
    expect([...bridge.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true)
  })
})
