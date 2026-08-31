/**
 * IPC Channel Definitions
 *
 * Single source of truth for all IPC channel names.
 * Namespaced with colons: "domain:action"
 *
 * References: PHASE_0_ARCHITECTURE.md §0.4 (IPC Communication Pattern)
 *
 * Convention:
 *   Main → Renderer: webContents.send(channel, data)
 *   Renderer → Main: ipcRenderer.invoke(channel, data) — async, returns Promise
 */

/**
 * All IPC channels used across the application.
 * Adding a new channel requires adding it here first.
 */
export enum IpcChannel {
  // ── Voice State ──────────────────────────────────────────────────────
  /** Main → Renderer: Voice state changed (idle/listening/processing/responding) */
  VOICE_STATE_CHANGED = 'state:voice-changed',

  // ── Audio ────────────────────────────────────────────────────────────
  /** Renderer → Main: Start recording microphone */
  START_RECORDING = 'audio:start-recording',
  /** Renderer → Main: Stop recording microphone */
  STOP_RECORDING = 'audio:stop-recording',
  /** Main → Renderer: Audio power level update (for waveform visualizer) */
  AUDIO_POWER_LEVEL = 'audio:power-level',
  /** Main → Renderer: Transcript text update (partial or final) */
  TRANSCRIPT_UPDATE = 'state:transcript-update',

  // ── AI Response ──────────────────────────────────────────────────────
  /** Main → Renderer: AI response text chunk (streamed) */
  AI_RESPONSE_CHUNK = 'ai:response-chunk',
  /** Main → Renderer: AI response complete */
  AI_RESPONSE_COMPLETE = 'ai:response-complete',

  // ── Overlay / Cursor ─────────────────────────────────────────────────
  /** Main → Renderer: Cursor should fly to this position */
  CURSOR_POSITION = 'overlay:cursor-position',
  /** Main → Renderer: Highlight this element bounding rect */
  ELEMENT_HIGHLIGHT = 'overlay:element-highlight',
  /** Main → Renderer: Clear all overlay visuals */
  OVERLAY_CLEAR = 'overlay:clear',

  // ── Settings ─────────────────────────────────────────────────────────
  /** Renderer → Main: Get all settings */
  SETTINGS_GET = 'settings:get',
  /** Renderer → Main: Update a setting */
  SETTINGS_SET = 'settings:set',
  /** Main → Renderer: Settings changed (broadcast) */
  SETTINGS_CHANGED = 'settings:changed',

  // ── App Control ──────────────────────────────────────────────────────
  /** Renderer → Main: Quit the application */
  APP_QUIT = 'app:quit',
  /** Renderer → Main: Toggle cursor visibility */
  CURSOR_TOGGLE = 'app:cursor-toggle',
  /** Renderer → Main: Get current cursor visibility */
  CURSOR_VISIBILITY_GET = 'app:cursor-visibility-get',

  // ── Permissions ──────────────────────────────────────────────────────
  /** Renderer → Main: Get permission statuses */
  PERMISSIONS_GET = 'permissions:get',
  /** Renderer → Main: Request a specific permission */
  PERMISSIONS_REQUEST = 'permissions:request',
}
