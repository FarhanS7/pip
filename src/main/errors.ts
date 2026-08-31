/**
 * Typed Error Classes
 *
 * All errors use typed error classes with a code field.
 * Domain-specific subclasses provide clear categorization.
 *
 * Convention (from PHASE_0_ARCHITECTURE.md §0.4):
 *   Never: throw new Error("something broke")
 *   Always: throw new AudioError("MIC_PERMISSION_DENIED", "Microphone access denied by OS")
 */

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low'

/**
 * Base error class for all Pip errors.
 * Every error has a machine-readable code and a human-readable message.
 */
export class PipError extends Error {
  public readonly name = 'PipError'

  constructor(
    public readonly code: string,
    message: string,
    public readonly severity: ErrorSeverity = 'medium',
    public readonly cause?: Error
  ) {
    super(message)
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Errors from audio capture, microphone access, or audio processing. */
export class AudioError extends PipError {
  public override readonly name = 'AudioError'
}

/** Errors from AI provider communication (Claude, GPT-4o, Gemini). */
export class AIProviderError extends PipError {
  public override readonly name = 'AIProviderError'
}

/** Errors from OS accessibility tree reading (UIAutomation, AXUIElement). */
export class AccessibilityError extends PipError {
  public override readonly name = 'AccessibilityError'
}

/** Errors from text-to-speech providers (ElevenLabs, OpenAI TTS, browser). */
export class TTSError extends PipError {
  public override readonly name = 'TTSError'
}

/** Errors from speech-to-text providers (AssemblyAI, Web Speech API). */
export class STTError extends PipError {
  public override readonly name = 'STTError'
}

/** Errors from screen capture (desktopCapturer, ScreenCaptureKit). */
export class ScreenCaptureError extends PipError {
  public override readonly name = 'ScreenCaptureError'
}

/** Errors from app configuration or missing environment variables. */
export class ConfigError extends PipError {
  public override readonly name = 'ConfigError'
}
