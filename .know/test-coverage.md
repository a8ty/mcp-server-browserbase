---
domain: test-coverage
generated_at: "2026-07-26T13:19:02Z"
expires_after: "7d"
source_scope:
  - "./src/**/*.ts"
  - "./lib/**/*.ts"
  - "./package.json"
generator: theoros
source_hash: "973dffb9dd81eae830f20c4d090be820841c7c669b5e858ed99e87d22d2d03d4"
confidence: 0.91
format_version: "1.0"
update_mode: "full"
incremental_cycle: 0
max_incremental_cycles: 3
---

## Domain Assessment: test-coverage

**Overall Grade: F** (44.0% criteria met — knowledge-capture completeness scoring per domain criteria)

**Audit Scope:** Repository root — `tests/`, `evals/`, `package.json`, `.github/workflows/`, `src/**/*.ts` (19 files, 2288 lines)
**Artifacts Evaluated:** 19 `src/*.ts` files, 1 `tests/.gitkeep`, 3 eval config JSON files, 1 eval harness script (`evals/run-evals.ts`, 281 lines), 2 CI workflow files
**Evaluation Date:** 2026-07-26

---

# Test Coverage Knowledge Reference — mcp-server-browserbase

## Ground Truth: There Is No Automated Test Suite

`tests/` contains exactly one file: `.gitkeep` (0 bytes). No `*.test.ts`, `*.spec.ts`, or any test file exists anywhere in the repository (confirmed via `find . -name "*.test.ts" -o -name "*.spec.ts"` returning zero matches, excluding node_modules).

`package.json` defines **no `test` script**. The full script inventory is: `build`, `prepare`, `watch`, `smithery`, `inspector`, `evals`, `lint`, `format`, `clean`, `prepublishOnly`, `pre-commit`, `changeset`, `version:packages`, `release`. There is no unit-test runner dependency in `devDependencies` (no `vitest`, `jest`, `mocha`, `ava`, or `node:test` wiring) — the only test-adjacent devDependency is `mcpvals` (the eval harness library).

`.github/workflows/publish-mcp.yml:78` runs `pnpm test --if-present` — this is a no-op today since no `test` script exists; it will silently continue to no-op even if someone later adds test files without also adding the script.

## Criterion 1: Coverage Gaps (weight 40%) — Grade F

**Every source file in `src/` is untested by any unit/integration test.** All 19 files are 100% uncovered by conventional test infrastructure:

| File | Lines | Criticality | Untested surface |
|---|---|---|---|
| `src/config.ts` | 173 | **Critical** — resolves LOCAL vs BROWSERBASE mode, credential defaults, model-API-key fallback chain | `resolveConfig` (config.ts:52-94), `mergeConfig` deep-merge (config.ts:139-173), dummy-credential substitution (config.ts:70-81) |
| `src/sessionManager.ts` | 530 | **Critical** — session lifecycle, mutex/race-guard, cleanup | `ensureDefaultSessionInternal` mutex (sessionManager.ts:323-413), `closeBrowserGracefully` idempotent-cleanup guard (sessionManager.ts:269-319), stale-session detection/recreation (sessionManager.ts:340-359, 443-461) |
| `src/tools/screenshot.ts` | 142 | High — screenshot capture + resource registration | zero test coverage |
| `src/mcp/resources.ts` | 96 | High — screenshot purge-on-session-close (`clearScreenshotsForSession`, resources.ts:34-42) | Zero tests for the purge map bookkeeping (`sessionIdToScreenshotNames`) |
| `src/index.ts` | 215 | **Critical** — WS-F defensive credential gate (index.ts:114-134), Smithery config schema/zod validation (index.ts:80-111) | The LOCAL-vs-BROWSERBASE branch at index.ts:127-134 has zero test coverage |
| `src/tools/{act,agent,extract,navigate,observe,session,tool,url}.ts` | 74/90/68/66/71/226/39/66 | High — all 8 MCP tool implementations | Zero tool-level tests; no mocked-Stagehand test harness exists |
| `src/transport.ts` | 118 | High — stdio/HTTP transport wiring | Zero tests |
| `src/context.ts` | 122 | High — session-id delegation to SessionManager | Zero tests |
| `src/program.ts` | 100 | Medium — CLI arg parsing | Zero tests |
| `src/server.ts` | 26 | Low — thin wrapper | Zero tests |

