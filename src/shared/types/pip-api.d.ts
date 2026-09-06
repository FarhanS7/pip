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

  // Audio / AI Events
  onPowerLevelChanged: (callback: (payload: AudioPowerLevelPayload) => void) => () => void
  onPointDetected: (callback: (payload: PointDetectedPayload) => void) => () => void
  onTextChunk: (callback: (payload: TextChunkPayload) => void) => () => void
}

declare global {
  interface Window {
    pipAPI?: PipAPI
    pip?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
    }
  }
}

