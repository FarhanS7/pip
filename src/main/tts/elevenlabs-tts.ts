import { ProxyTTSProvider } from './proxy-tts'
export class ElevenLabsTTSProvider extends ProxyTTSProvider {
  readonly name = 'elevenlabs'
  readonly displayName = 'ElevenLabs TTS'
  constructor(workerUrl?: string, sharedSecret?: string) { super('elevenlabs', workerUrl, sharedSecret) }
}
