# CLICKIFY workspace analysis

Reviewed: 6 September 2026.

## Assessment

Pip is an early Electron prototype with useful module boundaries, a tray/panel/overlay shell, provider adapters, and unit tests. The core voice → screen → AI → speech/pointing loop is not reliably connected. It is not ready for public deployment: the Worker authentication bypass is the first issue to fix, followed by audio ownership, IPC contracts, and cancellation.

This review inventories the whole workspace and examines Pip's core implementation in detail. Clicky and Reticle received structural and selected-source review, not exhaustive line-by-line audits. Dependencies, generated output, Git internals, and credential files were excluded. No application source was changed, no services were deployed, and no paid API requests were made.

## Folder map

Inventory before this report: 2,385 files, excluding dependency/build directories, Git internals, and `.dev.vars`.

| Location | Files | Role |
| --- | ---: | --- |
| `pip/` | 79 | Active product: Electron, TypeScript, React, Vite, Cloudflare Worker; its own Git repository |
| `INSPIRED/` | 85 | Clicky reference application: SwiftUI/AppKit macOS companion and Worker proxy |
| `reticle-main/` | 2,206 | Separate pnpm/Turborepo testing and instrumentation toolkit |
| `plans/` | 10 | Scope, architecture, task breakdown, review, integration, release, and post-launch plans |
| `product-spec.md` | 1 | Broader product vision, including actions, tutorials, privacy, and enterprise/learning tracks |
| `PRD_TO_TASKS_FRAMEWORK.md` | 1 | Reusable development process instructions |
| `.codex/`, `.cursor/`, `.vscode/` | 3 | Cloudflare MCP endpoint configurations for development tools |

Pip's Git working tree was clean at review time. The latest inspected commit was `24dce42`, “feat(stt): add live Web Speech API mic recognition and target pointing.” The two reference/toolkit directories did not contain top-level `.git` or `node_modules` directories in this snapshot.

## Pip architecture

The main process owns windows, tray, global shortcuts, IPC handlers, settings, conversation history, and the orchestrator. Two React entry points provide the control panel and a transparent overlay instantiated once per display. Preload bridges connect them to the main process. A separate Worker forwards chat, speech synthesis, and transcription-token requests to providers.

The intended flow is:

`hotkey/panel → voice state → transcription → screenshot → provider stream → text + point → speech → idle`

The modules are sensibly separated, but several boundaries only agree in comments rather than actual contracts. Broad `any` types and an untyped broadcast helper allow incompatible payloads to pass TypeScript checking. The architecture plan also assigns browser APIs such as AudioContext and HTMLAudioElement to main-process modules; that process boundary needs correction in the plan as well as the implementation.

## Priority findings

### 1. Critical: Worker authentication is bypassable

Evidence: [Worker authentication](../../worker/src/index.ts).

The rejection condition explicitly exempts the literal `your-shared-secret-placeholder`. A request carrying this public value is accepted even when `env.PIP_SHARED_SECRET` contains a real secret. When the variable is absent, the entire check is skipped. The committed Wrangler configuration also uses the placeholder.

If deployed with upstream credentials, this exposes paid API access to callers who know the endpoint. No metering, rate limiter, or enforced model/token policy is implemented in this handler. Remove the placeholder exception, fail closed when configuration is missing, and enforce request validation and usage controls before public availability. Deployment status was not checked.

### 2. High: overlay IPC payloads disagree

Evidence: [producer](../../src/main/orchestrator.ts), [point producer](../../src/main/orchestrator.ts), [consumers](../../src/renderer/overlay/App.tsx).

The orchestrator emits `{ text: chunk }`, but the overlay appends `payload.chunk`. It emits cursor `{ x, y }`, but the overlay requires `globalX` and `globalY`. Consequently text can accumulate literal `undefined` and pointing updates are ignored. Define a single typed channel/payload map shared by senders, preload, and renderers, then test the actual producer-to-consumer boundary.

### 3. High: paid speech synthesis never plays in its actual process

Evidence: [ElevenLabs playback guard](../../src/main/tts/elevenlabs-tts.ts), [OpenAI playback guard](../../src/main/tts/openai-tts.ts).

Both providers are instantiated by the main-process orchestrator. They fetch audio, then resolve without playing whenever `window` or `Audio` is unavailable. That is the normal main-process context. This can spend on synthesis while producing no sound. Blob URLs also escape cleanup on this path.

Move playback to one dedicated renderer and acknowledge completion/error/cancellation over IPC. Browser fallback speech currently broadcasts to every window and resolves immediately, so multi-monitor overlays can speak simultaneously and the UI returns to idle before speech finishes.

### 4. High: AssemblyAI is missing its audio input pipeline

Evidence: [session creation](../../src/main/orchestrator.ts), [sendAudio implementation](../../src/main/audio/assemblyai-stt.ts), [overlay recognition](../../src/renderer/overlay/App.tsx).

