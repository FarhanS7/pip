# Pip launch task tracker

Plan: [implementation plan](./LAUNCH_IMPLEMENTATION_PLAN.md). Qualification: [release checklist](./LAUNCH_RELEASE_CHECKLIST.md).

Confirmed target: full-core Windows invited beta, including tutorials, permissioned actions, persistent memory/follow-ups, privacy controls, proactive help and offline mode. macOS and public paid access follow. All tasks below start as **not started**; planning is not implementation evidence.

Status flow: `not started → implementing → checks passed → independent review → verified`. A blocked task records the specific prerequisite and which other tasks can proceed. Add commit, check output/evidence link, reviewer outcome and rollback method to each task record during execution.

Paths below are relative to `E:/PROJECTS/CLICKIFY/pip`; named new modules are proposed, not existing files. Shared files may require sequential work even where logical dependencies allow independent progress.

| ID | Milestone / task | Depends on | Main code or artifact | Completion evidence |
| --- | --- | --- | --- | --- |
| B01 | M0: baseline, support matrix, versioned plan and evidence | — | `docs/launch/`, existing Git/lockfiles | Known failures and working behaviors recorded; plan copied into repo |
| B02 | M0: lint and process-specific typechecks | B01 | package/tsconfig/ESLint; Worker types | Main rejects DOM misuse; renderer/Worker checked independently |
| B03 | M0: fixture services, test layers, CI | B01 | Vitest configs, `test/fixtures/`, `.github/workflows/` | Fresh checkout checks execute without provider secrets |
| B04 | M1: fail-closed Worker auth fix | B03 | `worker/src/index.ts` | Missing/wrong/placeholder auth makes zero upstream calls |
| B05 | M1: request validation and bounded provider proxy | B04 | `worker/src/{routes,providers,validation}/` | Body/model/token/time limits; sanitized upstream errors |
| B06 | M1: environment and protocol configuration | B04 | Worker config, `src/main/config/`, example env | Local/staging/prod isolated; packaged URL explicit |
| B07 | M2: canonical IPC schemas and event fix | B03 | shared types, channels, preload, handlers, overlay | Actual text/point payload crosses bridge correctly |
| B08 | M2: permissions/sender/navigation/CSP | B07 | windows, preload, IPC | Untrusted frame/channel denied; valid app actions work |
| B09 | M2: settings init, schema, migration, reset | B07 | `src/main/state/settings.ts`, settings UI | Restart, old/corrupt store, reset and recovery fixtures pass |
| B10 | M2: live hotkey/cursor/model settings | B09 | hotkey, panel, overlay | Registration failure preserves old chord; controls apply |
| B11 | M3: turn context and cancel semantics | B07 | orchestrator, state machine, panel | Delayed old work cannot mutate new turn; all exits clean |
| B12 | M3: single media renderer and handshake | B08,B11 | new `renderer/media/`, media window/preload | One owner independent of panel and display count |
| B13 | M3: microphone/worklet/chunk transport | B12 | media capture, main audio | Known waveform converted correctly; bounded queue; tracks released |
| B14 | M3: AssemblyAI v3 and finalization | B05,B13 | `src/main/audio/assemblyai-stt.ts` | Begin/Turn/Termination fixtures and late final words pass |
| B15 | M3: optional browser STT and typed fallback | B12 | audio adapter, panel text input | Capability detection; chosen provider honored; no fake transcript |
| B16 | M3: TTS audio transport/playback acknowledgment | B05,B12 | TTS adapters, media renderer | Real playback ack, stop/error/end cleanup; no DOM main calls |
| B17 | M3: full cancellation and resource-race suite | B11,B14,B16 | orchestrator/media integration tests | Quick release, barge-in, delayed start, crash and quit pass |
| B18 | M4: capture identity and coordinate transforms | B07 | screen capture, mapper, display registry | Mixed-DPI/negative-origin/portrait fixtures land exactly |
| B19 | M4: multi-image request and history semantics | B05,B18 | AI provider interfaces/adapters | Correct selected display images; current image attached once |
| B20 | M4: robust SSE, point parsing and stale targets | B11,B19 | AI parser, overlay, stream utility | Split UTF-8/tags, error events, stale targets and EOF pass |
| B21 | M4: provider capability catalog and certification | B14,B16,B20 | app/Worker catalog and release matrix | One live combination certified within approved spend |
| B22 | M5: native accessibility feasibility spike | B01 | proposed `native/` or `helpers/`, ADR | Compare packaging/latency/crash isolation on reference apps |
| B23 | M5: Windows helper and normalized grounding | B18,B22 | helper, `src/main/accessibility/` | Bounded traversal; timeout/crash recovery; real element bounds |
| B24 | M5: protected-field and region masking | B18,B23 | `src/main/privacy/`, capture serializer | Seeded private data absent from outgoing image and tree |
| B25 | M5: strict capture policy and disclosure | B08,B24 | onboarding, privacy/network policy | Blocked/paused capture creates no upload; no false redaction claim |
| B26 | M6: first-run and device/error UX | B09,B15,B21,B25 | panel onboarding/settings | Fresh profile can complete setup without terminal |
| B27 | M6: lifecycle/permissions/display resilience | B17,B18,B26 | main lifecycle/windows/hooks | Sleep/lock/device removal and permission revocation recover |
| B28 | M6: accessible UI and redacted diagnostics | B26 | panel/overlay design, logging/support bundle | Keyboard/scaling/reduced motion; export contains no private content |
| B29 | M7: invites and revocable sessions | B06,B08 | `worker/src/auth/`, migrations, client auth | Expiry, invite replay, rotation and revocation tests |
| B30 | M7: atomic quota and usage reservations | B05,B29 | Worker quota coordinator/storage | Concurrent calls cannot overspend reserved allowance |
| B31 | M7: spend limits, token lifetime and owner controls | B14,B30 | Worker STT/usage/admin controls | STT allocation bounded; global stop blocks new paid calls |
| B32 | M0/M8: supported dependency/native toolchain | B02,B03 | package/lockfiles, native packaging | Reviewed Electron upgrade increments and compatibility checks |
| B33 | M8: installer assets and release manifest | B06,B27,B32 | builder config, resources, release CI | Installs/runs on clean Windows without dev tools |
| B34 | M8: signing/update/data recovery | B09,B33 | protected release pipeline/updater/docs | Upgrade and interrupted-update recovery retain valid data |
| B35 | R1: sanitized event journal | B11,B24 | proposed `src/main/sessions/` | Atomic persistence; canceled/success/failed events distinguished |
| B36 | R1: automatic tutorial draft and editor | B20,B35 | tutorial service, renderer tutorial UI | Draft accurate after normal/error session end; editable |
| B37 | R1: Markdown/HTML export | B36 | local export service | Standalone file opens elsewhere; escaping and privacy tests |
| B38 | R1: multi-step walkthrough controller | B11,B23,B35 | walkthrough state and panel | Pause/resume/skip/block verified; no implicit action approval |
| B39 | R2: structured action proposal and local policy | B23,B25,B38 | new action schema/policy | Unknown/high-impact/ambiguous proposals refused |
| B40 | R2: exact approval and expiry/replay protection | B08,B39 | approval UI and store | Approval bound to target/value/turn; replay/change rejected |
| B41 | R2: native action executor and re-resolution | B23,B40 | isolated action helper | Fresh target only; race/focus checks; no arbitrary code |
| B42 | R2: postconditions, truthful undo and stop | B17,B41 | action controller/audit | Stop blocks queued steps; failed verification halts sequence |
| B43 | R2: action-to-tutorial outcome integration | B35,B42 | journal/tutorial integration | Only verified execution appears as completed step |
| B44 | R5a: local persistent memory and retention | B09,B35 | local store/index, privacy UI | Opt-in, restart, migration, expiry/delete tests |
| B45 | R5a: memory retrieval and user inspection | B20,B44 | retrieval adapter, memory UI | Source/timestamp retained; stale memory grants no authority |
| B46 | R5a: approved follow-ups | B27,B44 | local scheduler, notification UX | Timezone/restart/snooze/cancel/deduplication pass |
| B47 | R5b: offline feasibility and hardware/license ADR | B01 | spike report, model matrix | Local STT+vision+TTS measured on target machine |
| B48 | R5b: local adapters and model lifecycle | B13,B16,B20,B47 | local providers, download/settings UI | Verified downloads, corruption/low-disk/load failure recover |
| B49 | R5b: enforced offline network policy | B25,B37,B48 | network policy/local capability catalog | Whole voice-to-tutorial flow works with zero outbound attempts |
| B50 | R5c: opt-in local stuck signals and heuristics | B25,B38 | bounded local observer | No events while disabled; supported stuck/not-stuck fixtures |
| B51 | R5c: proactive UX/cooldown/snooze | B28,B50 | suggestion UI/preferences | Quiet by default; no auto capture, upload, mic or action |
| B52 | G4: full-feature Windows qualification | B28,B31,B34,B37,B38,B43,B45,B46,B49,B51 | release checklist and evidence | Exact packaged candidate passes all beta gates |
| B53 | M9: owner use and invited-beta operations | B52 | support/runbooks/beta results | Owner soak then small cohort; issues triaged per build |
| B54 | M9: beta launch decision and promotion | B53 | immutable signed artifacts, release notes | No blockers; budget/support/rollback ready; promote tested build |
| B55 | R1 optional: hosted tutorial sharing | B29,B37 | scoped storage/links/deletion | Access, revocation, expiry and deletion verified |
| B56 | R3: macOS adapters/permissions/packaging | B52 | platform helper, shell, signing | Real Mac parity; no claims from Windows tests |
| B57 | R3: macOS release qualification | B56 | Mac support matrix/evidence | Clean install, updates, media/AX/display/cancel gates |
| B58 | R4: public identity/account lifecycle | B54 | public auth/onboarding/account management | Recover/revoke/delete/export independently tested |
| B59 | R4: billing and entitlements | B30,B58 | server billing/webhooks/portal | Signed, deduplicated, ordered-state webhook handling |
| B60 | R4: public site/support/pricing/release | B59 | distribution/support materials | Price based on measured cost; public candidate qualified |
| B61 | R5d: enterprise pilot requirements | B58 | design partner scope and ACL model | One real connector/tenant contract agreed |
| B62 | R5d: enterprise pilot delivery | B61 | connector/RAG/SSO/admin/escalation | Tenant ACL/deletion/citation evidence on pilot |
| B63 | R5e: learning pilot scope | B38,B54 | curriculum and outcome rubric | One tool and defined learner outcomes |
| B64 | R5e: learning pilot delivery | B63 | lessons/quizzes/progress/recaps | 8–10 lessons tested with learners; progress migrations pass |

