# Pip: implementation plan from prototype to launch

Date: 6 September 2026. Status: planning only; no implementation or deployment authorized by this document alone.

## 1. Objective and decisions

Deliver a desktop companion that an intended user can install, configure, speak to, receive useful screen-aware guidance from, interrupt, update, and uninstall reliably. Complete the broader product through separately gated releases rather than making the first usable release depend on every long-term feature.

This plan starts from the observed code in `pip/`, not from an assumption that previous task lists were implemented. Baseline: branch `dev`, latest inspected commit `24dce42`; application working tree clean. See [folder analysis](./FOLDER_ANALYSIS.md). Typecheck passed; lint configuration is missing; tests were blocked by sandbox subprocess permissions, and the outside-sandbox retry was declined. No runtime pass is claimed.

No plan can guarantee zero regressions. Here, “without breaking anything” means small reversible changes, explicit compatibility, tests at actual boundaries, retained release artifacts, and no promotion without evidence. Existing broken behavior must be corrected rather than preserved as a compatibility promise.

### Confirmed scope and remaining planning assumptions

| Decision | Confirmed choice or planning assumption | Impact if changed |
| --- | --- | --- |
| First-release features | **Confirmed: full core product vision, including permissioned actions and tutorials** | R1, R2, R5a, R5b and R5c are launch requirements, not optional follow-ups |
| Platform | **Confirmed: Windows first, macOS later** | R3 follows the Windows beta |
| Audience | **Confirmed: owner and small invited beta group** | M7 access/quotas mandatory; public paid release R4 follows beta |
| Product identity | Keep Pip internally and keep `com.pip.app` until identity is finalized | Set final name, domains, signing publisher, and app ID before external installation |
| Language | English initially | Add actual STT/TTS/AI and UX tests for every advertised language |
| Provider strategy | Preserve adapter interfaces; certify one complete provider combination first | Enable additional choices only after their own acceptance checks pass |
| Budget | Unspecified; no paid operations scheduled by this plan | Set owner-approved test spend, beta monthly ceiling, and per-user quota before live API tests |
| Supported machines | Windows x64 first; exact OS releases/hardware finalized during M0 | ARM64, macOS architectures, older OS versions each require their own package and hardware evidence |

The first three rows are the owner's explicit answers. Remaining rows are planning defaults, not purchase or deployment approvals. Full core scope is interpreted against the product spec: voice guidance, real grounding, permissioned actions, shareable tutorials, persistent memory/follow-ups, local redaction, proactive stuck detection, multi-step guidance, metered access, and optional offline operation. macOS is explicitly deferred by the owner. Enterprise and learning pilot tracks follow the shared engine, as the spec proposes. Access to signing identities, a Worker staging environment, test-provider credentials, and later a Mac are external prerequisites; prepare related work before requesting each prerequisite.

### Releases and their definition of complete

| Gate | Release | Required result |
| --- | --- | --- |
| G0 | Development baseline | Reproducible checks, captured known failures, isolated environment configuration |
| G1 | Repaired core in test environment | One deterministic microphone-to-output flow with cancellation and typed IPC |
| G2 | Owner alpha | Real Windows voice guidance, accurate coordinate mapping, privacy controls, actionable failures |
| G3 | Daily-use build | Installed app works without a terminal; settings survive restart; recovery, update/reinstall, and uninstall are tested |
| G4 | Full-core Windows invited beta | G3 plus R1/R2/R5a/R5b/R5c, per-user revocable access, enforced usage ceilings, signed release, support and recovery procedures |
| G5 | Public release | Beta exit criteria met; public access/onboarding, privacy documentation, release support and operating ownership ready; R4 required if paid |
| R1–R5 | Broader product | Tutorials; actions; macOS; paid accounts; persistent/local/proactive and track-specific features, each separately verified |

For the confirmed scope, G4 is the first external launch and depends on R1, R2, R5a, R5b and R5c. Intermediate G2/G3 builds are internal milestones, not a reduced-scope substitute for the requested beta. Windows completion does not imply macOS, enterprise/learning tracks, or paid public accounts are complete.

## 2. Preserve the project while changing it

1. Work inside the existing `pip` Git repository. Leave `INSPIRED` and `reticle-main` as references; do not replace the app or import either entire project.
2. Record a baseline commit and build/check evidence. A baseline tag is a recovery marker, not a claim that this prototype is a safe release.
3. Use short branches from the current integration branch; each change addresses one bounded concern. Avoid unrelated UI redesign, bulk renaming, dependency churn, or reformatting in a bug fix.
4. Establish the new contract or adapter next to the old code where useful. Convert all in-repository consumers in the same change. Delete obsolete code only after searches and tests show that nothing depends on it.
5. Runtime switches may disable optional capabilities. They must never restore the auth bypass, permit unvalidated IPC, or silently bypass privacy controls.
6. Keep old settings readable. Add a schema version, validate reads, back up before migration, preserve unknown fields when safe, and prove both upgrade and recovery behavior with fixtures.
7. Deploy versioned Worker changes compatible with the current and previous supported desktop client. Use additive changes first. Return a clear minimum-version response for a client that cannot safely continue.
8. Keep a release manifest containing commit, lockfile identity, toolchain, artifact hashes, configuration schema, protocol version, migration list, and test results. Roll back to a specifically verified artifact, never blindly to `HEAD~1`.
9. Every meaningful change needs an independent review before release. Follow the repository's separate-review workflow; resolve its conflicting hardcoded reviewer-model names during M0 rather than treating a model name as evidence of review quality.
10. Keep this execution plan and evidence inside the Pip repository before implementation begins so they are versioned with the code. The current `plans/` directory is outside that repository; the copy/versioning operation is M0 work.

