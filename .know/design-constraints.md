---
domain: design-constraints
generated_at: "2026-07-26T13:19:02Z"
expires_after: "7d"
source_scope:
  - "./src/**/*.ts"
  - "./lib/**/*.ts"
  - "./package.json"
generator: theoros
source_hash: "973dffb9dd81eae830f20c4d090be820841c7c669b5e858ed99e87d22d2d03d4"
confidence: 0.86
format_version: "1.0"
update_mode: "full"
incremental_cycle: 0
max_incremental_cycles: 3
---

## Domain Assessment: design-constraints

**Overall Grade: B** (88.9% criteria met)

**Audit Scope:** Full repository source tree — `./src/**/*.ts` (19 files), `.ledge/decisions/` (checked, does not exist), `tests/` (checked, empty — only `.gitkeep`), `evals/*.config.json` (4 files), root manifests (`package.json`, `server.json`, `config.d.ts`, `smithery.yaml`).
**Artifacts Evaluated:** 19 TypeScript source files, 0 ADRs, 0 unit tests, 4 eval configs, 3 version-bearing manifests.
**Evaluation Date:** 2026-07-26
**Git HEAD at audit time:** `660c686`.

This is the first `design-constraints` pass for this repository. Two tensions in this report are **new** relative to `architecture.md`: the LOCAL-mode-breaking `browserbaseSessionId` guard in `navigate.ts`/`session.ts`, and the process-global screenshot map in `mcp/resources.ts`.

---

## Knowledge Reference Body

### Criterion 1: Tension Catalog

11 structural tensions cataloged (exceeds the 8-minimum threshold for a mature-codebase A-tier catalog):

