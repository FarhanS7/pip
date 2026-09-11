# Pip completion audit — 8 September 2026

## Verdict

**NOT COMPLETE. Release decision: HOLD.**

Audited source: `7992ded`, branch `feature/launch/implementation`. Working tree was clean before this audit. This report is the only source-tree change made by the audit; application code was not changed. The subject is `pip/`, not the Clicky or Reticle inspiration projects.

The agreed first external release is the **full-core Windows invited beta**: voice and screen guidance, native grounding, privacy controls, tutorials, permissioned actions, persistent memory and follow-ups, optional offline operation, opt-in proactive help, revocable access, usage ceilings, and a qualified signed installer. macOS and public paid access follow. See `LAUNCH_IMPLEMENTATION_PLAN.md`, `LAUNCH_TASK_TRACKER.md`, and `LAUNCH_RELEASE_CHECKLIST.md` in this directory.

Pip has a substantial implementation of the voice/screen guidance foundation and useful regression tests. Several newer feature modules are disconnected helpers, some are explicit placeholders, and key release controls are missing. A successful compilation and helper tests do not satisfy the plan's user-visible acceptance criteria. No completion percentage is assigned: these requirements differ greatly in effort and risk.

This is a current-source completion audit, not the independent review required by CONTRIBUTING.md and the release process. It does not establish real-device/provider certification or guarantee absence of other defects.

## Checks actually performed

| Check at audited source | Result |
| --- | --- |
| `npm run lint` | FAIL: 2 errors, 0 warnings |
| `npm run typecheck:app` | PASS |
| `npm run typecheck:worker` | FAIL: TS2559 at `worker/src/index.ts:62`; `Env` has no properties in common with `AdminEnv` |
| `npm run typecheck:test` | PASS when run separately; aggregate typecheck stops at Worker failure |
| `npm run typecheck:boundaries` | PASS |
| Unit tests, `RUN_LIVE_CERTIFICATION=false` | PASS: 166 tests across 32 files |
| Worker integration tests | PASS: 26 tests across 2 files |
| `npm run build` | PASS; dynamic/static import warnings remain |
| `npm audit --json` | 16 reported vulnerabilities: 1 critical, 14 high, 1 moderate |
| Existing Windows installer signature | `NotSigned` from `Get-AuthenticodeSignature` |
| Existing installer checksum | See below; differs from manifest template |

Lint errors are the unused `DEFAULT_ACTION_POLICY` import in `src/main/actions/action-policy.test.ts:5` and `prefer-const` in `src/main/proactive/stuck-detector.ts:21`. The CI workflow runs lint and typecheck, so this source cannot pass its configured verification sequence as it stands. The successful application build transpiles code; it does not override a failed Worker typecheck.

Dependency advisory counts include development and transitive packages, not 16 demonstrated production exploits. The report flags Electron and electron-builder directly, `tar` as critical transitively, and Miniflare as moderate. B32 requires dependency-path/exploitability triage and a verified upgrade plan; blindly applying force upgrades would not satisfy it.

Existing artifact inspected without executing/installing it:

```text
release/Pip-Setup-0.1.0.exe
Size: 81,875,717 bytes
Authenticode: NotSigned
SHA-256: A8C6DA3C930E7E63FC699D499EC27A1CFFB594868CBD204C126325DE69DDA9C1
```

Packaging was not rerun. The existing installer is not proven to correspond to the audited source. No clean-machine installation, real microphone/speaker/Windows UIA test, live paid-provider request, deployment, update/rollback trial, or beta soak was performed during this audit. External deployment state is not established by repository files.

## Findings that prevent completion

### 1. Privacy masking does not mask or protect the outgoing screenshot — release blocker

Evidence: `src/main/privacy/field-masking.ts:68–87`, `src/main/orchestrator.ts:195–244`, `src/main/privacy/privacy.test.ts:95–98`.

`applyMaskingToBase64` returns the original image even when protected regions are supplied; the function contains an explicit pixel-masking TODO. The test asserts that unchanged output. The orchestrator builds provider images directly from captured JPEGs and does not call this masking function or the accessibility sanitizer. Protected-region extraction on a synthetic tree is therefore not evidence of outbound redaction.

`setStrictMode` merely changes a boolean. `isCaptureAllowed` checks only `state === 'active'`, and production code does not connect missing protection to a strict-mode block. Accessibility context is queried outside the screenshot-policy branch. The textual sanitizer expects `[password]...[/password]` tags, which do not match the accessibility formatter's protected-element representation.

Required: real protected-field discovery, masking in image coordinates before serialization, tree scrubbing, explicit capture/network policy, and tests proving seeded private content is absent from the actual outbound payload. Until then B24/B25 cannot be described as protected capture.