## 3. Target architecture and contracts

Retain Electron, React, TypeScript, and the Cloudflare Worker. Avoid a framework rewrite. Keep process boundaries explicit: Electron main runs in a Node environment, while browser UI/media facilities belong in renderers. A utility/native helper may isolate blocking or crash-prone work. [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model).

| Owner | Responsibility | Must not own |
| --- | --- | --- |
| Main | App lifecycle, settings, authentication, turn controller, provider networking, display registry, validated IPC | Browser audio elements; synchronous unbounded accessibility walks |
| One media renderer | Microphone, resampling/worklet, playback, speech-synthesis fallback, completion acknowledgments | Provider secrets; one independent session per display |
| Panel renderer | Onboarding, status, settings, transcript/text input, errors, stop controls | Direct provider calls or raw Electron access |
| Overlay renderer per display | Local visual cursor, text, grounding rectangle | Microphone capture, TTS playback, authority to act on other apps |
| Accessibility helper | Bounded Windows UIAutomation / later macOS AX reads, normalized output | Unbounded OS calls on the Electron main thread |
| Worker | Auth, capability catalog, validation, quotas, upstream adapters, usage accounting, sanitized errors | Arbitrary upstream URLs or caller-controlled unlimited cost |

### Shared data model

- `TurnId`: generated when a user interaction begins; included in every asynchronous callback, transcript, chunk, point, playback command, and completion. A stale turn cannot mutate UI, history, usage state, or another turn's resources.
- `CaptureId`: identifies a specific sanitized screen snapshot and its matching accessibility snapshot. Do not apply points/actions from a stale capture after the window/display changes.
- `DisplaySnapshot`: stable display ID, desktop bounds in DIP, image width/height in pixels, timestamp, orientation, and source association. Index is presentation metadata, not identity.
- `GuidanceTarget`: display ID, capture ID, coordinate space, point, optional true element bounds, and provenance (`accessibility` or `visual`). A guessed point never becomes a claimed element rectangle.
- `Capabilities`: configured/certified AI models, STT/TTS choices, feature availability, protocol range. Validate choice on both client and Worker; catalog changes cannot enable untested features automatically.
- `AppError`: safe code, user-facing message, retryability, turn/request ID; internal logs omit raw prompts, screenshots, tokens, and transcripts by default.
- IPC uses one channel-to-request/response/event map plus runtime validation. Explicit methods only; unsubscribe functions remove the exact listeners they registered. Restrict methods by owning window/frame.

Proposed lifecycle: `idle → acquiring → listening → finalizing → thinking → responding → idle`, with `canceling → idle` and a recoverable error outcome. Keep a presentation mapping to the existing four UI labels while migrating. Only one controller changes lifecycle state; every exit invokes the same idempotent cleanup. STT finalization and TTS completion are awaited events, not inferred from a click or network completion.

## 4. Milestones and acceptance criteria

Effort ranges are rough engineering-days for one developer familiar with this code, including targeted testing. They exclude waiting for accounts, certificates, reviewers, provider outages, and beta observation. Re-estimate after M0; do not use these ranges as promised delivery dates.

### M0 — Establish a trustworthy baseline (2–4 days)

Dependencies: none. Primary files: package/lockfiles, tsconfigs, Vitest/ESLint config, build scripts, CI, existing plans.

Work:

- Inventory known working and broken user journeys; capture a baseline against both dev and packaged entry points when runnable.
- Restore ESLint with TypeScript/React support. Separate main/preload and renderer type environments so DOM-only APIs cannot hide in main code. Add Worker typechecking and generated environment types.
- Add the missing integration runner; distinguish unit, cross-module, Worker, and real desktop tests. Use a local scripted mock provider for repeatable streaming/audio/error scenarios without cloud credentials.
- Pin a reproducible Node/package-manager toolchain and lockfiles. Audit dependencies and Electron support; migrate Electron in reviewed increments with native-module checks. Do not combine its upgrade with pipeline refactoring. Select exact supported versions at implementation time.
- Correct obsolete plan instructions: GET `/health`; CI `node-version` must use the Node version, not OS; actual `.dev.vars.example` location; nonexistent native directory/build assumptions; main-versus-renderer media ownership.
- Add CI checking the app and Worker independently. Build a Windows package in CI once assets are ready; macOS checks become mandatory when that platform is in scope. Interactive OS validation remains a separate gate.

Acceptance: clean checkout setup is documented; typecheck and lint pass; existing tests actually execute; failures are tracked rather than suppressed. New regressions have failing reproductions before their fixes. If sandbox execution remains unavailable, run in an approved environment and attach evidence; never mark tests passed by inference.

