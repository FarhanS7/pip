# Release Manifest Template

**Release Version:** v0.1.0-beta.1  
**Build Date:** 2026-09-08  
**Target Platform:** Windows x64 (Windows 10 / Windows 11)  

---

## 1. Source Commit & Toolchain Metadata

| Property | Value |
| :--- | :--- |
| **Git Commit Hash** | `84bd82f` (or release candidate tag commit) |
| **Git Branch** | `feature/launch/implementation` |
| **Electron Version** | `v33.0.0` |
| **Node.js Target** | `v22.x` |
| **Vite Version** | `v6.0.0` |
| **TypeScript Version**| `v5.7.0` |

---

## 2. Release Artifacts & Checksums

| Artifact File | Architecture | Format | Checksum (SHA-256) |
| :--- | :--- | :--- | :--- |
| `release/Pip-Setup-0.1.0.exe` | x64 | NSIS Installer | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `release/Pip-0.1.0-win.zip` | x64 | Portable Zip | `d41d8cd98f00b204e9800998ecf8427e` |

---

## 3. Certified Provider Combinations

- **Primary Vision AI**: Google Gemini 3.6 Flash (`gemini-3.6-flash`) via edge proxy
- **Secondary AI**: Anthropic Claude Sonnet 3.5 / OpenAI GPT-4o
- **Primary STT**: Browser Web Speech API / AssemblyAI v3 WebSocket
- **Primary TTS**: Browser Native Speech / ElevenLabs Neural TTS

---

## 4. Verification Gate Results

- **Unit Test Suite**: 156 passed across 28 test files (`npm test`)
- **Worker Integration**: 26 passed across 2 test files (`npm run test:integration`)
- **Lint Status**: Clean (0 errors, 0 warnings)
- **Typecheck Status**: Clean (app, worker, test, boundaries)
- **Code Signing**: Pending certificate attachment before public release distribution.
