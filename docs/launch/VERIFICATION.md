# Development verification

Use Node from `.nvmrc` (baseline 22.17.1) and install both lockfiles with `npm ci` and `npm ci --prefix worker`.

| Command | Purpose |
| --- | --- |
| `npm run lint` | TypeScript/React hooks lint for application, Worker and test sources |
| `npm run typecheck` | Existing app, Worker and integration-test typechecks |
| `npm test` | Existing unit suite, limited to one worker to keep local resource use bounded |
| `npm run test:integration` | Real local Workers-runtime authentication/routing tests; all upstream fetches intercepted |
| `npm run build` | Bundle main, preload, panel and overlay; does not launch or package an installer |
| `npm run typecheck:boundaries` | Stricter no-DOM main-process audit; currently expected to fail on existing audio defects |

The boundary audit is intentionally separate from the restored baseline CI. Its initial 16 diagnostics are in `assemblyai-stt.ts` (unvalidated token JSON) and the two paid TTS providers (browser playback in main). B14/B16 must resolve them and promote this audit to a required CI check. B02 is therefore only partially complete. Do not add DOM types to make it pass.

Legacy `any` allowances are limited to the four existing files undergoing B07/B09/B15 replacement. All other and new TypeScript files use the recommended no-explicit-any rule. Remove those allowances as their corresponding contracts are implemented.

Integration tests transpile the current single-file Worker and execute it in Miniflare/workerd, including the Workers-specific timing-safe comparison. They do not load `.dev.vars`, credentials, or production configuration; outbound requests terminate in a local fixture callback. If the Worker gains imports, replace the single-file transpilation with a proper bundle before adding those modules. These tests do not certify provider schemas, quotas, deployed settings or desktop behavior.

CI runs on Windows using both lockfiles. It verifies code and bundles only. Signing, actual desktop interaction and release qualification are later tasks. A green baseline does not mean the app is launch ready.

## Private Worker credential setup after B04

Empty or placeholder credentials are now rejected intentionally. Copy `worker/.dev.vars.example` to `worker/.dev.vars` and set a randomly generated credential locally. Set the same `PIP_SHARED_SECRET` in the desktop's launch environment, alongside `PIP_WORKER_URL`. For a deployed Worker, configure this value as a Cloudflare secret, not a public `[vars]` entry. Never put it in Git or a distributable desktop bundle. External beta identity remains B29/M7 work.

Health is `GET /health`; CORS preflight stays public. Missing/invalid server auth configuration returns 503; missing/wrong client authentication returns 401 before any provider call. Successful authenticated route behavior is preserved. No deployed Worker was changed by this implementation batch.