### 2. The Windows accessibility adapter is not a native desktop UIA implementation

Evidence: `src/main/accessibility/accessibility-adapter.ts:70–71`, `docs/launch/ADR-accessibility-helper.md`, package `rebuild-native` script.

The adapter imports Electron and calls `BrowserWindow.getFocusedWindow()`. It emits a single Pip-window title/bounds record or an empty snapshot. It does not traverse controls in browsers, File Explorer, or other desktop applications. The isolated native helper selected in the ADR is absent, and the rebuild script targets an absent `native/accessibility-win` directory.

Required: the actual bounded, isolated Windows helper, normalized element identities and protected flags, timeout/crash recovery, packaging, and reference-application trials. The ADR records an architectural choice, not a completed feasibility measurement or B23 implementation.

### 3. Per-user beta authentication, quotas, and owner controls are not operational

Evidence: `worker/src/index.ts:23–95`, `worker/src/auth.ts`, `worker/src/quota.ts:45–82`, `worker/src/admin.ts:17`, `worker/wrangler.toml`, `src/main/auth/token-store.ts:23–30`.

Paid routes still authenticate the shared `X-Pip-Auth` secret. Invite/session helpers have no HTTP routes or production callers; the desktop does not use the token store for provider requests. Token encryption buffers are discarded rather than persisted. Wrangler defines no invite/session/quota/admin storage bindings.

Quota reservation is a KV read/modify/write with no atomic coordinator, and missing quota storage returns success. Concurrent requests can read the same allowance and overwrite each other's reservations if this helper is wired unchanged. Invite redemption similarly reads and writes separately, so it is not replay-safe under concurrency. The request path checks the kill-switch helper, but missing admin storage returns inactive; the setter has no exposed admin route. Its missing Env wiring also causes the current typecheck failure.

Required: authenticated route integration, durable token lifecycle, atomic redemption/reservation, fail-closed missing configuration, explicit bindings/migrations, owner controls, and concurrency/revocation tests through actual paid routes. The shared-secret auth regression tests are valuable but test a different access model.

### 4. Proxy validation remains insufficient for the planned spending boundary

Evidence: `worker/src/index.ts:135,168,259,292,325,365`, `worker/src/validation.ts`.

Chat/TTS bodies are fully read with `request.text()` before actual byte-size validation; Content-Length is only an early optional check. Validation checks top-level shape and provider/model naming but does not enforce a complete message/image/text/output-token schema. Model acceptance uses broad prefixes and even permits `fixture-custom-model` in production validation, rather than a bounded approved catalog. Several upstream responses, including error responses, pass their bodies straight through; regex sanitization in selected branches is not comprehensive error sanitization.

Required: bounded streaming request reads, route-specific schemas and output/text limits, an explicit production capability allowlist, uniform bounded public errors, and adversarial route tests. The added upstream timeout is useful progress, not completion of all B05 controls.

### 5. Tutorials and walkthroughs are not implemented end to end

Evidence: `src/main/sessions/session-journal.ts:32–98`, production-call searches, main/preload/renderer module inventory.

The journal is a module-level Map with start/record/end functions. No normal orchestrator flow calls them. It does not persist atomically, distinguish the full lifecycle through real integration, or provide a tutorial editor. A function assembles a Markdown string, but no user-facing file export or HTML export flow exists. Session title and goal are logged without redaction; export interpolates content without a privacy/escaping pipeline. There is no multi-step walkthrough controller with pause/resume/skip/block semantics.

Required: B35–B38 as actual user journeys, plus action outcome integration in B43. Do not describe the current string helper as completed automatic tutorials.

### 6. Permissioned actions stop at an unused proposal helper

Evidence: `src/main/actions/action-policy.ts:40`, production-call searches and module inventory.

The helper checks expiry, operation membership, and three exact blocked executable names. It has no production consumer. Exact approval UI/store, target/value/turn binding, single-use approval, native execution, re-resolution/focus checks, postcondition verification, truthful undo, and queued-action stop are absent. The validator also does not enforce its configured maximum validity or fully validate untrusted target/expiry data.

This is missing functionality, not evidence that Pip currently executes unapproved actions: there is no corresponding executor. Required: B39–B43 with refusal, replay, focus-race, cancellation, and verified-outcome tests before enabling execution.

### 7. Persistent memory, follow-ups, and proactive assistance are missing as product features

Evidence: `src/main/memory/session-memory.ts:20`, `src/main/proactive/stuck-detector.ts:21–71`, production-call searches.

Memory is an in-memory Map despite its encrypted/persistent description. There is no disk/encryption integration, restart/migration/retention behavior, opt-in inspection UI, or retrieval integration into answers. Follow-up scheduling/notifications with timezone, restart, snooze and deduplication are absent. The stuck detector is an unused failure counter/cooldown helper, without opt-in observation, preferences, or suggestion UI.

