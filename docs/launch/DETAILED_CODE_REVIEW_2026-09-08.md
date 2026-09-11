# Pip detailed code review — 8 September 2026

**Source: `7992ded`, `feature/launch/implementation`. Verdict: unfinished; HOLD external release.**

This extends [the initial completion audit](./COMPLETION_AUDIT_2026-09-08.md) with a file-by-file review, reproducible defect probes, a real Electron renderer/IPC smoke run, and inspection of the existing packaged archive. The resulting execution plan is [FULL_COMPLETION_PLAN.md](./FULL_COMPLETION_PLAN.md).

## Coverage and limits

Read the 116 tracked first-party text files under `src/`, `worker/src/`, and `test/`: **9,738 lines**, including 34 test files and 82 other source, type, worklet, HTML and CSS files. Traced imports, IPC authorization/dispatch, renderer subscriptions, provider transport, storage ownership and feature callers. The [file inventory](./FILE_REVIEW_INVENTORY.csv) records each path, line count and SHA-256. It is a review inventory, not a claim that every line is defect-free.

Also reviewed package manifests, TypeScript/ESLint/Vitest/Vite/builder configuration, Worker configuration and installed type/schema definitions, CI, README, contribution rules, launch plan/tracker/checklist, progress and verification claims. Lockfiles were examined through dependency tooling rather than hand-reviewing every dependency implementation. Resource icons were checked for presence/size and load behavior; the generated application archive was inspected for shipped content and external runtime references. Inspiration repositories were excluded deliberately: Pip is the product.

No real desktop capture, microphone recording, live provider use, production deployment, installation on a clean machine, update recovery, physical multi-monitor trial or Mac trial was performed. The Electron smoke uses a temporary user-data directory, hidden windows, an empty capture fixture and an in-process provider fixture. It tests the built app/preload/React/IPC boundary, not normal Windows focus, audio, GPU or permission behavior. This is not the separate independent reviewer sign-off required by CONTRIBUTING.md.

## Verification evidence

The audited production source has not changed since the initial check run: lint fails with two errors; Worker typechecking fails with TS2559; app/test/boundary checks pass; 166 unit and 26 Worker integration tests pass; the application build passes. See the initial audit for exact commands and dependency/signature results. Unchanged checks were not repeatedly rerun merely to inflate evidence.

Additional executable evidence:

- [Source probe harness](./audit-probes.cjs), [probe observations](./AUDIT_PROBE_RESULTS.json). Executes the actual TypeScript modules with controlled host/storage mocks; no external actions.
- [Electron smoke harness](./audit-electron-smoke.cjs), [Electron observations](./AUDIT_ELECTRON_RESULTS.json). Loads `out/main/index.js`, real sandboxed preload and production React pages. Read-only UI checks plus settings changes confined to the temporary profile and a canceled fixture text turn.
- Both harnesses pass Node syntax checks. Probe process completes successfully while reporting the defects; this is not a green acceptance suite.
- The final Electron run loaded media, panel and overlay, sent one fixture request, reproduced the findings below, canceled it and exited. Earlier attempts had harness-only window-substitution errors; those were corrected and their processes stopped. They are not counted as Pip defects.

## Confirmed findings and implementation mapping

Severity here describes launch impact. “Reproduced” means observed in the isolated probes or Electron smoke; “source” means established by the inspected code/artifact. Hardware implications remain separately qualified.

