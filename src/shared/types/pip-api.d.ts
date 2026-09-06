import {
  VoiceStateChangedPayload,
  AudioPowerLevelPayload,
  SettingsPayload,
  CursorPositionPayload,
  AIResponseChunkPayload
} from './ipc'

export type PointDetectedPayload = CursorPositionPayload
export type TextChunkPayload = AIResponseChunkPayload

export interface PipAPI {
  updateTranscript: (text: string, turnId: number) => Promise<void>
  onSpeak: (callback: (payload: { requestId: number; text: string }) => void) => () => void
  onStopSpeaking: (callback: (payload: { requestId: number }) => void) => () => void
  mediaReady: () => Promise<void>
  reportPlayback: (requestId: number, status: 'ended' | 'error') => Promise<void>
  // Settings
  getSettings: () => Promise<SettingsPayload>
  getSettingsNotice: () => Promise<string | null>
  setSetting: (key: keyof SettingsPayload, value: unknown) => Promise<void>
  resetSettings: () => Promise<void>
  onSettingsChanged: (callback: (payload: SettingsPayload) => void) => () => void

  // Voice State & Triggers
  onVoiceStateChanged: (callback: (payload: VoiceStateChangedPayload) => void) => () => void
  triggerPushToTalkPress: () => void
  triggerPushToTalkRelease: () => void
  cancelTurn: () => Promise<void>

  // Audio / AI Events
  onPowerLevelChanged: (callback: (payload: AudioPowerLevelPayload) => void) => () => void
  onPointDetected: (callback: (payload: PointDetectedPayload) => void) => () => void
  onTextChunk: (callback: (payload: TextChunkPayload) => void) => () => void
}

declare global {
  interface Window {
    pipAPI?: PipAPI
  }
}