Required: B44–B46 and B50–B51 as connected, privacy-controlled features. Their helper unit tests do not demonstrate persistence or actual proactive behavior.

### 8. Offline mode has a report but no runnable local stack

Evidence: `docs/launch/SPIKE-offline-feasibility.md`, provider implementations/factories, shared capabilities, settings and module inventory.

The document recommends Whisper/Piper/local vision options and gives benchmark figures, but the repository does not provide corresponding runnable adapters, model download/verification/lifecycle, an offline switch enforced across networking, or an offline voice-to-tutorial flow. No reproducible benchmark harness/raw measurements or exact reference machine were found supporting the report's figures. Those measurements remain unverified by this audit.

Required: reproducible hardware/license feasibility evidence and B48/B49 implementation. Offline was explicitly included in the agreed beta scope; it cannot silently be moved after launch.

### 9. Onboarding and lifecycle handling are partial, with privacy/audio regressions to address

Evidence: `src/renderer/panel/App.tsx:30,95–122`, `src/renderer/panel/components/OnboardingWizard.tsx:49–64`, `src/main/ipc/handlers.ts:145–189`, `src/main/index.ts:77–95`.

The wizard opens manually; its initial state is false. Permission status returns `unknown` and request handlers return `Not yet implemented`. Completing onboarding only logs success; it does not persist a completed setup state. The speech test uses panel-local browser speech, bypassing the main/media turn owner and the selected paid TTS path. It does not verify microphone/STT/screen/provider readiness before allowing completion.

Lock/suspend handlers only pause future screen capture; they do not cancel an active voice/provider/playback turn. Unlock/resume unconditionally restores active capture, losing a prior user pause. A capture already in flight is not protected by a second policy check before upload. These require real lifecycle tests and composable pause reasons.

Packaged service configuration still relies on process environment variables and default Worker URLs; the wizard does not provision per-user access. A fresh installer therefore is not proven usable without developer setup. Metadata-only diagnostics are useful but do not establish complete accessible UI, privacy-safe logging, or support export qualification.

### 10. Provider certification and release evidence overstate what was verified

Evidence: `src/shared/capabilities.ts:34–111`, `src/main/ai/provider-certification.test.ts`, `docs/launch/VERIFICATION.md`, `docs/launch/release-manifest.md`, `electron-builder.yml`.

Capability entries are hardcoded certified. Unit tests assert those flags; the optional live test checks health and optionally token issuance, not a complete screenshot-to-answer-to-audible-response flow. It can pass without a secret. No real provider/model availability or hardware compatibility was established here. Additional advertised choices must remain unverified until measured; existing fixtures do not certify them.

VERIFICATION.md claims clean lint/types, native UIA, atomic quota, and persistent memory, contradicted by the current checks/code above. The manifest is explicitly a template, contains a stale/sample source commit and nonmatching placeholder checksums, and cannot serve as an artifact attestation. The installer is unsigned; the update feed is `https://pip-updates.example.com`; no complete updater/recovery implementation or signed release pipeline was found.

Required: correct status records, attach evidence to exact source/artifact hashes, certify at least one live supported combination, resolve supported dependencies, sign and qualify a real installer, and exercise updates/recovery. Do not promote the current manifest or installer as a verified release.

## Plan coverage, including all task IDs

“Implemented foundation” means substantial connected code and fixture coverage, not independent release approval. “Partial” means some code/documentation exists but acceptance criteria remain unmet. “Missing” means no complete user-facing implementation was found. No row below is promoted to the plan's final independently verified status by this audit.