**LOCAL mode has zero automated exercise anywhere.** All three `evals/*.config.json` files (`mcp-eval.config.json`, `mcp-eval-basic.config.json`, `mcp-eval-minimal.config.json`) set only `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `GEMINI_API_KEY` in their `server.env` block — none set `STAGEHAND_ENV=LOCAL`. Since `src/config.ts:26` defaults `STAGEHAND_ENV` to `"LOCAL"` only when the env var is absent, and the eval harness (`evals/run-evals.ts:81-88`) hard-requires `BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY` at the process level (independent of the config's own STAGEHAND_ENV logic), every eval run is implicitly BROWSERBASE-mode. The three credential-gate sites for LOCAL-mode dispatch (`src/config.ts:69-84`, `src/index.ts:127-134`, `src/sessionManager.ts:183-193, 21-24`) are **completely unexercised by CI**. `[KNOW-CANDIDATE]` structural, not incidental: the very feature the current branch (`fix/local-mode-no-browserbase-key`, commit `660c686`) modifies has no test surface to catch regressions in either direction.

**`sessionManager.ts` race-guard/mutex logic is untested.** The `defaultSessionCreationPromise` mutex (sessionManager.ts:128, 323-330, 361-407) exists specifically to prevent concurrent default-session creation — exactly the class of bug (race conditions) that requires a controlled-concurrency test or a documented manual-test procedure. Neither exists. Similarly, `cleaningUpSessions` (sessionManager.ts:130, 274-282, 315-317) guards against concurrent `closeBrowserGracefully` calls — untested.

**Screenshot purge-on-close is untested.** `sessionManager.ts:295-304` calls `clearScreenshotsForSession(...)` after Stagehand close; `resources.ts:34-42` implements the map-purge. No test verifies screenshots registered under a session are actually removed when it closes, nor that other sessions' screenshots survive.

**Negative/error-path testing**: `mcp-eval-basic.config.json` and `mcp-eval.config.json` each include exactly one `error-handling-test` workflow (invalid URL navigation) — the only negative-path automated check in the repository, and it is an LLM-driven eval (non-deterministic, network-dependent), not a deterministic unit test.

**No coverage measurement infrastructure exists.** No `--coverage` flag, no `nyc`/`c8`/`istanbul` dependency, no coverage report artifact or CI step.

**Prioritized gap list** (highest risk first):
1. `sessionManager.ts` mutex/cleanup guards (race conditions — highest-cost-to-debug class, currently invisible to CI)
2. LOCAL-mode credential-gate logic at all 3 sites (actively modified on this branch with zero regression protection)
3. `resources.ts` screenshot purge (memory-leak / cross-session-leak risk)
4. `config.ts` `mergeConfig`/`resolveConfig` (silent misconfiguration risk)
5. All 8 tool implementations (`src/tools/*.ts`) — no mocked-Stagehand harness exists to test tool logic independent of live browser/API calls

## Criterion 2: Testing Conventions (weight 30%) — Grade F

There are no test function naming conventions, no subtest patterns, no assertion-library conventions, no test-helper patterns, no skip patterns, no `testdata/`-equivalent fixture directory, and no builder/factory patterns for test data — because there are no tests. The only artifact resembling test *configuration* is the `evals/*.config.json` trio, which follow a workflow-schema convention (`name`, `description`, `steps[].user`/`expectedState`, `expectTexts`) documented implicitly by `evals/run-evals.ts`'s `EvalConfig` type (run-evals.ts:44-48) — but this is eval-workflow schema, not unit-test convention, consumed by the external `mcpvals` package rather than an in-repo assertion library.

**Sibling-branch evidence** (`origin/fix/model-family-aware-key-resolution`, not merged into current branch): that branch adds `tests/model-api-key-resolution.test.ts` (65 lines) using Node's built-in `node:test` + `node:assert` modules directly (no vitest/jest), with a `withEnv()` helper for save/restore-around-assertion of env vars. This is the only concrete evidence anywhere in the project's history of an intended testing convention (native `node:test`, no framework dependency). Critically, **even that branch's `package.json` has no `test` script** (identical script block to current `main`) — the convention-in-progress is itself unwired: there is no `node --test`/`tsx --test` invocation anywhere, so even if merged, the test file would not run in CI without an additional script-authoring step. `[KNOW-CANDIDATE]` if that branch merges, the wiring gap (test file present, no script to invoke it) is worth a dedicated scar-tissue or design-constraints entry.

## Criterion 3: Test Structure Summary (weight 30%) — Grade D

**Distribution**: 0 of 19 `src/*.ts` files have corresponding unit tests (0%). The `tests/` directory is a placeholder (`.gitkeep` only).

**Package/module naming**: N/A — no test files exist (and the Go-style `package foo_test` distinction does not apply to this TypeScript ecosystem regardless).

**Integration vs unit test distinction**: The project's only integration-style automated verification is the **eval harness** (`evals/run-evals.ts`, `evals/*.config.json`), which is LLM-driven, end-to-end, and requires live Browserbase + Gemini + Anthropic credentials. This is architecturally an *end-to-end functional eval* layer, not a unit-test layer — it verifies tool-call sequences and final-state strings via natural-language prompts scored by `mcpvals`'s built-in metrics (`llmJudge: false` in all 3 configs, so scoring is deterministic tool-call/state matching, not LLM-judged, per `evals/run-evals.ts:120-124`).

**Test invocation commands**:
- `pnpm evals` → runs all 3 eval configs sequentially (package.json evals script)
- `pnpm test` → **does not exist** (no script defined)
- CI (`.github/workflows/ci.yml:39-46`) runs `pnpm evals` with `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` from GitHub Secrets — the sole automated coverage the project has, and it is 100% BROWSERBASE-mode, live-network-dependent, and non-deterministic (LLM tool-selection).
- `.github/workflows/publish-mcp.yml:77-78` runs `pnpm test --if-present` — silent no-op today.

**Mental model for an agent approaching this codebase**: There is no unit-test safety net whatsoever. The only automated regression signal is the eval harness, which (a) only exercises BROWSERBASE mode, (b) requires 4 live API credentials to run at all, (c) is non-deterministic, and (d) does not touch `sessionManager.ts` internals, `config.ts` merge/resolve logic, or the screenshot-purge path directly. Any change to LOCAL-mode logic, mutex/race-guard logic, or config merge logic ships with zero regression protection beyond manual testing and `tsc` type-checking (`pnpm build`) + `eslint` (`pnpm lint`).

---

## Findings

### Strengths

- **Eval harness has a clean, typed config schema**: `evals/run-evals.ts` defines `EvalConfig`/`EvaluationResult`/`TestResult` types and a parallel-workflow-splitting execution model (run-evals.ts:157-186) that is well-structured for end-to-end functional verification of tool-call sequences.
- **CI wiring is otherwise sound for what it covers**: `.github/workflows/ci.yml` runs lint, format, build, and evals on every PR to `main` — the pipeline shape is conventional even though the unit-test layer is absent.

### Weaknesses

- **Zero unit/integration test files exist**: `tests/` contains only `.gitkeep`; 0 of 19 `src/*.ts` files have any test coverage. `[KNOW-CANDIDATE]` the single most consequential finding for this domain — every criterion evaluated against "existing tests" is trivially F because the baseline is empty.
- **No `test` script in `package.json`**: even ad-hoc test files added by a contributor (as demonstrated by the unmerged sibling branch) have no wired invocation path; `pnpm test --if-present` in `publish-mcp.yml:78` silently no-ops.
- **LOCAL mode — the subject of the current branch's fix (`660c686`, `a64b429`) — has zero automated coverage.** None of the 3 `evals/*.config.json` files set `STAGEHAND_ENV=LOCAL`; the eval harness hard-requires `BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID` at the process level (`run-evals.ts:81-88`) regardless of config env, making a LOCAL-mode eval variant impossible without also modifying the harness's required-env-var check.
- **Session-lifecycle race-guards (`sessionManager.ts:128,130,274-282,323-413`) are untested**: the mutex for default-session creation and the cleanup-tracking set for concurrent-close prevention silently regress without a concurrency-exercising test.
- **Screenshot purge-on-session-close (`resources.ts:34-42`, invoked from `sessionManager.ts:295-304`) is untested**.
- **The one prior unit-test attempt (unmerged branch) is itself incompletely wired**: the test file exists but no script invokes it, and it isn't on the current branch at all.
- **CI's only test-adjacent signal is non-deterministic and credential-gated**: `pnpm evals` requires 4 live API keys and depends on LLM tool-selection — not a substitute for deterministic unit coverage.

### Recommendations

1. **Add a `test` script to `package.json`** wired to Node's built-in `node:test` runner (e.g. `node --import tsx --test tests/**/*.test.ts`), matching the convention already attempted on the unmerged sibling branch, so future test files are actually invoked by CI and by `publish-mcp.yml`'s existing `pnpm test --if-present` step.
2. **Add unit tests for `src/config.ts`** covering `resolveConfig`/`mergeConfig`/the LOCAL-vs-BROWSERBASE credential-default branch (config.ts:52-94, 139-173) — pure, dependency-free logic, trivially unit-testable without mocking Stagehand or network calls.
3. **Add a LOCAL-mode eval config variant** (or a lightweight scripted smoke test) that sets `STAGEHAND_ENV=LOCAL` and exercises `createStagehandInstance`'s LOCAL branch and the credential-gate bypass (index.ts:127-134) — the exact surface the current branch modifies.
4. **Add a concurrency test for `ensureDefaultSessionInternal`'s mutex** (sessionManager.ts:323-413) — fire multiple concurrent calls, assert only one `createNewBrowserSession` invocation, with a mocked Stagehand constructor.
5. **Add a unit test for `clearScreenshotsForSession`** (resources.ts:34-42) verifying session-scoped purge does not affect other sessions' screenshots.

---

## Appendix: Evidence Details

- `tests/` directory listing: `.gitkeep` only (no test files)
- `package.json` scripts block: no `test` key
- `evals/*.config.json` × 3: all set `server.env` = `{BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, GEMINI_API_KEY}` only; zero occurrences of `STAGEHAND_ENV`
- `evals/run-evals.ts:81-88`: hard-required env vars `["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"]`
- `.github/workflows/ci.yml:39-46`: `pnpm evals` step with 4 secrets injected
- `.github/workflows/publish-mcp.yml:77-78`: `pnpm test --if-present` (no-op today)
- `origin/fix/model-family-aware-key-resolution` vs `main`: adds `tests/model-api-key-resolution.test.ts` (+65, new file); that branch's `package.json` scripts block is byte-identical to `main`'s (no `test` script added)
- `src/sessionManager.ts:128,130`: `defaultSessionCreationPromise` and `cleaningUpSessions` field declarations (the two concurrency-guard primitives)
- `src/index.ts:114-134`: WS-F defensive-gate comment block and the `env !== "LOCAL"` branch
- `src/config.ts:26,69-84,101`: the three LOCAL-mode detection/default sites within `config.ts`
