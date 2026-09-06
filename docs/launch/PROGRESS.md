# Launch implementation progress

Implementation branch: `feature/launch/implementation`.
Baseline: `24dce422dce5f720e455d646de6ad049628cda89` (`dev`, 6 September 2026).

The owner authorized implementation on a new branch. The copies of the plan, task tracker, release checklist, and analysis in this directory are the versioned launch references. Use this file for execution status; the original planning documents remain historical scope/design records.

## Baseline and scope

- Existing app typecheck passed before changes.
- Lint cannot run without an ESLint configuration.
- The initial test attempt could not spawn esbuild in the sandbox. An approved outside-sandbox attempt encountered a Windows memory/page-file failure; the subsequent retry passed all 32 original tests. The configuration now explicitly limits Vitest to one worker.
- There is no verified desktop, provider, installer or release baseline yet.
- Initial support target: Windows x64, English, owner then invited beta. Exact Windows builds, devices, provider/model access and offline hardware minimums remain to be certified.
- Full-core features, including tutorials/actions/memory/proactive help/offline mode, remain required before the external beta.

## Tasks

| Task | Status | Evidence / remaining work |
| --- | --- | --- |
| B01 baseline and versioned plan | Implemented; review pending | Branch created on GitHub; plan and analysis copied with portable links; baseline recorded here; real hardware baseline pending |
| B02 lint and process typechecks | Partially implemented; review pending | Lint and app/Worker/integration types pass. Strict no-DOM audit exposes 16 existing diagnostics; B14/B16 and generated Worker environment types remain |
| B03 test layers and CI | Initial harness implemented; review pending | 32 unit and 19 local workerd integration tests pass; Windows CI configured. Hosted CI, desktop driver and full mock audio/AI harness not yet verified |
| B04 Worker auth bypass | Implemented; checks passed; review pending | Regression suite first failed 5 cases. Fix plus expanded coverage passes 19 tests; invalid requests never reach fixture upstreams; health and valid routes preserved |

## Latest local evidence

- `npm run lint`: passed.
- `npm run typecheck`: passed for app, Worker and integration tests.
- `npm test`: 10 files / 32 tests passed.
- `npm run test:integration`: 1 file / 19 tests passed in Miniflare/workerd; all upstream requests intercepted.
- `npm run build`: passed for main, preload, panel and overlay. Existing mixed static/dynamic import warnings remain.
- `npm run typecheck:boundaries`: 16 known failures, intentionally visible and excluded from baseline CI until audio ownership is repaired.
- `npm audit`: reports 16 dependency vulnerabilities (1 moderate, 14 high, 1 critical); raw baseline saved in `dependency-audit.json`. No broad automatic/forced upgrade applied. Dependency triage is B32 and remains a release blocker until assessed/remediated.
- `git diff --check`: passed for current changes.

Next runtime task: B07 canonical IPC contracts, followed by B09/B10 settings and B11/B12 turn/media ownership. Broader B05/B06 Worker validation/environment work remains open. M0/G0 and release qualification are not complete.

## Review and promotion

Changes on this implementation branch are not approved for release. Independent review is still required by CONTRIBUTING.md. Its named reviewer is not an available model in this session; no independent review is claimed. No merge to dev/main, production Worker deployment, paid-provider request or desktop release is part of this baseline batch.
