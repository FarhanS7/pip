/**
 * IPC Payload Types
 *
 * TypeScript interfaces for all IPC message payloads.
 * Ensures type safety between main and renderer processes.
 *
 * Every IPC channel from channels.ts has a corresponding payload type here.
 */

// ── Voice State ────────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding'

export interface VoiceStateChangedPayload {
  state: VoiceState
  /** Optional message describing why the state changed */
  reason?: string
}

// ── Audio ──────────────────────────────────────────────────────────────

export interface AudioPowerLevelPayload {
  /** Normalized audio power level from 0.0 (silence) to 1.0 (max) */
  level: number
}

export interface TranscriptUpdatePayload {
  /** The transcript text (partial or final) */
  text: string
  /** Whether this is the final transcript for this utterance */
  isFinal: boolean
}

// ── AI Response ────────────────────────────────────────────────────────

export interface AIResponseChunkPayload {
  /** The text chunk from the streaming AI response */
  text: string
}

export interface AIResponseCompletePayload {
  /** The full response text after streaming is done */
  fullText: string
  /** Parsed pointing coordinate, if any */
  coordinate: { x: number; y: number } | null
  /** Label of the pointed element, if any */
  elementLabel: string | null
  /** Target screen number (for multi-monitor), if any */
  screenNumber: number | null
}

// ── Overlay / Cursor ───────────────────────────────────────────────────

export interface CursorPositionPayload {
  /** Target X coordinate in global screen space */
  x: number
  /** Target Y coordinate in global screen space */
  y: number
  /** Label to display near the cursor */
  label: string | null
  /** Which screen this coordinate is on (0-indexed) */
  screenIndex: number
}

export interface ElementHighlightPayload {
  /** Bounding rectangle of the element to highlight */
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Which screen this element is on (0-indexed) */
  screenIndex: number
}

// ── Settings ───────────────────────────────────────────────────────────

export interface SettingsPayload {
  selectedAIProvider: 'claude' | 'openai' | 'gemini'
  selectedAIModel: string
  selectedSTTProvider: 'assemblyai' | 'web-speech'
  selectedTTSProvider: 'elevenlabs' | 'openai-tts' | 'browser'
  pushToTalkHotkey: string
  cursorEnabled: boolean
}

export interface SettingsSetPayload {
  key: keyof SettingsPayload
  value: SettingsPayload[keyof SettingsPayload]
}

// ── Permissions ────────────────────────────────────────────────────────

export interface PermissionsPayload {
  microphone: 'granted' | 'denied' | 'unknown'
  accessibility: 'granted' | 'denied' | 'unknown'
  screenCapture: 'granted' | 'denied' | 'unknown'
}

export type PermissionType = 'microphone' | 'accessibility' | 'screenCapture'
