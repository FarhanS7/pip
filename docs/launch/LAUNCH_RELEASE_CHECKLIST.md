# Pip full-core Windows beta: release qualification

This checklist is an execution gate, not evidence that checks have passed. All entries are unchecked at creation. Use the [implementation plan](./LAUNCH_IMPLEMENTATION_PLAN.md) and [task tracker](./LAUNCH_TASK_TRACKER.md).

## Candidate identity

Record exact app version/commit/artifact hash, Worker deployment ID, protocol version, settings/storage schema versions, dependency lockfile hash, signing identity, release channel, enabled capabilities, local model versions, tested Windows builds/architectures, devices, display topology, and tested provider/model IDs.

Current candidate: **none**. Release decision: **not ready; implementation pending**.

## Entry requirements

- [ ] All required tasks through B52 have verified evidence and independent review.
- [ ] Full-core features R1, R2, R5a, R5b and R5c are implemented and qualified; no silent scope reduction.
- [ ] Required checks run in an approved environment; prior sandbox blockage is resolved with actual evidence.
- [ ] No critical/high defects, credential exposure, unapproved action, privacy failure, or cross-user failure remain.
- [ ] Supported OS/hardware/apps/providers/languages are explicit, and unavailable choices are not marketed as working.
- [ ] Production secrets are absent from source, logs, fixtures and desktop artifacts.
- [ ] Staging and production identities/storage/budgets are isolated.

## Test matrix and user outcomes

Record PASS/FAIL/BLOCKED, artifact identity, machine identity, timestamp, tester, and evidence for each row. A required BLOCKED row prevents release.

| ID | Scenario | Required outcome |
| --- | --- | --- |
| Q01 | Fresh install on clean Windows profile | Signed installer succeeds; no Node/terminal required; correct publisher/icons |
| Q02 | First run with permissions denied | Explains microphone/screen/grounding requirements; recovers after permission change |
| Q03 | Normal voice interaction | Final transcript retained, correct screen used, response visible, speech audible once |
| Q04 | Multiple displays | Only target overlay moves; one microphone and one speaker owner |
| Q05 | Mixed DPI, portrait, negative display origin | Known points and true bounds map correctly in every configuration |
| Q06 | Very quick press/release during STT startup | No orphan session or accidental default query; clear outcome |
| Q07 | Cancel during capture, finalization, AI and TTS | Capture/playback stops; no stale turn modifies UI/history |
| Q08 | New hotkey during response | Old turn ends; new transcript/audio belongs only to new turn |
| Q09 | Unrelated key release | Does not prematurely end push-to-talk |
| Q10 | Change hotkey/settings; conflict and restart | New valid choice works; conflict preserves old choice; persistence and reset work |
| Q11 | Network timeout/drop, malformed/partial SSE, 429/5xx | Bounded wait, safe error, no invented answer or duplicate paid retry |
| Q12 | Provider unavailable/unconfigured | Selector accurately reports availability; supported fallback/text path works |
| Q13 | Microphone/speaker removed or changed | Recovers without stale tracks, dead loop, or speech on unintended device |
| Q14 | Sleep/lock/resume | No capture while locked; no automatic microphone restart; state recovers |
| Q15 | Display removed/resized during pointing | Target expires or remaps from valid fresh observation; no off-screen stuck overlay |
| Q16 | Accessibility helper or renderer crashes | App remains responsive; resources end; safe bounded restart possible |
| Q17 | Sensitive/protected fields and region masks | Seeded content absent from outgoing image/tree/logs/tutorial |
| Q18 | Strict privacy / paused / excluded app | No prohibited capture/upload; explicit text-only alternative |
| Q19 | Hostile renderer/frame/IPC payload/navigation | Privileged methods rejected; valid application paths unaffected |
| Q20 | Missing/placeholder/wrong/expired/revoked auth | No billable upstream call; correct user-facing access error |
| Q21 | Concurrent requests near quota | Atomic admission respects reservations; no cross-user spend leakage |
| Q22 | STT token issuance/usage and disconnected client | Session allocation/lifetime bounded; uncertain cost reconciled conservatively |
| Q23 | Supported approved action | Exact intended target/value shown; fresh target used; postcondition verified |
| Q24 | Target/focus/value changes after approval | Execution halted; fresh preview required; no automatic replay |
| Q25 | Screen prompt injection / ambiguous action | No unauthorized authority gained; unsupported/high-impact steps remain manual |
| Q26 | Emergency stop during sequence | No subsequent step executes; completed step reported truthfully |
| Q27 | Undo supported and unsupported operations | Only verified reversals offered; no false guarantee |
| Q28 | Multi-step walkthrough pause/restart/skip | Step state accurate; resume never grants action permission |
| Q29 | Tutorial after success/failure/cancel | Automatically generated draft distinguishes actual versus proposed steps |
| Q30 | Tutorial edit/export on second machine | Standalone HTML/Markdown accurate and sanitized; untrusted text not executable |
| Q31 | Interrupted tutorial/session save | Prior valid data recoverable; no corrupt or invented step record |
| Q32 | Memory opt-in, restart, inspect/edit/delete | Only selected sanitized data retained; deletion includes derived retrieval state |
| Q33 | Follow-up timezone/snooze/cancel/restart | Correct time, once only; no notification after cancel/completion |
| Q34 | Proactive help off, paused, false-positive scenarios | No monitoring while disabled; cooldown/snooze respected; no auto upload/action |
| Q35 | Offline full interaction after model install | Voice+screen+guidance+local tutorial works; zero outbound attempts, including telemetry/update |
| Q36 | Offline model corrupt/missing/low-memory/low-disk | Clear recovery, cancel works; no silent cloud fallback |
| Q37 | Old/corrupt settings and session schema | Valid migration or recoverable backup; no silent destructive reset |
| Q38 | Upgrade/failed update/manual recovery | Verified app returns to working state with compatible user data |
| Q39 | Quit during every active stage | No lingering mic, audio, helper, hook, upload, or child process |
| Q40 | Soak and repeated start/cancel/device changes | No unbounded memory/listener/session growth; timing/resource evidence retained |
| Q41 | Redacted diagnostics and optional analytics | No prompts/screenshots/tokens by default; user can inspect export |
| Q42 | Account revoke and beta removal | New paid requests refused; clear sign-in/access state; owned local data remains manageable |
| Q43 | Uninstall and reinstall | Explicit data-retention choice; clean reinstall; no stuck startup/helper registration |