**TENSION-001 — LOCAL/BROWSERBASE mode-gate duplication (4 sites)**
- Type: layering violation / missing abstraction
- Location: `src/index.ts:127` (`(config as any).env !== "LOCAL"`), `src/config.ts:26,69,101`, `src/sessionManager.ts:17,181`
- Historical reason: `a64b429` introduced LOCAL mode; `660c686` patched the credential-throw gate at `index.ts` only, reaching for `as any` because `configSchema` (line 22-94) never declares an `env` field — each site independently re-derives `isLocalMode`.
- Ideal resolution: single exported `isLocalMode(config): boolean` helper in `config.ts`, imported at all 4 sites.
- Resolution cost: LOW (pure refactor, no behavior change) — the cost that has repeatedly deferred this is that each of the 3 patch commits (`a64b429`, `660c686`, and this session's uncommitted work) touched only the site relevant to the immediate bug.

**TENSION-002 — Two divergent config-resolution paths**
- Type: dual-system pattern
- Location: `src/config.ts:52-128` (CLI cascade: `resolveConfig`/`configFromCLIOptions`/`mergeConfig`) vs `src/index.ts:22-111` (Smithery zod `configSchema`)
- Historical reason: two consumption modes (CLI/stdio binary vs Smithery-hosted dev runtime, `smithery.yaml:1` `runtime: "typescript"`) were bolted onto one `Config` type without a shared validator.
- Ideal resolution: derive `configSchema` from `Config`/`CLIOptions` (or vice versa) via a single zod schema reused by both paths.
- Resolution cost: MEDIUM — `configSchema.refine()` (`index.ts:95-111`) encodes a cross-field rule (custom model requires `modelApiKey`) that `config.ts`'s cascade does not enforce at all; unifying requires deciding which path's validation semantics win.

**TENSION-003 — Three divergent version strings**
- Type: naming/identity mismatch
- Location: `package.json:3` (`"1.0.0"`), `server.json:11` (`"2.2.0"`, plus stale upstream identity `"io.github.browserbase/mcp-server-browserbase"`), `src/index.ts:138` (hardcoded `"2.3.0"` in the `McpServer` constructor)
- Historical reason: this is a fork (`package.json:2` `"@knossos/mcp-stagehand"`, `mcpName: "io.github.autom8y/mcp-stagehand"`) of upstream `mcp-server-browserbase`; `server.json` (the MCP-registry manifest) was never updated post-fork, and `index.ts:138`'s version literal was never wired to `package.json`.
- Ideal resolution: single source of truth (read `package.json.version` at build/runtime, as `program.ts:33` already does for the CLI `--version` flag) propagated to `index.ts:138` and `server.json`.
- Resolution cost: LOW for `index.ts`; MEDIUM for `server.json` since it also requires reconciling package identity/env-var list before next registry publish (see RISK-005 cross-ref).

**TENSION-004 — 3-node type-only import cycle**
- Type: layering violation (latent)
- Location: `src/types/types.ts:3-4` (imports `Tool`, `InputType` from `../tools/tool.js`) → `src/tools/tool.ts:6` (imports `Context` type from `../context.js`) → `src/context.ts:7` (imports `MCPTool` type from `./types/types.js`)
- Historical reason: `Tool<Input>` needs `Context` for its `handle` signature; `MCPTool` needs `Tool`; `Context` needs `MCPTool` for `run()`. Grown incrementally, no interface-only extraction was ever done.
- Ideal resolution: extract a 4th file holding only the `Context` type reference, breaking the 3-node loop.
- Resolution cost: LOW today (erased by `import type`); would become a HARD real circular-require the day any of these 3 files is split into a separate package.

**TENSION-005 — Duplicated `ToolActionResult` type definition**
- Type: under-engineering (missing shared source of truth)
- Location: `src/tools/tool.ts:17-20` and `src/types/types.ts:30-33` — byte-identical type bodies defined twice.
- Ideal resolution: `types.ts` should `export type { ToolActionResult } from "../tools/tool.js"` instead of redefining.
- Resolution cost: LOW, but blocked on TENSION-004 not worsening (re-exporting adds another cross-reference into the cycle).

**TENSION-006 — Duplicated try/catch boilerplate across 9 tool implementations**
- Type: missing abstraction
- Location: identical error-wrapping shape in `navigate.ts:48-51`, `act.ts:56-59`, `extract.ts:50-53`, `observe.ts:53-56`, `screenshot.ts:124-127`, `url.ts:48-51`, `agent.ts:72-75`, and both handlers in `session.ts:109-117,174-180`.
- Ideal resolution: a `wrapToolAction<T>(label, fn)` helper in `tools/tool.ts`.
- Resolution cost: LOW, purely mechanical.

**TENSION-007 — `navigate.ts` hard-requires `stagehand.browserbaseSessionId` (NEW finding, high severity)**
- Type: dual-system pattern / genuine functional gap
- Location: `src/tools/navigate.ts:35-38`: `const sessionId = stagehand.browserbaseSessionId; if (!sessionId) { throw new Error("No Browserbase session ID available"); }`. This variable is computed and never used afterward except for the throw-guard.
- Evidence this breaks LOCAL mode: `sessionManager.ts:216-235` only assigns a real `browserbaseSessionId` in the BROWSERBASE branch (`stagehand.browserbaseSessionId!` at line 223); the LOCAL branch (lines 217-221) never sets this property — it's a Stagehand-SDK-internal field populated only for cloud sessions. `grep -n "browserbaseSessionId" src/tools/*.ts` confirms `act.ts`, `extract.ts`, `observe.ts`, `url.ts`, `agent.ts`, `screenshot.ts` never reference this property — only `navigate.ts` and `session.ts` do.
- Ideal resolution: gate the check on `config.env !== "LOCAL"`, or simply delete the dead `sessionId` variable and its throw.
- Resolution cost: TRIVIAL (4-line deletion or 1-line conditional) but HIGH SEVERITY — the single most consequential finding in this audit; see RISK-001.

**TENSION-008 — `session.ts`'s `browserbase_session_create` unconditionally calls the Browserbase cloud API (NEW finding)**
- Type: dual-system pattern
- Location: `src/tools/session.ts:79-90` — `new Browserbase({apiKey: config.browserbaseApiKey})` and `bb.sessions.debug(browserbaseSessionId)` execute regardless of `config.env`; no `env`/`LOCAL` reference exists anywhere in `session.ts` (`grep -n "env\|LOCAL\|BROWSERBASE" src/tools/session.ts` → zero matches).
- Ideal resolution: skip the `Browserbase` debug-URL lookup when `config.env === "LOCAL"` and return a LOCAL-appropriate success message.
- Resolution cost: LOW-MEDIUM.

**TENSION-009 — Process-global screenshot map, not scoped per Context/session (NEW finding)**
- Type: layering violation / missing tenant isolation
- Location: `src/mcp/resources.ts:14,18` — `screenshots: Map<string,string>` and `sessionIdToScreenshotNames` are module-level singletons; `listResources()` (line 53-63) returns every screenshot in the process, not scoped to a calling `Context`.
- Historical reason: originally one `Context` per process (stdio); `transport.ts:59`'s `handleStreamable` later added per-HTTP-session `Context`s, but `mcp/resources.ts` was never re-scoped.
- Ideal resolution: move the screenshot map into `Context` (or key it by `contextId`).
- Resolution cost: MEDIUM.

**TENSION-010 — `browserbase_*` tool-name prefix retained for LOCAL-mode-only runs**
- Type: naming mismatch (residual from pre-fork identity)
- Location: all 8 tool names in `src/tools/index.ts:21-30`.
- Resolution cost: HIGH if changed (breaking change to every consumer's tool-call bindings) — **do not "fix" this**, it is intentionally frozen (see Criterion 5).

**TENSION-011 — Zombie/premature abstractions (5 items, confirmed via zero-usage grep)**
- Type: over-engineering / dead code
- Locations: `src/mcp/sampling.ts` (entire module, zero importers), `src/types/types.ts:6-12` (`StagehandSession`, zero usages), `src/tools/index.ts:32` (`sessionManagementTools`, zero importers), `src/mcp/resources.ts:8` + `src/index.ts:13` (`RESOURCES`/`RESOURCE_TEMPLATES`, always empty), `src/tools/tool.ts:33-37` (`defineTool`, never called).
- Ideal resolution: delete, or mark `@deprecated`/`// PLANNED:` if genuinely planned.
- Resolution cost: TRIVIAL (each independently removable with zero blast radius per grep evidence).

### Criterion 2: Trade-off Documentation

Trade-offs are documented per-tension above (current state / ideal state / why-current-persists). Supplementary notes:

- **No ADRs exist** — `.ledge/decisions/` does not exist. All "why persists" narratives are derived from git-commit evidence (`a64b429`, `660c686`) rather than an authored rationale document.
- **Prior refactoring attempts, evidenced**: `660c686`'s commit message ("Operator follow-up (reserved): set package.json name ... bump to 1.0.3...") shows the author was aware of the version-drift problem (TENSION-003) at fix time and explicitly deferred it.
- **External constraints forcing trade-offs**: `@browserbasehq/stagehand: ^3.1.0` is the sole authority for what `stagehand.browserbaseSessionId` is and when it is populated — the LOCAL/BROWSERBASE branching and the TENSION-007/008 bugs are downstream of this one SDK-owned property's semantics. `@modelcontextprotocol/sdk: ^1.13.1`'s `configSchema` shape constrains what `index.ts` can validate (see RISK-005).
- **Grading caveat**: RISK-005 (Smithery's zod-strip behavior on `configSchema`) rests on documented default `z.object()` behavior rather than a directly-executed runtime probe — `@smithery/cli` is not installed in this environment, so its actual `configSchema.parse()` call site could not be inspected. Flagged explicitly.

### Criterion 3: Abstraction Gap Mapping

**Missing abstractions** (duplicated logic that should be unified):
- 9-way duplicated try/catch wrapper (TENSION-006) → `wrapToolAction()` in `tools/tool.ts`.
- 4-way duplicated LOCAL-mode gate (TENSION-001) → `isLocalMode(config)` in `config.ts`.
- 2-way duplicated `ToolActionResult` type (TENSION-005).

**Premature/zombie abstractions** (over-generalized or dead): all 5 items in TENSION-011. Collectively they cost a new agent 5 separate "is this actually used?" investigations before touching resource/session/tool code.

### Criterion 4: Load-Bearing Code Identification

- **`SessionManager.defaultSessionCreationPromise` mutex** (`sessionManager.ts:325-407`): serializes concurrent `ensureDefaultSessionInternal` calls so two simultaneous tool invocations don't race-create two default sessions. Naive-fix failure mode: removing the mutex re-introduces a TOCTOU race leaking a browser process. Correctly load-bearing — do not touch without equivalent serialization.
- **`cleaningUpSessions: Set<string>`** (`sessionManager.ts:274-282,315-317`): guards `closeBrowserGracefully` against double-close races. Removing it risks double-`stagehand.close()`.
- **`mergeConfig`'s special-cased `context` deep-merge** (`config.ts:139-172`, lines 148-153): a naive shallow spread would silently clobber `defaultConfig.context.contextId`.
- **`Context.currentSessionId` getter delegation** (`context.ts:23-25`, documented at 21-22): deliberately NOT a stored field, to prevent Context/SessionManager active-session drift. A naive "optimization" caching this reintroduces the desync bug it was built to avoid.

### Criterion 5: Evolution Constraint Documentation

| Area | Changeability | Evidence |
|---|---|---|
| Individual tool files (`act.ts`, `extract.ts`, `observe.ts`, `url.ts`) | **Safe** | Zero fan-in; each imports only `tool.js`/`context.js`(type)/`types.js`(type). |
| `navigate.ts` / `session.ts` LOCAL-mode gate fix (TENSION-007/008) | **Safe-but-urgent** | Isolated to 2 files; no external contract changes needed to fix. |
| `SessionManager` mutex/cleanup internals | **Frozen** (without explicit review) | Race-condition guards (Criterion 4); no test suite to catch a regression. |
| `Config` type / config-resolution paths | **Coordinated** | Adding a field requires touching `CLIOptions` + `configFromCLIOptions` + `defaultConfig` (`config.ts`) *and* `configSchema` (`index.ts`) — 4 edit sites. |
| `tool_name` string constants (`browserbase_*`) | **Frozen** | Breaking rename would break every MCP client's tool-call bindings (TENSION-010). |
| `server.json` / `package.json` version+identity | **Migration** | Registry-facing; stale upstream identity must be reconciled with fork identity before any MCP-registry republish. |
| `mcp/sampling.ts`, dead exports (TENSION-011) | **Safe to delete** | Zero importers confirmed via grep. |
| Stagehand/Browserbase/MCP-SDK dependency versions (`^3.1.0`, `^2.6.0`, `^1.13.1`) | **External migration constraint** | `browserbaseSessionId` semantics are SDK-owned; a Stagehand major bump could silently change behavior with no local test. |

### Criterion 6: Risk Zone Mapping

- **RISK-001** — `src/tools/navigate.ts:35-38`. Missing guard: no `config.env === "LOCAL"` check before requiring `stagehand.browserbaseSessionId`. Cross-ref: TENSION-007. Highest-severity finding.
- **RISK-002** — `tests/` (only `.gitkeep`) and `evals/*.config.json` (all 4 pass BROWSERBASE env vars — none exercise `STAGEHAND_ENV=LOCAL`). No automated check would have caught RISK-001. Recommended: an eval/test running `browserbase_stagehand_navigate` under `STAGEHAND_ENV=LOCAL`. Cross-ref: TENSION-007/008.
- **RISK-003** — `src/config.ts:71-81,87-91`. Silent dummy-credential substitution (`"dummy-browserbase-api-key"`, `"dummy-api-key"`) instead of a hard failure when required env vars are absent in BROWSERBASE mode. Recommended: fail fast in BROWSERBASE mode.
- **RISK-004** — `src/mcp/resources.ts:14,18` (process-global `screenshots` Map). No per-Context/session scoping on `listResources()`; `transport.ts:59` spins a fresh `Context` per HTTP POST session while the maps remain module-level singletons. Cross-ref: TENSION-009.
- **RISK-005** — `src/index.ts:22-94` (`configSchema` — no `env` field). Under Smithery's zod-based config validation, a `z.object()` schema strips unrecognized keys by default — meaning `config.env` could be dropped before reaching the factory, making the `660c686` LOCAL-mode fix permanently false under Smithery-hosted invocation. **Confidence caveat**: inferred from documented zod default-strip behavior, not a direct execution trace (`@smithery/cli` not installed). Recommended: add `env: z.enum(["LOCAL","BROWSERBASE"]).optional()` to `configSchema`. Cross-ref: TENSION-002.
- **RISK-006** (minor) — `src/sessionManager.ts:223-224` — `stagehand.browserbaseSessionId!` (non-null assertion) immediately followed by `if (!browserbaseSessionId)` runtime check — a readability/consistency smell, low severity.

---

## Grading Calculation

| Criterion | Grade | Midpoint % | Weight | Contribution |
|---|---|---|---|---|
| Tension Catalog Completeness | A | 93% | 27% | 25.11 |
| Trade-off Documentation | B | 85% | 22% | 18.70 |
| Abstraction Gap Mapping | A | 92% | 18% | 16.56 |
| Load-Bearing Code Identification | B | 85% | 13% | 11.05 |
| Evolution Constraint Documentation | B | 85% | 10% | 8.50 |
| Risk Zone Mapping | A | 90% | 10% | 9.00 |
| **Total** | | | | **88.92 → B** |

## Findings

### Strengths

- **Comprehensive tension catalog exceeding the mature-codebase minimum**: 11 TENSION-NNN entries, each with file:line location, historical reason, ideal resolution, and resolution cost.
- **A genuinely new, high-severity, well-grounded finding**: `[KNOW-CANDIDATE]` TENSION-007/RISK-001 — `browserbase_stagehand_navigate` (the tool an agent would call first in almost any browser-automation flow) unconditionally throws in LOCAL mode because of a stale `stagehand.browserbaseSessionId` guard never revisited when LOCAL mode was added in `a64b429`. Directly actionable: a 1-4 line fix in `navigate.ts:35-38`.
- **Cross-referenced risk zones**: all 6 RISK-NNN entries link back to their originating TENSION-NNN.

### Weaknesses

- **Zero test/eval coverage for LOCAL mode**: `tests/` is empty and all 4 `evals/*.config.json` files exercise BROWSERBASE-mode env vars exclusively. `[KNOW-CANDIDATE]` RISK-001 is a strong scar-tissue candidate once fixed.
- **One trade-off/risk narrative rests on inference rather than direct execution**: RISK-005 (Smithery's zod-strip behavior) could not be confirmed by running `@smithery/cli`.
- **No ADR trail**: `.ledge/decisions/` does not exist, so none of the 11 tensions can be linked to an authored design rationale.

### Recommendations

1. **Fix RISK-001/TENSION-007 first**: remove or env-gate the `browserbaseSessionId` throw-guard in `src/tools/navigate.ts:35-38` — highest-severity, lowest-cost item.
2. **Add a LOCAL-mode eval workflow** (`evals/mcp-eval-local.config.json` with `STAGEHAND_ENV=LOCAL`) exercising `browserbase_stagehand_navigate` and `browserbase_session_create` end-to-end (addresses RISK-002).
3. **Centralize the LOCAL/BROWSERBASE gate** into `isLocalMode(config)` (TENSION-001) and reuse it at the 4 existing sites plus the 2 newly-identified sites in `navigate.ts`/`session.ts`.
4. **Verify RISK-005 empirically** and add the `env` field to `configSchema` regardless.
5. **Scope `mcp/resources.ts`'s screenshot map per-`Context`** (TENSION-009/RISK-004) before the HTTP/Streamable transport is used with more than one concurrent session.

## Appendix: Evidence Details

- `browserbaseSessionId` usage sweep: `grep -n "browserbaseSessionId" src/tools/*.ts src/*.ts` — hits only in `navigate.ts:35`, `session.ts:83-200`, `sessionManager.ts:216-239`; zero hits in `act.ts`, `extract.ts`, `observe.ts`, `url.ts`, `agent.ts`, `screenshot.ts`.
- `session.ts` env-awareness sweep: `grep -n "env\|LOCAL\|BROWSERBASE" src/tools/session.ts` → zero matches.
- Test/eval coverage sweep: `find tests -type f` → `tests/.gitkeep` only; `evals/mcp-eval-minimal.config.json` env block → `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `GEMINI_API_KEY` (no `STAGEHAND_ENV`).
- Version-drift sweep: `package.json:3` (`"1.0.0"`), `server.json:11` (`"2.2.0"`), `src/index.ts:138` (`"2.3.0"`).
- Dependency versions: `@browserbasehq/stagehand: ^3.1.0`, `@browserbasehq/sdk: ^2.6.0`, `@modelcontextprotocol/sdk: ^1.13.1`, `zod: ^3.25.67` (`package.json:48-55`).
- ADR/decision-record sweep: `.ledge/decisions/` does not exist in this repository.

**Relevant file paths for follow-up:**
- `src/tools/navigate.ts:35-38` (RISK-001 fix site)
- `src/tools/session.ts:79-90` (TENSION-008 fix site)
- `src/sessionManager.ts:216-235` (ground-truth for `browserbaseSessionId` LOCAL-vs-BROWSERBASE semantics)
- `src/index.ts:22-138` (configSchema + version literal)
- `src/mcp/resources.ts:14-18` (TENSION-009/RISK-004)
- `tests/` (empty — RISK-002); `evals/mcp-eval-minimal.config.json` (BROWSERBASE-only eval coverage)