| Tasks | Assessment | What remains against the plan |
| --- | --- | --- |
| B01 | Implemented planning baseline | Reconcile latest completion claims with evidence |
| B02 | Regressed gate | Fix the two lint errors and Worker Env type failure |
| B03 | Implemented test/CI foundation | Add missing actual-boundary and required-feature coverage; restore green CI |
| B04 | Implemented shared-secret auth fix | Preserve fail-closed behavior while introducing per-user auth |
| B05 | Partial | Bounded read/schema/model/output/error controls in finding 4 |
| B06 | Partial | Validate actual packaged environment/service configuration and isolated bound storage |
| B07–B10 | Implemented IPC/settings/hotkey foundation | Full packaged settings/recovery and interactive acceptance evidence |
| B11–B16 | Implemented voice/media/provider foundation | Live microphone/STT/TTS/device acceptance; remove onboarding's second speech owner |
| B17 | Partial race/cancellation coverage | Full media crash/quit/lock/suspend/resource qualification |
| B18–B20 | Implemented capture/mapping/vision/stream foundation | Real mixed-DPI/display/provider qualification, privacy integration |
| B21 | Partial catalog; certification unproven | One complete measured live combination, supported-choice evidence |
| B22 | ADR exists; spike evidence incomplete | Build/compare actual native approaches on reference apps |
| B23 | Placeholder | Actual isolated Windows UIA helper and grounding |
| B24 | Placeholder | Real outbound image/tree redaction |
| B25 | Partial | Strict policy enforcement, disclosure, pause/blocked upload invariants |
| B26 | Partial wizard | Real permissions, device/provider readiness, first-run persistence |
| B27 | Partial hooks | Full lifecycle/permission/device/display recovery; preserve user pause |
| B28 | Partial diagnostics/UI | Accessibility trials and privacy-safe operational diagnostics/logging |
| B29 | Disconnected helper | Invites/revocable sessions and desktop integration, replay-safe persistence |
| B30 | Disconnected non-atomic helper | Atomic spending reservations and actual route enforcement |
| B31 | Partial kill-switch hook | Bound storage/admin route, per-user STT budgets and owner controls |
| B32 | Unresolved | 16 advisory findings need triage; supported native/Electron toolchain qualification |
| B33 | Partial packaging; installer exists | Exact candidate manifest/assets and clean Windows install/run evidence |
| B34 | Missing release capability | Signing, working update distribution, recovery and migration trials |
| B35 | Disconnected in-memory helper | Sanitized atomic session journal integrated with all turn outcomes |
| B36 | Missing | Automatic drafts and tutorial editor |
| B37 | Partial string helper | Real local Markdown/HTML export with privacy and escaping |
| B38 | Missing | Multi-step walkthrough controller and controls |
| B39 | Disconnected partial helper | Untrusted proposal schema and complete local policy |
| B40–B43 | Missing | Exact approval, executor, verification/undo/stop, journal integration |
| B44–B45 | Disconnected in-memory helper | Persistent opt-in memory, retention, inspection, retrieval |
| B46 | Missing | Approved follow-up scheduler and notification lifecycle |
| B47 | Document only; measurements unverified | Reproducible offline hardware/license/quality evidence |
| B48–B49 | Missing | Local providers/model lifecycle and enforced no-network mode |
| B50–B51 | Disconnected counter/cooldown | Opt-in observation and proactive suggestion/snooze UI |
| B52 | Not qualified | Exact packaged candidate must pass required full-feature scenarios |
| B53 | No recorded completion evidence | Owner soak and small invited cohort operation |
| B54 | HOLD | Signed tested artifact, support/budget/recovery and launch decision |
| B55 | Optional, outside required beta | Hosted tutorial sharing; local export remains required |
| B56–B57 | Deferred by agreed platform scope | macOS adapters, hardware, signing and qualification |
| B58–B60 | Later public/paid scope | Public identity, billing, site/support and public release |
| B61–B64 | Later scoped pilots | Enterprise and learning tracks |

The release checklist still has no qualified candidate and leaves required gates unchecked. No evidence was found for the specified 100 representative interactions, proposed 95% completion target, 50 action scenarios, idle/sequential-turn/cancellation soak, three fresh-machine/profile trials, offline zero-outbound verification, or completed owner/invited-beta observation. Unchecked checklists alone would not prove missing code; here they agree with specific missing implementations and failed checks.

## Recommended completion order

1. Restore truthful baseline: fix lint/type errors, correct unsupported completion/certification claims, triage dependencies, keep current fixture coverage green.
2. Complete the privacy and native grounding boundary: actual helper, redaction, strict policy, lock/suspend cancellation, outbound payload tests.
3. Finish safe beta service access: per-user sessions, atomic quota/invite handling, fail-closed configuration, owner stop/spend controls, bounded proxy validation.
4. Finish setup and lifecycle: real first-run provisioning/permissions/device tests, one audio owner, recovery, accessible controls and diagnostics.
5. Build persistent sanitized journals, tutorial draft/editor/export and walkthroughs; then exact approval, native execution, verification/stop/undo and outcome integration.
6. Add opt-in persistent memory, retrieval, approved follow-ups, local offline providers/model lifecycle/network enforcement, and proactive UI with quiet defaults.
7. Certify supported combinations and Windows hardware; generate/sign an exact candidate, test clean install/update/recovery, execute the full release checklist, then owner soak and invited beta.

Live provider budget, signing identity, production service configuration and reference-machine access are external inputs needed for later qualification. They do not explain away the implementation gaps above. Most remaining work can be implemented and fixture-tested before requesting those inputs.

The present result is a tested development foundation with unfinished full-core features. It is not a completed daily-use product or a launch-ready invited beta under the agreed plan.
