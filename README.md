# Pip

An AI that watches your screen, walks you through any task by voice, can act on it for you with permission — and leaves behind a shareable tutorial every time.

## Tech Stack

- **Desktop:** Electron 33+ (TypeScript, React 19, Vite)
- **Backend:** Cloudflare Workers
- **AI:** Claude, GPT-4o, Gemini (multi-provider)
- **STT:** AssemblyAI, Web Speech API
- **TTS:** ElevenLabs, OpenAI TTS, Browser SpeechSynthesis

## Development

```bash
# Install dependencies
npm install

# Start dev mode (hot-reload)
npm run dev

# Start Worker locally (separate terminal)
cd worker && npx wrangler dev
```

## License

Private — all rights reserved.