### M1 — Contain the Worker risk and define environments (2–4 days)

Dependencies: M0 test harness; the minimal auth correction can precede other M0 work.

Work:

- Remove placeholder authentication exceptions; refuse protected requests when required auth configuration is missing. Keep GET health public with no secret/config detail.
- Add method/content-type/schema/body-size checks, provider/model allowlists, output/audio duration limits, request IDs, deadlines, sanitized errors, and upstream error normalization. Reject malformed JSON rather than forwarding an empty object.
- Separate local, staging, and production Worker configuration and credentials. No production upstream keys in a desktop bundle. Use HTTPS outside explicitly local development.
- Keep successful upstream responses streaming. Stop upstream work when cancellation is supported; do not assume client disconnect refunds provider charges. Never automatically replay an uncertain paid request.
- For owner alpha only, use a manually configured private credential stored with OS-backed protection. External beta must use M7 identity rather than a universal embedded app secret.
- If a live deployment exists, inspect its version/configuration safely, deploy a reviewed security fix through staging, and rotate affected credentials where exposure is established. This is a conditional operational step, not an assertion that exposure occurred.

Acceptance: missing/wrong/placeholder credentials fail; valid private credentials succeed; bad requests cannot trigger upstream calls; health stays responsive; logs contain no secrets. Rollback may restore a previous verified secure build or disable paid routes, never reintroduce the bypass.

### M2 — Repair IPC, settings, and window security (3–5 days)

Dependencies: M0.

Work:

- Consolidate `shared/types/ipc.ts`, `pip-api.d.ts`, channels, preload, handlers, and renderer subscriptions into one validated contract. Fix text and point field disagreement in the same change.
- Remove generic invoke/on/off access after migrating actual callers. Check sender/frame ownership on every handler; keep context isolation, sandboxing, and disabled Node integration.
- Restrict permission requests to necessary types and trusted windows; block unexpected navigation/new windows and unsafe external URLs. Apply CSP and serve packaged content through a tested restricted app protocol if adopted.
- Await settings initialization before rendering/registering hotkeys; add schema migration, actual reset, corrupt-store recovery, and user-visible persistence errors.
- Apply hotkey changes transactionally: validate, register new, unregister old after success, otherwise retain the old setting. Only relevant chord releases end recording.
- Apply cursor toggles, provider/model selection, initial state hydration, and listener cleanup immediately. Validate model/provider pairs against capabilities.

Acceptance: real producer-to-renderer events display correct text/point data; a rejected sender cannot call a privileged method; setting changes survive restart and revert cleanly on failure; repeated renderer mounts do not multiply events. Electron recommends validating IPC senders and exposing narrowly scoped APIs. [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).

### M3 — Build the turn controller and one media owner (5–8 days)

Dependencies: M1 and M2.

Work:

- Introduce the turn context, AbortController, deadlines, resource ownership, and state transitions described above. Make reset/cancel/quit converge on cleanup.
- Create one media renderer with a ready handshake; keep it alive independently of panel blur and monitor changes. It acquires a microphone only for an intentional recording and releases tracks afterward.
- Capture and resample microphone audio to the provider's documented format; send bounded chunks with sequence/turn IDs and explicit backpressure. Bound startup buffering; abort on overflow instead of silently losing speech.
- Implement AssemblyAI v3 events, turn accumulation, endpoint/final transcript handling, bounded finalization, and graceful termination. Current code expects older PartialTranscript/FinalTranscript and `text`; v3 uses Turn and `transcript`. [AssemblyAI migration guide](https://www.assemblyai.com/docs/streaming/guides/v2_to_v3_migration_js).
- Make Web Speech a capability-detected optional adapter, with its actual networking/offline limitations disclosed. If unavailable, provide typed input and a clear STT selection path rather than calling an empty utterance successful.
- Change TTS adapters to produce audio/stream data; send it only to the media renderer. Wait for started/ended/failed/stopped acknowledgments; bound audio queues and revoke buffers/URLs on every exit.
- Browser speech fallback uses the same owner/acknowledgment protocol. Interruption stops queued and active speech, AI streaming, recording, and STT resources belonging to that turn.
- Split panel actions into start, finish recording, cancel thinking, and stop speaking. Hotkey barge-in cancels the old turn before beginning a new one.

Acceptance: an actual or fixture audio input produces a transcript, one response, and audible playback; final words are retained; no microphone activity after cancel; no duplicate playback on multiple displays; stale callbacks cannot change a new turn. Verify release-before-session-ready, rapid repeated hotkeys, media-renderer crash, silence, device removal, and quit during every state.

### M4 — Make AI guidance and pointing correct (4–7 days)

Dependencies: M3 for end-to-end acceptance; screen mapping tests can start after M2.

Work:

- Carry every chosen display's image and metadata through a provider-neutral request. Default capture to the chosen window/display; ask users to opt into broader capture. Correctly identify the primary display rather than assuming array index zero.
- Compute image pixel → display DIP → target-overlay local coordinates using explicit dimensions. Test negative origins, mixed DPI, portrait screens, fractional scaling, removed displays, and metric changes.
- Attach current screenshots only to the current user message. Keep bounded conversation history; only persist a completed, accepted response and its intended user query.
- Implement a shared robust SSE parser: fragmented UTF-8/data, multi-line events, provider errors, EOF, cancellation, and response-size limits. Prevent raw POINT tags from leaking to speech and handle split tags in visual output.
- Validate targets, reject non-finite/out-of-bounds coordinates, and invalidate stale capture IDs. Render a visual point marker without invented element bounds when grounding is absent.
- Normalize provider request fields, authentication, stream events, and TTS payloads against each provider's current official docs. Verify actual configured model access; do not guess model identifiers or silently hop through unrelated models.
- Certify one AI+STT+TTS combination first. Preserve other adapters but hide/disable unverified choices with a clear reason. Maintain a capability and certification table per release.

Acceptance: deterministic fixtures land exactly at known coordinates; live smoke guidance lands inside target bounds for the supported fixture set; a secondary-screen request receives that screen's image and only its overlay moves; cancellation leaves no trailing text/audio; unavailable providers fail clearly without fake success.

### M5 — Add real grounding and privacy controls (5–10 days)

Dependencies: M4. Native helper feasibility spike should start after M0 to expose platform risk early.

Work:

- Implement a Windows UIAutomation helper behind a narrow normalized adapter. Prefer an isolated helper process with bounded traversal, node/depth/time limits, cancellation, and crash restart; decide C++/N-API versus a separate packaged helper after a short build/latency spike.
- Normalize role, safe accessible name, stable-enough target identity, bounds, protected-field status, and owning process/window. Exclude password values and unrelated background windows. Use verified element bounds when available.
- Handle incomplete/canvas/inaccessible apps with explicit visual guidance fallback. Never treat an absent tree as permission to infer safe automation. Grounded pointing refreshes after scroll/window movement or expires.
- Add capture/transcription disclosure, obvious active recording state, capture target selection, pause, session clear, and a stop control accessible while overlays are click-through.
- Add on-device masking for known protected UI fields and user-defined regions to both images and serialized trees; ensure transforms match screenshot scaling. No raw screenshot/transcript logging; default to no raw session persistence.
- Add strict capture mode: if required protection cannot be established, block upload and offer text-only input. General-purpose automatic PII detection is imperfect; do not market basic masking as complete redaction.
- Keep screen text and retrieved material as untrusted input in prompts. Future action execution must enforce safety locally, not depend on model obedience.

Acceptance: seeded protected fields and masks do not appear in captured outgoing request bytes; blocked capture performs no upload; helper failure does not freeze the app; true bounds track supported app targets; unsupported apps are clearly identified. Test at least browser forms, File Explorer, VS Code, a native settings window, and one canvas/custom-rendered application; expand the declared support matrix only with evidence.

### M6 — Make the application usable without developer assistance (3–6 days)

Dependencies: M3–M5.

Work:

- Provide first-run setup: explain capture/audio, request necessary OS permissions, configure endpoint/access, test microphone/speaker/provider, and confirm a working interaction. Show exact recovery steps for denied permissions.
- Add typed input, readable transcript/history for the current session, selectable input/output devices, mute, provider availability, retry only where safe, and visible offline/quota states.
- Make panel controls keyboard accessible, labeled, readable at scaling/high contrast, and compatible with reduced motion. Make tray actions include open, pause, stop, settings, diagnostics, and quit.
- Handle lock/unlock, sleep/resume, network loss, display attachment, default-device changes, and permission revocation. Stop private capture on lock; do not automatically resume microphone capture.
- Correct startup ordering, second-instance behavior, window lifecycle, overlay positioning and display-metric updates. Ensure clean shutdown closes providers, media resources, native helpers, listeners, and hooks.
- Add a redacted support bundle with app/protocol/OS version and timings; let the user inspect it before sharing. Avoid telemetry that captures screen contents.

Acceptance: a new tester installs/configures/uses the app from written instructions without a shell; denial paths recover; pause/stop/quit work from every state; settings and capture preference survive restart. G2 is reached only after a real paid-provider path passes within an approved test budget.

### M7 — Invited-user access and cost controls (4–8 days)

Dependencies: M1; integrate with M6. Mandatory before distributing access to a shared paid backend.

Work:

- Implement owner-issued single-use invites and revocable per-user/device sessions. A reasonable beta design is a random invite exchange, short-lived access token, rotated refresh token, hashed refresh/invite records, expiry, and revocation. Do not build passwords for an invite-only beta.
- Store client tokens using OS-backed protection, never ordinary settings JSON or renderer state. Encryption at rest does not protect against all applications running as the same Windows user. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).
- Keep users, invites, device/session records and usage metadata in versioned server storage. Use a serialized quota coordinator or equivalent atomic storage operations for admission; do not check-then-increment across concurrent requests without a transaction.
- Apply per-user concurrency, STT lifetime/token issuance limits, per-turn maximum input/output, and daily/monthly ceilings. Reserve worst-case usage before a billable call; reconcile actual usage and conservative estimates after success/error/disconnect.
- Avoid automatic duplicate paid work with request IDs, replay protection, and explicit uncertain-outcome behavior. Include STT's direct upstream session lifetime in the cost model; a token cannot be made harmless merely by closing the desktop UI.
- Use edge rate limiting for bursts, not billing correctness. Cloudflare explicitly describes its binding as permissive/eventually consistent rather than an accurate accounting system. [Rate-limit accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
- Add minimal owner operations for invite/revoke/quota/spend status, a backend kill switch, usage warnings, provider alerts, and documented support actions. A full admin dashboard is not necessary for beta.

Acceptance: different users cannot see or spend each other's allocations; expired/revoked/replayed credentials fail; parallel admission never exceeds the configured reservation budget; retries do not create duplicate chargeable jobs; quota messages are actionable; a global stop blocks new paid work. Owner-only deployments may omit invite UI but still need explicit spend caps and secure access.

### M8 — Packaging, updates, and release qualification (4–7 days)

Dependencies: M6 and M7 for beta; M6 plus secure private configuration for personal use.

Work:

- Supply final icons/publisher metadata, correct build output inclusion, native module/helper packaging, production endpoints, and release-channel configuration. Ensure packaging always builds current source first.
- Pin app identity before signing. Produce Windows signed installer artifacts; validate native binaries and permissions on a clean machine without Node/build tools. Confirm required signing resources before promising frictionless distribution.
- Produce versioned manifests/checksums and install/upgrade/uninstall instructions. Test settings retention, backup recovery, and uninstall data choices. Do not uninstall user data silently.
- For initial owner builds, a documented manual verified reinstall path suffices. For public launch, provide signed update delivery or a dependable in-app notification/manual flow with tested recovery. Updates must not interrupt active recording or actions.
- If auto-update is implemented, stage channels, verify artifact origin/integrity, preserve last-good artifacts, handle interrupted downloads, and use an upward-version corrective release when downgrade mechanics cannot safely recover settings.
- CI builds unsigned verification artifacts on PRs and signs only protected release jobs. Separate signing/provider secrets and avoid exposing them to untrusted PRs.

Acceptance: clean install, first run, completed interaction, restart, upgrade, recovery, and uninstall pass on every advertised platform/architecture. G3 requires a real installed build. Repeat M8 qualification after the full-core feature phases land; G4 also requires R1/R2/R5a/R5b/R5c, identity/quotas and beta operating readiness. A dev-window smoke test is insufficient.

### M9 — Beta operation and launch (2–4 engineering-days plus 1–2 weeks observation)

Dependencies: final M8 qualification, M7, R1, R2, R5a, R5b and R5c for the confirmed first-release scope.

Work:

- Owner uses the packaged build before expanding to approximately 5–10 invited testers. Increase access only after stable evidence; keep one release candidate fixed long enough to measure it.
- Provide support contact, known limitations, installation instructions, capture/provider data-flow explanation, retention/deletion choices, and an incident procedure. Any privacy/legal review depends on actual distribution/jurisdiction and is not certified by this plan.
- Track content-free completion/error/cancellation/latency and estimated provider spend; request consent for optional analytics and separate diagnostic uploads. Record denominator and build version for every rate.
- Run the release checklist. Promote the exact tested artifact, not a rebuild with different dependencies. Deploy a compatible secure Worker before clients that require it; exercise a staging rollback before production.
- Set an owner for support, dependency/security updates, budgets, credential rotation, and incident response. Publish public access only when onboarding, usage enforcement, and support capacity match the selected audience.

Acceptance: meet the release gates in the companion checklist. Zero unresolved critical/high release blockers; no credential/privacy/cross-user findings; verified rollback; reproducible success on supported machines. Public paid launch additionally requires R4.

## 5. Full product completion built on the stable core

For the confirmed scope, R1, R2, R5a, R5b and R5c must land before the Windows invited beta. R3 (macOS), R4 (paid public product), R5d and R5e (market tracks) follow it. Implement in dependency order; avoid adding click/typing authority to an unstable capture/cancel pipeline.

| Phase | Work packages | Dependencies and acceptance | Rough effort |
| --- | --- | --- | --- |
| R1: tutorial artifacts | Local session event schema; redacted text/step capture; automatic draft from completed session; step editor; Markdown/HTML export; explicit save/share; optional hosted link with access/revocation/deletion | M5 privacy + M6 session UX; export reflects actual observed steps, labels suggestions and cancellations accurately, excludes masked data, survives interrupted save; hosted sharing requires M7 access/storage controls | 5–9 days local; 3–6 more hosted |
| R2: permissioned actions | Start with an allowlisted application and reversible click/fill actions; typed action proposal; exact target/value preview; per-step approval; target re-resolution before execution; execution service separated from AI; verification, stop/timeout and truthful undo support | M3 cancellation + M5 fresh grounding; instructions on screen cannot authorize actions; changed focus/bounds/content invalidates approval; no blind pixel clicks, arbitrary shell, payment/send/delete/install action in initial scope; every executed action has approval and observed outcome | 10–20 days |
| R3: macOS | Port the accessibility adapter; microphone/screen/AX onboarding; hotkey/native packaging; display coordinate verification; signing/notarization, Keychain, architecture-specific builds, updater testing | M0–M8 contracts; real Mac hardware and signing resources; all launch tests pass independently on advertised macOS/CPU versions; Apple Silicon first unless Intel is required | 8–15 days |
| R4: public paid product | Final auth/account recovery design; public onboarding; plan entitlements; checkout/customer portal; verified payment webhooks; idempotency and replay protection; subscription state transitions; billing support; account deletion/export; public download/support site | M7 quotas + M9 beta evidence; server verifies entitlement independently of client or checkout redirect; test renew/cancel/past-due/refund/duplicate and out-of-order events; pricing based on measured costs with contingency | 8–15 days |
| R5a: persistent memory | Opt-in local versioned session storage, encryption strategy, retention, inspect/edit/delete, retrieval with source timestamps, export; decide cloud sync separately | R1 schema + privacy controls; deletion/recovery/migration tested; no cross-user leakage or silent persistent screen recording | 5–10 days |
| R5b: offline mode | Local model/STT/TTS capability spike, hardware/download/license matrix, installation UX, progress/storage budgeting, explicit quality/latency modes | Stable provider interfaces; clean-network-block test proves the whole selected mode makes no external calls; Web Speech alone is not an offline guarantee | 10–20 days after feasibility |
| R5c: proactive guidance | Explicit opt-in, narrowly scoped activity signals, local stuck heuristics, rate limits, snooze, never automatic action execution | Stable baseline + memory choices; default quiet, measurable false-positive rate, no continuous capture/upload introduced implicitly | 5–10 days |
| R5d: enterprise track | One design-partner doc connector, ingestion/deletion, permission-aware retrieval, citations, SSO/teams, scoped admin reports, explicit human escalation | Distribution decision + R4 identity; adversarial tenant/document ACL tests before pilot; revoked documents disappear from retrieval | 15–30 days for one pilot scope |
| R5e: learning track | One tool's curriculum, 8–10 lessons, guided steps, quizzes, progress and evidence-based completion; optional certificates/recaps | Distribution decision + core/R1; test actual learner outcomes; progress survives updates; certificate only for defined completion | 10–20 days for one tool |

Choose enterprise or learning first using real access to customers, as the product spec proposes. Supporting both eventually does not require building both before first launch. Hosted tutorials, subscriptions, and enterprise integrations add separate security and data responsibilities; they must not inherit a blanket “tested” status from core voice tests.

### R1 detailed launch contract — tutorials and guided walkthroughs

1. Define a local, versioned session event journal: user goal, sanitized observation reference, proposed guidance, approved action, observed result, correction, and timestamp. Persist atomically; do not retain raw microphone audio by default.
2. Generate a tutorial draft automatically when a session ends. Include a useful deterministic export even if AI summarization fails; tutorial generation failure must not corrupt the session or block shutdown.
3. Distinguish what the user or app actually completed from suggestions and uncertain observations. Never present an unverified action as accomplished. Attach sanitized screenshots only with the user's capture/save choice.
4. Add edit, reorder, remove, preview, local save and Markdown/standalone HTML export. Escape untrusted text and sanitize imported/rendered content. Sharing is an explicit user action; exported files include their assets and work on a second machine.
5. Add guided walkthrough execution with step state (`pending`, `active`, `verified`, `skipped`, `blocked`), pause/resume, clarification, and manual completion where observation is insufficient. A spoken “next” is navigation, not authorization for a proposed action.
6. Add hosted links only if needed for beta distribution; otherwise local shareable files satisfy the first beta. Hosted links require scoped access, expiry, revocation, deletion, and a reviewed retention policy before enabling them.

Gate: session with successful, canceled, and failed steps exports an accurate editable tutorial; private fields remain absent; an interrupted write recovers; malicious screen text cannot become executable HTML; reopening a saved walkthrough preserves its steps and labels without silently executing anything.

### R2 detailed launch contract — permissioned actions

1. Scope beta actions to verified target applications and reversible operations: focus, select, click controls, scroll, and fill non-sensitive fields. List exact supported apps/controls in the release matrix. Unsupported requests become guidance, not improvised execution.
2. The model proposes structured intent only. A local policy engine validates application/window/element identity, current observation, action type, field type and limits. No model-provided executable code or arbitrary shell commands.
3. Present a concrete approval containing application, target, operation, and intended value. Bind approval to a short-lived proposal digest and capture/element identity. Never log sensitive typed values; protected fields are outside the initial action allowlist.
4. Re-resolve and verify the target immediately before execution. Changed focus, ambiguous identity, stale capture, or a different proposed value requires a new preview. Implement a race check as close as possible to the native operation.
5. Execute one approved step at a time. Verify its postcondition and stop on ambiguity; do not advance solely because the OS input call returned successfully. Checkpoints precede consequential form submissions.
6. Provide an always-available emergency stop independent of the model. It prevents remaining queued actions and terminates the active sequence where interruptible. It cannot recall an operation the OS already completed; report that clearly.
7. Offer undo only for operations whose prior state is safely captured and whose reversal is verified. Sending, purchases, deletion, installation, credential entry, and other irreversible/high-impact operations remain manual in this beta; never imply blanket permission covers them.
8. Store a sanitized local approval/result trail, including failed and canceled operations, for tutorial accuracy and user review. Permission state is never recovered from memory, retrieved docs, screen content, or a previous session by inference.

Gate: adversarial screen instructions cannot authorize execution; expired/replayed approvals fail; target-switch race tests halt; every executed action has a matching approved proposal and outcome; stop prevents subsequent steps; a failed step cannot be retried silently. Run at least 50 deterministic action scenarios spanning success, refusal, target changes, and cancellation, plus real supported-app trials.

### R5a detailed launch contract — persistent memory and follow-ups

Implement opt-in local storage of sanitized goals, outcomes, tutorial references and summaries; expose inspect/edit/delete and retention settings. Store a schema version and migration backups. Retrieval includes timestamps and source session IDs; stale memory cannot override fresh observations or authorize actions. User-approved follow-ups store due time/timezone, support snooze/cancel, remain quiet after completion, and survive restart with deduplication. No proactive upload of historical screenshots.

Gate: restart retains only opted-in material; turning off retention and deletion removes the intended records and derived indexes; recovery does not resurrect deleted data unexpectedly; follow-ups fire once at the intended local time; memory never crosses user profiles. Encrypt sensitive local records using a documented key strategy and record the limits of same-user OS protection.

### R5b detailed launch contract — optional offline operation

Start a feasibility spike during M0 for local STT, a vision-capable local model, and local TTS on the intended Windows hardware. Select actual model packages and redistribution licenses only after measuring RAM, disk, startup time, latency and quality. Keep the provider-neutral contracts; add explicit local model download/verification/removal UX and visible disk requirements.

Offline mode must disable every external provider, telemetry, update check, remote tutorial summarizer, and cloud retrieval for the session. Implement a policy boundary enforced in the networking layer, not only a dropdown. Local export, memory, grounding, and approved supported actions must continue to work. Hosted sharing and cloud account refresh may wait until online; their unavailable state must be explicit. For beta, local inference need not depend on a cloud session refresh.

Gate: first-time model installation is documented as requiring a download; after installation, a full voice/screen/guidance/tutorial interaction with blocked internet and network auditing succeeds without any outbound attempt. Test cancel, device loss, insufficient memory/disk, corrupted model and failed model load. If the hardware/model combination cannot meet the declared minimum, the full-core launch gate stays open until the owner explicitly changes scope; do not relabel Web Speech as offline.

### R5c detailed launch contract — proactive stuck detection

Default this feature off. Let users opt into specific applications and explain the local signals used. Begin with bounded local indicators such as repeated failed walkthrough postconditions or repeated interaction at the same supported target; avoid general keystroke logging or continuous full-screen capture. Add cooldown, per-session prompt limit, confidence threshold, snooze and permanent disable.

Offer help with a small nonintrusive prompt. Do not begin microphone capture, screen upload or actions until the relevant explicit user interaction/consent. Respect lock, presentations/full-screen applications and pause settings. Distinguish scheduled user-approved follow-ups from heuristic stuck suggestions.

Gate: opt-out produces no monitoring events; pause/snooze suppress suggestions; no duplicate prompt loop; false positives are measured with testers; suggested help never starts an action or cloud capture automatically. Include at least 20 scripted stuck/not-stuck sequences and a tester feedback review before enabling in beta.

## 6. Verification strategy

### What existing tests should keep protecting

Keep and improve tests for coordinate mapping, response parsing, conversation bounds, power levels, settings, state transitions, screen matching and hotkeys. Avoid replacing them with snapshots that simply bless the new implementation. Fix expected values only when the previous expected behavior was wrong and record why.

### New tests that matter

| Layer | Required evidence |
| --- | --- |
| Pure unit | Coordinate spaces/scaling; protocol/tag parser chunk boundaries; settings migration and validation; legal/illegal lifecycle transitions; exact hotkey matching |
| Contract/integration | Actual sender → preload → renderer payloads; ready handshake; ownership; TTS acknowledgments; STT finalization; cancel/late-event races; helper restart |
| Worker | Auth failure paths with no upstream call; schema/limit enforcement; provider error mapping; concurrent quota admission; token expiry/replay/revocation; canceled/uncertain usage reconciliation |
| Desktop automated | Launch packaged app; panel/overlay state; fixture microphone/audio path; mock network faults; renderer crash; safe close/restart; no production credentials |
| Real hardware/manual | Microphone and audible output; global hook; OS permissions; mixed monitors/DPI; sleep/lock/device changes; install/update; real provider certification |
| Security/privacy | Untrusted frame and IPC payload; secret-free package/logs; protected/masked field absent from outgoing bytes; capture-disabled network assertion; cross-user access tests |

Reticle is optional tooling for Pip's own instrumented UI; first demonstrate one useful test with supported Electron integration before adopting it. Do not modify or vendor the Reticle monorepo. It is not a replacement for native OS permission, microphone, or accessibility testing. A standard Electron-compatible driver plus deterministic fixture services is the baseline fallback.

### Proposed measurable launch thresholds

These are acceptance targets to calibrate in M0/M3, not measured performance claims. Any revision requires recorded rationale before release qualification.

- Deterministic supported-flow suite: 100% pass; each skipped test has a named reason and cannot cover a required launch feature.
- Real core loop: at least 100 recorded representative interactions across the supported test matrix; at least 95% end-to-end completion excluding explicitly labeled upstream outage cases. Report failures both with and without exclusions; inspect systematic failures even if the aggregate target passes.
- Cancellation: visible stop response within 250 ms target; owned capture/playback released within 1 second target on reference hardware; no stale turn effects in fault tests. Upstream billing cancellation may differ and must be accounted for.
- Latency: hotkey release to first visible response p95 below 8 seconds and first audible response p95 below 12 seconds on the agreed network/provider/hardware baseline. Measure STT, capture, AI, and TTS separately. Optimize only after correctness.
- Soak: 100 sequential turns, 20 rapid cancel/restart cases, repeated monitor/device changes, and a one-hour idle period without leaked sessions/listeners or unbounded memory growth. Establish a measured RAM/CPU baseline before assigning numeric resource limits.
- Pointing: exact fixture transforms; all supported deterministic element targets receive a point inside their bounds. Track AI visual accuracy separately from coordinate correctness.
- Safety: zero known auth bypasses, cross-user data/usage access, secret artifacts, masked-field upload failures, or unapproved action executions. Security/privacy failures stop release regardless of aggregate success rate.
- User setup: at least three fresh-machine/user-profile walkthroughs with no developer shell commands.

## 7. Release, rollback, and operations

| Change | Rollout | Recovery |
| --- | --- | --- |
| Worker bug fix | Local tests → isolated staging → current/previous client contract tests → production | Restore a retained verified secure deployment; disable affected paid route if no safe rollback exists |
| Client/provider capability | Fixtures → one certified provider/device → owner → beta | Disable broken optional choice; retain usable text/fallback path only if genuinely certified |
| Settings migration | Back up and test old fixtures before new writes | Restore backup with compatible app; never downgrade into an unreadable schema |
| Desktop update | Signed candidate → clean install/upgrade → small channel → broad channel | Stop promotion and offer a verified corrective release/manual reinstall with data recovery |
| Server schema | Additive migration → compatible application → backfill → later cleanup | Keep old fields/readers through compatibility window; restore from tested backup when required |
| Actions/tutorial sharing | Off until specific phase gate passes | Disable new actions/shares; preserve owned local data and revocation/deletion paths |

Operational runbook must cover: provider outage; unexpected spend; leaked credential; screen/privacy incident; bad update; lost settings; inaccessible native helper; quota bug; and worker/client protocol mismatch. Include trigger, owner, immediate containment, recovery verification, user communication draft, and follow-up test. Secrets belong in environment-specific Worker secret storage. [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## 8. Sequencing, effort, and readiness blockers

Critical path: `M0 → M1/M2 → M3 → M4 → M5 → M6 → R1/R2/R5a/R5b/R5c → final M8 → M9`. M7 can develop after M1 but must finish before external shared-backend beta. M8 can produce an internal G3 installer before all feature phases land, then must repeat qualification on the feature-complete candidate. Native grounding and offline feasibility spikes begin during M0. This indicates dependency independence, not an instruction to spawn agents or create tasks automatically.

The repaired core is approximately 34–63 engineering-days. The confirmed full-core Windows beta adds R1, R2, R5a, R5b and R5c: approximately 69–132 engineering-days total, plus beta observation and optional hosted sharing. A reasonable initial solo-developer planning envelope is roughly 16–30 calendar weeks, not a promised date; re-estimate after baseline, native grounding and offline spikes. Public paid launch adds R4, and macOS adds R3. External dependencies and a harder-than-expected offline model integration can extend these ranges.

Current blockers to resolve at their relevant gate:

- Test execution environment: prior outside-sandbox run was declined; arrange an approved local/CI run rather than circumvent that decision.
- Provider credentials/access and explicit spend cap: needed only for real provider certification, not mocks or code repair.
- Final supported OS/CPU/provider/language matrix: freeze before release qualification.
- Staging/prod resources and a revocable identity approach: required before beta backend use.
- Windows signing and final app identity; Mac hardware/signing if macOS is selected.
- Public audience/business scope: determines whether public accounts, payments, hosted sharing, and policy review block G5.

## 9. How to execute each task

Use the IDs and checklist in [launch task tracker](./LAUNCH_TASK_TRACKER.md). For each task record: dependency readiness; exact problem; files affected; behavior to preserve; regression reproduction; implementation; check results; independent review; commit; recovery method. “Implemented” and “verified” are different states.

Before a change is complete, demonstrate the intended user outcome and the adjacent failure/cancel path. Do not declare a milestone done because source files exist, mocks pass, or an AI review says so. Any action involving real provider calls, publication, purchases, or external account changes must follow the authorization available at execution time; this plan itself schedules none of them.

First implementation batch: baseline/CI repair (B01–B03), Worker bypass fix (B04), then shared IPC contract (B07). Verify this foundation before introducing new product features.

