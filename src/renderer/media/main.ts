import { bindSpeechPlayback } from './speech-playback'
import { bindBrowserRecognition } from './browser-recognition'

const api = window.pipAPI
if (api) {
  const stopSpeech = bindSpeechPlayback(api, window.speechSynthesis, text => new SpeechSynthesisUtterance(text))
  const stopRecognition = bindBrowserRecognition(api)
  window.addEventListener('beforeunload', () => { stopSpeech(); stopRecognition() }, { once: true })
  void api.mediaReady().catch(() => { stopSpeech(); stopRecognition() })
}