If hosted tutorial sharing is enabled, add access-control, expiry, revocation, deletion, malicious-content and storage-quota checks. If payments are enabled, add signed webhook, duplicate/out-of-order event, cancellation, renewal, refund and entitlement checks. Mac qualification repeats the applicable matrix on real Mac hardware.

## Performance and outcome evidence

- [ ] 100% deterministic required-flow pass rate with no hidden required skips.
- [ ] At least 100 representative real interactions; completion rate and all failures reported per build/device/provider.
- [ ] Proposed 95% completion target met; systematic failure modes investigated even when aggregate passes.
- [ ] p95 first-visible and first-audible response measured against declared network/hardware/provider conditions.
- [ ] Proposed cancellation response/resource cleanup targets met, with upstream billing limitations documented.
- [ ] At least 50 deterministic action scenarios plus supported-app hardware trials; zero unapproved or misbound execution.
- [ ] Proactive-help fixtures and tester false-positive review complete.
- [ ] One-hour idle, 100 sequential turns and 20 rapid cancellation cycles show bounded resources.
- [ ] At least three fresh-machine/profile onboarding trials succeed without developer assistance.
- [ ] Offline-mode hardware/quality/latency/disk results published; no unsupported broad compatibility claim.

## Operations and distribution

- [ ] Final product name/app ID/publisher set before external installations.
- [ ] Provider test spend, beta total ceiling and per-user limits explicitly selected and enforced.
- [ ] Invites/session revocation/usage status/global paid-route stop tested by the owner.
- [ ] Provider outage and unexpected-spend alerts route to an identified operator.
- [ ] Setup guide, supported capabilities, known limitations and support contact ready.
- [ ] Data-flow/privacy explanation matches actual capture, storage, AI/STT/TTS, memory and tutorial behavior.
- [ ] Recording, proactive monitoring, memory retention, diagnostics and hosted sharing choices are independently understandable.
- [ ] Retained verified artifacts and data backups available; recovery exercised in staging.
- [ ] Current and previous supported desktop versions work with the candidate Worker or receive a safe minimum-version response.
- [ ] Distribution uses the exact tested signed artifact and records its hash.

## Rollout order

1. Owner uses the installed candidate and completes the full matrix where applicable.
2. Invite approximately 5–10 testers with individually revocable access and explicit limits.
3. Observe for 1–2 weeks, triage reports, and retest the affected matrix after fixes. A changed candidate gets new evidence; prior passes do not automatically apply to changed behavior.
4. Stop expansion for privacy/security incidents, unexpected spend, wrong-target actions, broken updates, or systematic core-loop failures.
5. Promote only after the owner accepts the concrete release evidence and distribution is authorized. This document does not publish anything.

## Recovery drill

- [ ] Identify the exact last verified secure Worker and desktop artifacts; the original prototype is not presumed safe.
- [ ] Disable an affected capability/paid route while preserving safe local user access and data.
- [ ] Restore compatible secure Worker behavior and verify auth, quotas, health and one real/mock interaction as appropriate.
- [ ] Stop client update promotion; deliver verified corrective release or documented reinstall.
- [ ] Restore/migrate settings and local sessions from tested backups without overwriting newer valid data blindly.
- [ ] Re-run the failing regression and adjacent user journey; record incident cause and follow-up test.

## Final decision record

```text
Candidate/artifact/Worker identifiers:
Confirmed supported feature/platform/provider matrix:
Required checks passed / failed / blocked:
Independent review:
Residual non-blocking limitations:
Measured latency/completion/resource/cost results:
Privacy/action/auth verification:
Recovery drill evidence:
Support/operator and budget owner:
Release audience and authorized distribution:
Decision: HOLD / INVITE BETA / EXPAND
Decision owner and date:
```

