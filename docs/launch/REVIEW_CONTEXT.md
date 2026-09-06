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
