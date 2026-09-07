import { bindSpeechPlayback } from './speech-playback'
import { bindBrowserRecognition } from './browser-recognition'
import { bindPcmMicrophone } from './pcm-microphone'

const api = window.pipAPI
if (api) {
  const stopSpeech = bindSpeechPlayback(api, window.speechSynthesis, text => new SpeechSynthesisUtterance(text))
  const stopRecognition = bindBrowserRecognition(api)
  const stopPcm = bindPcmMicrophone(api)
  window.addEventListener('beforeunload', () => { stopSpeech(); stopRecognition(); stopPcm() }, { once: true })
  void api.mediaReady().catch(() => { stopSpeech(); stopRecognition(); stopPcm() })
}
