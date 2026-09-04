import {
  VoiceStateChangedPayload,
  AudioPowerLevelPayload,
  SettingsPayload
} from './ipc'

export interface PointDetectedPayload {
  globalX?: number
  globalY?: number
  label?: string
}

export interface TextChunkPayload {
  chunk: string
}

export interface PipAPI {
  // Settings
  getSettings: () => Promise<SettingsPayload>
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

