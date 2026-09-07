import { ProxyTTSProvider } from './proxy-tts'
export class OpenAITTSProvider extends ProxyTTSProvider {
  readonly name = 'openai-tts'
  readonly displayName = 'OpenAI TTS'
  constructor(workerUrl?: string, sharedSecret?: string) { super('openai', workerUrl, sharedSecret) }
}
