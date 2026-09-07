# Review handoff: first launch implementation batch

Branch: `feature/launch/implementation`; baseline `24dce422dce5f720e455d646de6ad049628cda89`.
Independent review status: pending. This is implementation context, not a review report.

## Behavior changed

The Worker previously accepted the public placeholder credential even with a configured real secret, and skipped auth when the server secret was absent. Protected requests now fail with 503 when server auth is absent/empty/placeholder, or 401 when the supplied credential is invalid. Valid credentials use SHA-256 digests and the Workers timing-safe buffer comparison. Public GET health and OPTIONS remain available. No provider route payload or deployed resource was changed.

The default placeholder was removed from public Wrangler vars and the development example now requires a real private credential. Desktop users must supply the matching `PIP_SHARED_SECRET` in their launch environment; relying on the old placeholder deliberately stops working. User/device identity and spend controls remain later tasks.

## Files and verification foundation

- `worker/src/index.ts`, `worker/wrangler.toml`, `worker/.dev.vars.example`: minimal fail-closed authentication fix and configuration guidance.
- `test/worker-auth.integration.test.ts`, `vitest.integration.config.ts`: workerd runtime tests with fixture provider responses; no real API calls or `.dev.vars` loading.
- `eslint.config.mjs`, `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.test.json`, `tsconfig.boundaries.json`: restore lint/type checks and reproducible development tooling. Strict boundary audit still reports known audio defects; see VERIFICATION.md.
- `vitest.config.ts`: bounded single-worker execution.
- `src/main/hotkey.test.ts`: typed async hoisted EventEmitter import replaces old require/lint suppression. `src/renderer/panel/App.tsx`: unused type import removed only.
- `.github/workflows/ci.yml`: Windows baseline checks on implementation branches/PRs; no release/signing/deployment steps.
- `docs/launch/`: versioned scope, baseline, results, audit and review context.

## Evidence

Before the auth fix, the initial workerd suite had 5 failed / 11 passed cases. After fixing auth and adding missing-config/all-route, same-length mismatch, whitespace placeholder, and upstream-error checks, 19 integration tests pass. Existing 32 unit tests, lint, app/Worker/test typechecks and production bundling pass. No desktop or live provider verification was performed.

## Review focus and limitations

1. Check missing/placeholder auth cannot reach a paid route, and verify timing-safe comparison is valid in workerd.
2. Verify the fixture outbound service intercepts every upstream request, including unexpected URLs; missing server config is tested with provider keys still present.
3. Check npm lockfile/tool versions, Windows CI, and the deliberately partial B02/B03 status. The existing dependency audit has critical/high reports; this batch does not remediate them or qualify a release.
4. Keep no-DOM audit failures visible. Do not enable it as a passing gate until the media work fixes the actual design. Four specific legacy files retain temporary explicit-any allowances.
5. The integration harness transpiles the current single-file Worker. Add actual bundling if imports are introduced later. It tests request handling/authentication, not provider API schemas or application UI.
6. Worker config still uses its existing compatibility date and toolchain. Environment generation, staging/production setup and runtime upgrades remain separate tasks.

## Recovery

Tooling changes can be reverted independently. Do not recover authentication by restoring the public placeholder or fail-open behavior. If this auth patch has an operational issue, disable protected paid routes or deliver a corrected secure build. No production deployment or data migration occurred here.

## B07 handoff: IPC event delivery

Main sends `AI_RESPONSE_CHUNK` as `{text}` and `CURSOR_POSITION` as `{x,y,label,screenIndex}`. The overlay previously read different names, resulting in undefined text and ignored points. Shared payload aliases now use the existing main contract; the preload implementation is checked against `PipAPI`, and orchestrator broadcasts are checked against the shared event map. Channel names live in `src/shared/channels.ts`, with a compatibility export at the existing main import path.

The overlay's production event bindings are extracted to `events.ts` and exercised through the actual preload plus orchestrator. Two new tests cover streamed chunks, parsed points, voice/power forwarding, zero/negative coordinates, nullable labels, and exact listener removal with multiple subscribers. Electron transport and AI/audio/screen providers are mocked; no actual desktop or provider call is claimed. Local lint, app/Worker/test types, 34 tests and production build pass. Existing build import warnings persist.

This is compile-time contract alignment, not runtime IPC authorization. B08 still owns raw legacy IPC removal, sender checks and input validation. B18 owns display-local/DPI transformations; B11/B12/B16 own turn lifetime and media rendering. Settings reset behavior is unchanged pending B09. Independent review remains pending. Rollback is a revert of the B07 commit; no stored data or deployed service changes.