| ID | Priority / evidence | Finding and consequence | Plan |
| --- | --- | --- | --- |
| F01 | P1 / reproduced, Electron + source | `ipc/security.ts:53` omits DIAGNOSTICS_COLLECT, CAPTURE_POLICY_GET, CAPTURE_PAUSE, CAPTURE_RESUME and ONBOARDING_COMPLETE from panel authority. Their real preload calls reject before handlers execute. SETTINGS_GET succeeds as control. | P03 |
| F02 | P1 / reproduced | `windows/overlay-window.ts:26–42` adds display listeners every initialization. `index.ts:97–102` calls it again after metric changes, but destruction does not unregister listeners. Three recreate cycles leave three listeners and one added-display event creates three windows, overwriting tracked ownership. | P04 |
| F03 | P1 / reproduced | `hotkey.ts:116–120` ignores key identity. An unrelated keyup changes listening to processing. Q09 explicitly requires the opposite. Hook start exceptions are swallowed and the global hook is not stopped by unregisterAllHotkeys. | P04 |
| F04 | P1 / source | Existing `release/win-unpacked/resources/app.asar` contains 24 archive entries, only application output and package.json. It omits ws/uiohook-napi and their native payloads; there is no adjacent node_modules or app.asar.unpacked. Its main bundle still calls `require("ws")` and `require("uiohook-napi")`. A launch inside this checkout can find ancestor dependencies and conceal a clean-machine failure. Builder excludes node_modules. | P02 |
| F05 | P1 / source | Current lint and Worker type gates fail. Worker Env lacks the admin binding shape used at index.ts:62. Build transpilation and the Miniflare tests also transpile without establishing Worker type correctness. | P01 |
| F06 | P1 / source and existing tests | `privacy/field-masking.ts:68–87` returns original image for protected regions. Orchestrator sends captured JPEGs without calling masking/sanitization. The masking test asserts unchanged output. This is a privacy release blocker. | P10–P11 |
| F07 | P1 / reproduced and source | Strict mode remains permissive without protection. Lock/unlock loses a user pause; lock/suspend does not cancel an active turn. Policy is only checked before asynchronous capture, not before upload; AX querying runs outside that branch. | P09–P11 |
| F08 | P1 / source | `accessibility-adapter.ts:70–87` reads Pip's focused Electron window, not external application UIA controls. No selected native helper exists. Protected names are printed into prompt context; name truncation is not redaction. | P08–P10 |
| F09 | P1 / source | Invite/token/quota helpers have no production paid-route integration; desktop still uses a shared secret. No corresponding storage bindings in Wrangler. Token encryption output is discarded. Admin setter is not exposed; absent admin storage silently disables the stop control. | P12–P15 |
| F10 | P1 / reproduced | Two concurrent 40-cent reservations both return true against a 50-cent ceiling; persisted reservation is only 40 cents. Negative reservation is accepted. `quota.ts` is non-atomic and fails open without storage. Day rollover clears outstanding reservations and settlement has no unique reservation identity. | P14 |
| F11 | P1 / reproduced and source | After refresh rotation, revoking the old access token leaves the new access and refresh tokens usable. There is no session-family revocation. Invite redemption/refresh also have read/write races; stored token secrets are raw. These helpers are not yet production routes. | P13 |
| F12 | P1 / source | Worker reads complete request bodies before byte validation. Model checking is prefix-based, accepts a fixture-only name, and leaves message/image/output-token and TTS text/model schemas largely unchecked. Multiple upstream error bodies pass through unchanged. | P12 |
| F13 | P1 / reproduced | `ai/sse-stream.ts` ignores Claude `message_delta.delta.stop_reason`. A partial response with max_tokens followed by message_stop is accepted as complete. `[DONE]` is also accepted regardless of provider. | P06 |
| F14 | P1 / source | AI adapter fetch calls have the turn signal but no deadline before response headers arrive. Stream deadlines start only after fetch returns. Capture enumeration also has no caller timeout. A stalled stage can leave processing/responding until manual cancellation. | P05–P06 |
| F15 | P1 / source | No native action executor, exact approval store/UI, fresh target resolution, postconditions, undo policy or walkthrough/action journal integration exists. The unused proposal helper is not a safe action system. | P20–P23 |
| F16 | P1 / source | Journal and memory are process-local Maps, not persistent encrypted stores. Journal records raw title/goal in logs and interpolates text in Markdown. There is no connected tutorial editor, file export, follow-up scheduler, or local model/network-enforced offline stack. | P17–P19, P24–P28 |
| F17 | P1 / source | Hardcoded certification flags and tests that assert those flags do not certify a live provider combination. Offline benchmark claims have no reproduced harness/device evidence. Several provider labels disagree with IDs/defaults. | P01, P07, P27, P30 |
| F18 | P1 / source | Unsigned existing installer, placeholder update feed, sample/nonmatching manifest checksums, no qualified update/recovery pipeline. Dependency audit reports 16 vulnerable packages (including dev/transitive paths), requiring triage. | P01–P02, P31–P33 |
| F19 | P2 / reproduced, Electron | Panel reload during an active fixture response displays the idle “Hold or Click to Speak” state. Only media has a current-state handshake. Overlay/panel default idle and rely on future events. Initial panel settings reads can also overwrite newer events. | P03, P16 |
| F20 | P2 / reproduced, Electron | Raw `[POINT:none]` appears in overlay text. Main emits raw AI chunks before parsing; the current bridge test explicitly expects the raw point chunk. Point parsing only cleans TTS/history. | P06, P16 |
| F21 | P2 / source | Response text is absent from panel; the bubble disappears on idle and belongs to a click-through native window despite CSS pointer-events:auto. It cannot serve as a reliable scrollable/readable answer transcript. Target boxes are synthetic 80x40 rectangles, not verified element bounds. | P16, P19 |
| F22 | P2 / source | CursorBuddy schedules RAF and new React position state indefinitely after settling, on every monitor. No reduced-motion path exists; bubbles can be clipped at edges. Dropdown/checkbox labels are not all programmatically associated. | P16, P30 |
| F23 | P2 / source | Main snapshots settings at turn start, but browser and PCM renderers independently reread mutable settings. A provider change during startup can make main and renderer choose different STT modes. The panel has no per-device controls or effective provider capability gate. | P03, P05, P07 |
| F24 | P2 / source | Browser recognition ignores result finality; onend can forward latest interim text as completed. Panel-initiated recording has no session duration ceiling; only the held shortcut has a 60-second fallback. No common watchdog covers mic idle/no samples. | P05 |
| F25 | P2 / source + Electron | Onboarding's permission check returns unknown, grant returns Not yet implemented; completion is not persistent and is also IPC-denied. Test voice bypasses the one media owner; Next buttons do not require successful setup. Displayed voice/providers do not prove available devices. | P16 |
| F26 | P2 / source | Capture failure can still lead to a prompt claiming screen visibility with a default primary display. Screen/AX data is appended inside system instructions without an explicit untrusted-observation contract. This becomes especially important before actions and memory retrieval exist. | P06, P09, P20 |
| F27 | P2 / source | Lifecycle startup promise lacks an application-level failure/recovery boundary; panel and overlay load promises lack rejection handling. Media is partly recoverable, but its reload/crash paths are not equivalent and full quit/helper/hook/resource qualification is absent. | P04–P05 |
| F28 | P2 / source + Electron | Tray assets are only 148 bytes each; Electron failed to load the configured icon and used the fallback. Packaged archive contains no tray resources. “Show Panel” toggles visibility and About is a TODO. | P02, P16 |

