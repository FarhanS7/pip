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