There are no calls to `sendAudio` in Pip's application source, and no getUserMedia/AudioContext capture pipeline feeding it. Selecting AssemblyAI opens a session but supplies no PCM audio. Separately, every overlay starts Web Speech recognition whenever state becomes listening, regardless of the selected STT provider.

Give microphone capture one owner, honor provider selection, transport the required audio format, and wait for transcription finalization before processing. The overlay currently stops recognition as processing starts, allowing late final transcripts to miss the query snapshot. Browser-recognition availability and offline behavior were not runtime verified.

### 5. High: cancel/stop controls do not cancel

Evidence: [panel action](../../src/renderer/panel/App.tsx), [stop handler](../../src/main/ipc/handlers.ts), [orchestrator](../../src/main/orchestrator.ts).

“Cancel Processing” and “Stop Speaking” both invoke the same stop-recording handler, which transitions to processing. During processing this is a no-op; during responding the transition is invalid. There is no abort controller or turn identifier preventing old work from emitting text, speaking, modifying history, or resetting a newer interaction to idle.

Asynchronous STT initialization can also finish after release, leaving a session assigned after processing has already started. Add explicit cancel semantics and scope asynchronous work/resources to a turn. `VoiceStateMachine.reset()` broadcasts to windows but does not notify its JS listeners, so orchestrator cleanup is skipped on reset.

### 6. High: screen coordinates lack scaling and display routing

Evidence: [capture](../../src/main/screen/screen-capture.ts), [mapper](../../src/main/state/coordinate-mapper.ts), [first-image selection](../../src/main/orchestrator.ts).

Screenshots are downscaled to a maximum edge of 1280. The prompt asks for coordinates relative to those images, while the mapper simply adds desktop offsets. It never converts image pixels to display coordinates. For a 1920-wide display represented by a 1280-wide image, an image x-coordinate of 640 should map to display x=960 before adding the origin; the current mapper produces 640.

Only the first captured screenshot is sent to AI despite metadata describing every display. Cursor updates are broadcast to all overlays, which use desktop-global coordinates directly inside window-local CSS. Preserve image dimensions, associate images with display IDs, scale explicitly, and send local coordinates only to the target overlay. The fixed 80×40 highlight is illustrative, not an actual detected element rectangle.

### 7. Medium: settings are not persisted or applied consistently

Evidence: [store initializer](../../src/main/state/settings.ts), [startup](../../src/main/index.ts), [preload reset](../../src/preload/index.ts).

`initSettingsStore()` is defined but never called, so settings remain in memory. Hotkey changes update settings without re-registering the shortcut, and startup always registers the hardcoded default. Cursor visibility has placeholder handlers and no consumer applying `cursorEnabled`. `resetSettings()` sets an unrelated `reset` key instead of calling the reset function. `selectedAIModel` is stored but requests use provider constants.

Initialize and await storage before UI/hotkey setup; validate incoming settings; apply changes to their owning modules; wire a real reset operation.

### 8. Medium: Electron permission and bridge boundaries are too broad

Evidence: [permission handler](../../src/main/index.ts), [generic preload bridge](../../src/preload/index.ts), [IPC handlers](../../src/main/ipc/handlers.ts).

The permission callback approves every permission type for the default session. The generic `window.pip.invoke` surface accepts arbitrary channel names, and handlers do not validate the sending frame. Settings accept arbitrary keys/values through casts. Window context isolation and sandbox settings are positive, but these broad bridges weaken their intended boundary.

Allow only intended permissions for trusted windows, use a fixed API surface, and validate sender and payload. The generic `off()` also cannot remove the wrapper registered by `on()`; overlay TTS listeners have no cleanup, which can duplicate subscriptions on remount.

### 9. Medium: AI context and operational behavior need tightening

Every AI adapter attaches the current screenshot to every historical user message. As history grows, this repeats the image and misrepresents what the user saw during earlier exchanges. Attach the current image only to the current turn, or persist correctly associated historical images intentionally.

Provider adapters have no request deadline or cancellation, and their streaming loops largely ignore non-text error events. The Gemini Worker tries several alternate models after every unsuccessful response, rather than restricting fallback to relevant model errors. Model availability was not verified against provider accounts, so this review does not certify any configured identifier.

Transcripts and prompts are logged in plaintext by the orchestrator. There is no local redaction step before screenshot upload. This conflicts with the broader privacy promise, although redaction was explicitly deferred in the narrower v1 planning document.

## Product scope versus implementation