## First five reviewable changes

1. **B01 + bounded B02/B03 setup:** restore a trustworthy development baseline, including actual test execution. Keep runtime changes out of this setup change except those necessary to make the check meaningful.
2. **B04:** close the auth bypass with negative tests; retain health behavior.
3. **B07:** align shared IPC contracts and consumers; prove visible text and point delivery.
4. **B09/B10 in separate bounded changes:** initialize/migrate settings, then apply hotkey/cursor/provider controls with failure recovery.
5. **B11 followed by B12:** introduce turn ownership and one media owner before moving provider playback/capture.

Each numbered item may require several small commits. Do not commit unrelated tasks together merely because they appear on the same line. Subsequent order follows the dependency table; offline and accessibility feasibility should be investigated early to refine the schedule.

## Task evidence template

```text
Task ID and title:
Status:
Dependencies and evidence:
Problem / current failure:
User-visible completion criterion:
Files changed:
Behavior preserved:
Regression reproduction:
Implementation decision and tradeoffs:
Checks actually run and results:
Checks blocked or skipped, with reason:
Real hardware/provider evidence if required:
Independent review outcome:
Commit / release artifact:
Rollback / data recovery:
Remaining follow-up:
```

## Mandatory scope checks before declaring beta complete

- B52–B54 cannot complete while any required full-core feature is only a stub, hidden placeholder, mock, or document.
- Offline-mode failure requires a recorded owner scope decision or further implementation; it cannot be silently moved after launch.
- Platform/application/provider support is published from tested evidence, not from the existence of an adapter class.
- The beta may have a bounded supported action set and explicit fallback guidance; it must not claim arbitrary application/task automation.
- External purchases, messages, account changes and deployment are handled with the user's authorization at execution time; no automated release is created by this checklist.