## B09: settings persistence and recovery

Settings now initialize before IPC, windows and orchestration. Shared defaults replace the panel's divergent defaults. Version 1 normalizes each known field while keeping valid legacy preferences; migration writes only when necessary and preserves the original file in a uniquely named `.migration-*.bak`. Malformed JSON or a non-object root is moved to `.corrupt-*.bak` before a clean store is created. A newer schema or inaccessible storage is left untouched; the panel receives a notice and writes are refused. Successful writes use electron-store's atomic persistence before updating active state and broadcasting. The dedicated reset IPC restores and broadcasts defaults. Panel updates no longer display an unsaved optimistic value, and failures are shown inline.

Evidence: all 50 tests passed before the final dedicated IPC test was added; the final focused settings suite passes 19 tests (51 tests total in the suite). Lint, app/Worker/test typechecks and production build pass. The settings tests use actual electron-store and temporary files, covering restart, migration idempotence, exact backups, unknown keys/prototype keys, invalid values, future versions, reset IPC, broadcasts and disk failure. User settings were not opened or changed. Desktop UI interaction and independent review remain pending.

Rollback: revert this commit with Pip stopped. Existing flat preference keys remain compatible with the earlier reader. If manual data restoration is required, preserve the current file and copy the desired backup to `pip-settings.json` in the application user-data directory while Pip is stopped. Do not delete backups automatically. B10 still owns native hotkey registration validation/rollback, cursor visibility and model application. Model IDs and provider defaults have not been upgraded or certified in B09.

## B10: apply live settings

Implemented saved shortcut registration at startup and two-phase shortcut changes: reserve a new chord, persist preferences, then release the old chord. A failed reservation leaves the previous shortcut and file unchanged; a failed save unregisters the reservation. Changing the chord during a voice turn is refused. The shortcut editor now has an explicit Apply button. Startup registration failure is reported in the panel, which retains the voice button.

Cursor visibility loads from persisted settings and follows broadcasts, including in newly mounted overlays. A delayed initial read cannot overwrite a newer toggle. Disabling it hides the avatar and target highlight while retaining the overlay and its existing speech/waveform/media handling. Legacy cursor IPC routes now read/write the real setting.

Selected model IDs now reach all three provider request bodies. Provider changes atomically select that provider's existing default model; explicit custom model IDs can be applied from the panel. Migration repairs missing or known cross-provider default IDs. Existing model defaults are preserved, not certified for service availability. Transport tests intercept fetch; no credentials, paid requests, or deployed services are involved.

Validation: lint, app/Worker/test typechecks, 62 tests in 12 files, production build and diff checks passed. Added coverage for reservation/commit/rollback, refusal during voice turns, storage failure, provider/model pairing, mocked provider requests, cursor loading and stale-read races. Independent review, real OS shortcut behavior, desktop UI interaction and live model certification remain pending. Existing key-release detection and turn/media lifecycle issues remain in later tasks. Rollback: revert B10 with the app stopped; the settings format remains version 1.

## B08: IPC, navigation and permission boundaries

All application IPC handlers now authorize the registered WebContents object, exact renderer document URL, main-frame identity, and role-specific channel allowlist before dispatch. The overlay can read settings and submit bounded transcripts during listening; panel actions cannot be called from the overlay. Unknown/unregistered/navigated/destroyed senders and child frames are rejected. Settings validation remains in the settings owner. No raw invoke/on/off bridge remains: legacy browser speech and transcript consumers use named methods, and speech listeners are removed on cleanup. The development IPC argument logger was removed.

Both window types register their expected document before loading, block unexpected navigation, all redirects, child-frame navigation, webviews and popups. Packaged apps ignore the development renderer URL; development accepts loopback HTTP only. Production HTML gets a build-time CSP with local scripts, no renderer network connections, no frames/objects, and no form navigation. Inline styles remain necessary for the existing React styling; development HMR does not use this production CSP.

The blanket permission grant is replaced with both permission-check and permission-request handlers. Only audio media requests from a registered overlay main frame during listening are allowed. Video, screen-sharing, notifications and unrelated permissions are denied. Missing/unknown media types fail closed. OS permissions and browser speech support still require real desktop qualification; the Chromium permission policy does not certify native screen capture, protected-field privacy or a single microphone owner. B12/B15/B25 retain those responsibilities.