| Capability | Observed status |
| --- | --- |
| Tray, panel, overlay windows | Implemented structure; desktop behavior not exercised |
| Hotkey and voice state machine | Implemented, with settings/cancellation gaps; any key release currently ends push-to-talk |
| Screen capture | Implemented; scaling and downstream multi-monitor handling incomplete |
| AI provider adapters and Worker streaming | Implemented; live provider behavior unverified |
| Speech input/output | Partial; critical wiring/process defects described above |
| Conversation memory | In-memory rolling history |
| Settings persistence | Store code exists but initialization is unwired |
| Accessibility grounding | Optional prompt field only; no native reader or integration found |
| Permission onboarding | Placeholder IPC responses |
| Permissioned clicks/typing | Not implemented; deferred in v1 plan |
| Tutorial export/sharing | Not implemented; deferred in v1 plan |
| Sensitive-data redaction | Not implemented; deferred in v1 plan |
| Auth and metering | Shared-secret check is bypassable; user auth/metering deferred |
| Persistent session memory, proactive help, enterprise/learning features | Not implemented in Pip; mostly future scope |

The product spec describes a substantially larger product than the v1 scope in `plans/PHASE_-1_PRD_SANITY_CHECK.md`. Keep this distinction explicit in the README and progress tracker. Planning phrases such as “Phase 1 complete” describe completion of planning artifacts, not evidence that the listed features work.

## Tests, builds, and delivery

| Check | Result |
| --- | --- |
| `npm run typecheck` in Pip | Passed |
| `npm run lint` | Failed: ESLint 9 cannot find `eslint.config.js/mjs/cjs` |
| `npm test` | Could not start: esbuild subprocess failed with `spawn EPERM`; outside-sandbox retry was declined |
| Integration test script | References missing `vitest.integration.config.ts` |
| Native rebuild script | References missing `native/accessibility-win` directory |
| Installer configuration | References missing `resources/icon.ico` and `resources/icon.icns` |
| Pip CI | No `.github` workflow directory found |
| Desktop/installer/live-provider validation | Not run |
| Reticle and Clicky test suites | Not run |

Pip has 10 test files, primarily for state/helpers and one heavily mocked orchestrator flow. That orchestrator test replaces providers, exposes no renderer windows, and asserts eventual idle state. It therefore cannot catch the real IPC mismatch, absent microphone transport, or silent speech playback. Typecheck also excludes the Worker directory and cannot validate dynamic IPC agreement.

Add boundary tests for real payloads, Worker rejection paths, transcription finalization, playback completion, and cancellation before expanding the feature set. Restore the lint configuration and integration runner, then verify one complete desktop interaction before relying on installer output.

## Reference projects and tooling

**Clicky:** A macOS-native implementation of the intended companion interaction, useful for understanding ScreenCaptureKit, AVAudioEngine, AppKit overlays, and async voice orchestration. Its Swift source is architectural reference for the Electron rebuild. The reference Worker has no caller authentication. The nested `leanring-buddy/AGENTS.md` describes files absent from the snapshot and conflicts with the root app description; treat that nested guide as stale. The root guide's provider-route summary also understates the provider breadth now present in the source.

**Reticle:** A separate toolkit with 11 packages: core, browser, server, react, next, electron, tauri, vite-plugin, babel-plugin, eslint-plugin, and test. It includes framework examples, desktop smoke apps, integration/E2E suites, benchmarks, docs, and release workflows. Its main architecture is a browser SDK connected to a local bridge/server with MCP and CLI interfaces. Selected source confirms this separation.

Pip has a development preload console hook named for Reticle, but no Reticle dependency or SDK initialization was found in its application/build configuration. Having the Reticle source next to Pip does not integrate it. It may help test Pip's own UI, but does not itself fill Pip's missing OS-wide accessibility implementation. The snapshot's large test inventory is not evidence that Pip's tests or runtime pass.

**Development configurations:** The three editor/agent configuration files contain Cloudflare MCP endpoints. These configure development tooling, not the application's runtime Worker URL or authentication. Application provider constructors currently default to localhost unless environment variables are supplied. A packaged-app runtime configuration path is not documented in the short Pip README.

Cloudflare-specific review guidance was checked against the [official Workers best-practices documentation](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), which recommends streamed responses, secrets management, and generated environment types. The proxy preserves upstream streaming bodies, which is a useful foundation. Its explicit authentication bypass remains a direct source finding independent of documentation.

## Recommended sequence

1. Close the Worker authentication bypass and add negative authentication tests.
2. Define one typed IPC contract; fix text/point payloads and dedicate one renderer to audio.
3. Complete microphone transport, provider selection, transcript finalization, and playback acknowledgments.
4. Add cancellation and turn ownership so stale work cannot affect a new interaction.
5. Fix coordinate scaling/display routing and implement or explicitly defer accessibility grounding.
6. Wire settings persistence, live settings application, permission handling, and validated preload APIs.
7. Repair lint/integration/build assets and verify a complete desktop interaction on each target OS.
8. Update product documentation to distinguish implemented, partial, and deferred features before adding tutorials or agentic actions.