These findings supplement, rather than replace, the initial B01–B64 coverage matrix. Severity of unused helpers is the consequence of shipping/enabling them unchanged, not a claim that absent actions already execute or absent quota routes already enforce a budget.

## Tests: what to preserve and what to replace

Preserve existing tests for sender/frame/navigation isolation; settings disk failure/backups; hotkey reservation rollback; old-turn cancellation; WebSocket finalization and loopback transport; PCM conversion/backpressure; playback acknowledgement; current-image attachment; coordinate transforms and SSE framing. They protect valuable behavior.

Replace misleading completion assertions with actual invariants: masking must remove pixels/data; certification must reference exact successful live evidence; tutorials/memory must survive process restart; onboarding must render and operate through authorized IPC. Add cross-module tests for every newly exposed channel, genuine provider termination semantics, panel reload state, display listener lifecycle and packaging outside the checkout. Concurrency tests must exercise routes and durable storage, not only a single sequential helper call.

A failed smoke setup is not an application defect; a mocked green path is not hardware evidence. Keep both distinctions in future progress reports.

## Remaining verification requiring another environment or completed features

Real Windows microphone/speaker permission changes and device removal; mixed-DPI/portrait/negative-origin monitors; secure desktop/elevation/unsupported UIA providers; long-running normal/rapid-cancel usage; real provider availability/latency/quality/cost; exact installer clean launch and uninstall; signing and interrupted updates; offline CPU/GPU/model/license benchmarks and outbound-attempt tracing; Mac qualification. Missing functionality must first be implemented so these tests have something meaningful to exercise.

## Architectural source checks

The plan's consistency choice follows Cloudflare's documentation: KV is unsuitable for atomic read/modify/write transactions, while Durable Object storage provides transactional primitives. See [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/) and [Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

The native grounding plan uses actual UI Automation elements/control patterns rather than Electron window metadata; see [Microsoft UI Automation overview](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-overview). Runtime boundaries and dependency maintenance should continue to follow [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security). These sources support design direction, not proof that Pip has implemented it.