Evidence: lint and all typechecks pass; production build passes and CSP was inspected in both output HTML files. The security and bridge tests exercise handler dispatch, unregistered/child/navigated/destroyed frames, role restrictions, transcript bounds/state, denied popups/navigation, audio-vs-video decisions and named subscription cleanup. Full suite now contains 70 tests. Independent review and real Electron desktop behavior remain pending. No deployment or user microphone/screen access occurred. Rollback is a revert of B08 on the implementation branch; no stored data migration is involved.

API references checked against installed Electron 33 types and official docs: [permission handlers](https://www.electronjs.org/docs/latest/api/session), [navigation and window controls](https://www.electronjs.org/docs/latest/api/web-contents). Electron upgrade/security advisories remain B32; these application checks do not replace that work.

## B11: turn ownership and cancellation

Each listening turn owns its settings snapshot, transcript, STT session/close promise, TTS provider and AbortController. Cancellation and barge-in revoke ownership before cleanup. Every asynchronous capture/stream/TTS continuation checks ownership before publishing text, coordinates, history or state changes. Quick release waits for the session that was opened; late-created canceled sessions are closed once. State-machine resets now notify cleanup listeners. Shutdown destroys the orchestrator.

Panel Cancel Processing / Stop Speaking now use a dedicated authorized cancellation action. Stop Recording still finalizes a listening turn. Renderer transcript submissions carry a turn ID; stale callbacks cannot overwrite a later utterance. Hotkey key-release handling also checks the original turn ID. AI fetches and paid-TTS fetches receive the turn signal, and TTS checks cancellation before starting delayed playback. Only still-current completed turns enter history; current failures reset the turn instead of fabricating a completed answer.

Validation: lint, all typechecks, production build and diff checks pass. Race tests cover quick release, canceled STT startup, delayed capture, old streamed chunks/errors, old TTS completion, forced reset, repeated cancel, stale renderer transcripts and old hotkey releases. Provider tests confirm signal forwarding with mocked fetch. All tests run without provider access or a desktop launch. Independent review remains pending.

Limits: pending STT creation does not yet have an abortable provider API; its returned session is closed when it arrives. Capture itself is not interruptible, but its canceled result is discarded. Existing browser TTS resolves before playback acknowledgement; paid TTS still has the known main/DOM ownership problem. B12/B14/B16/B17 must establish actual media completion, bounded provider startup/finalization and native resource-release qualification. This change isolates stale work; it is not a claim that those existing media implementations are launch-ready. Rollback is a revert of B11 with the app stopped; no disk schema changes.

## B12: single media renderer and playback handshake

One hidden sandboxed media window now owns browser speech synthesis and browser recognition. Overlays are visual only; changing display count or recreating an overlay does not create audio owners. The media renderer registers event listeners before announcing readiness. Only the registered media main frame may announce readiness, acknowledge playback, submit transcripts or request microphone access during listening. Browser recognition honors the selected STT provider; PCM/provider capability and final-transcript handling remain B13-B15.

Browser TTS sends to this window only and waits for a matching request-ID completion/error acknowledgement instead of resolving immediately after send. Readiness and playback waits are bounded, abort/stop rejects outstanding playback, and late acknowledgements cannot settle a new request. Reload/crash/disconnection rejects pending work; a crash resets the current voice turn and the singleton window is recreated on the next listening turn or playback request. Playback callbacks detach on stop and unload. Browser-media DOM code was removed from all overlays, allowing removal of the remaining ESLint any exception.

Evidence: full suite passes 85 tests across 17 files; lint, all typechecks and production build pass. Following the final startup/recreation adjustment, the 5 controller/window tests and build were rerun successfully. Coverage includes one-window reuse, readiness, completion IDs, stale completions, cancellation, playback error, crash/recreation, timeouts, renderer speech events and media-only permissions. The build now includes the third media HTML/JS entry with the existing production CSP.

Limits: this is tested with simulated Electron and speech events, not audible playback or real-device permissions. Browser speech availability/long-utterance behavior, PCM microphone transport, AssemblyAI v3 finalization, paid TTS playback through this renderer, and interruption/device/sleep tests remain B13-B17/B27. Existing paid TTS main/DOM problems are not hidden by this change. Independent review remains pending. Rollback: revert B12 with Pip stopped; no settings/data schema migration is required.

## B13: microphone capture and PCM transport

The media renderer captures the microphone only for AssemblyAI listening turns. An AudioWorklet averages input channels and resamples to mono 16 kHz signed little-endian PCM16, sending 100 ms chunks and flushing the final partial chunk on stop. The serial IPC queue is limited to 50 chunks (five seconds); transport failures cancel the turn instead of silently dropping audio. Main accepts only the registered media sender, bounded even-sized buffers and sequential chunks for the current turn. It publishes audio power from accepted samples.

Stopping waits for worklet flush and queued IPC completion before closing STT. Startup/drain waits are abortable and bounded to ten seconds; worklet stop acknowledgement is bounded to two seconds. Late microphone permission releases acquired tracks, stale chunks are rejected, and capture failure or an empty recording cancels without starting a screenshot request. Closed or congested STT sockets now reject audio explicitly.

Evidence: 94 tests across 18 files pass, along with lint, app/Worker/test typechecks and production build. Tests execute the actual worklet in a simulated worklet scope at 16, 44.1 and 48 kHz; cover channel mixing, clipping and tail flush; and exercise transport ordering, overflow, delayed permission, IPC bounds, stop/drain and turn ownership. The production output contains pcm-worklet.js. Existing mixed-import build warnings remain.

Limits: no real microphone, Electron device-permission flow or live provider request was exercised. Resampling quality and device/sleep recovery require native qualification. The existing AssemblyAI event parser/finalization is still pending B14, so this does not certify working live transcription. Paid TTS remains B16. Independent review is pending. Rollback: revert B13 with Pip stopped; no stored data or settings schema changes.

## B14: AssemblyAI v3 and final transcripts

Replaced the v2 text/message_type parser with Begin, Turn and Termination handling. The session becomes ready after Begin. Turn-order entries replace partial and formatted revisions, aggregate multiple speech segments in order, and reject partial regressions after finalization. Stop sends Terminate and waits up to ten seconds for server confirmation while keeping transcript callbacks active. An unfinished partial at Termination is an error. Cancellation detaches callbacks, clears timers and terminates the socket; unexpected close/error fails outstanding work. Orchestration now propagates the turn signal and refuses screenshot/AI work after STT failure or an empty AssemblyAI transcript.

Token fetch/body reading and session startup have ten-second limits. Tokens are validated and URL-encoded; raw response bodies, WebSocket events and tokens are excluded from errors/logging. Short final PCM chunks are padded to 50 ms. The Node ws package is now an explicit production dependency at the already-installed 8.21.0 version, with @types/ws added for compilation; this avoids relying on browser globals in Electron main. No broad dependency upgrade occurred; the existing 16 audit findings remain a separate release task.

Evidence: 109 tests in 19 files pass, including 12 provider tests and 3 additional orchestration regressions. Fixtures cover ordered/formatted turns, late final words, malformed messages, startup and finalization timeouts, cancellation, unexpected disconnects, token validation and short audio chunks. A real loopback WebSocket server confirms binary audio delivery and final-transcript/termination exchange without external provider access. Lint, app/Worker/test typechecks, production build and diff checks pass. Existing mixed-import build warnings remain.

Protocol sources: [AssemblyAI v3 migration](https://www.assemblyai.com/docs/streaming/guides/v2_to_v3_migration_js) and [WebSocket API](https://www.assemblyai.com/docs/streaming/api-spec/streaming-websocket). Live model availability, latency, real-device audio and backlog behavior remain B17/B21 qualification; no paid request or credentials were used. Worker validation (B05), spend/session controls (B31), browser fallback (B15), paid TTS (B16) and independent review remain open. Rollback: revert B14 with Pip stopped and reinstall the prior lockfile; no persisted data schema changes.

## B15: browser speech and typed fallback

Typed input uses a new panel-only, bounded IPC action and an idle-to-processing transition; it never broadcasts listening or starts STT/microphone capture. The form discloses screen inclusion and refuses overlapping requests. Browser recognition honors the selected provider, detects absent constructors, reports actual failures, requests a graceful stop, and delivers the latest result only when recognition ends. Main waits for that acknowledgement with the existing bounded/abortable audio drain. Empty speech cancels before capture, removing the old fabricated screen-guidance prompt. Late/canceled callbacks cannot complete a newer turn.

Evidence: 116 tests in 20 files pass, including typed/no-microphone flow, invalid/overlapping input, empty browser results, sender restrictions, missing recognition support, late final results and canceled callbacks. App/Worker/test typechecks and production build pass. UI/device checks and independent review remain pending. Recognition availability is checked when requested; constructor presence alone is not claimed as service availability or offline operation. Rollback: revert B15 with Pip stopped; no persistent schema changes.
