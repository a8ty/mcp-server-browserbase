---
domain: architecture
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

## Domain Assessment: architecture

**Overall Grade: A** (91.5% criteria met)

**Audit Scope:** Full repository source tree — `./src/**/*.ts` (19 files across `src/`, `src/mcp/`, `src/tools/`, `src/types/`), plus root config manifests (`package.json`, `tsconfig.json`, `smithery.yaml`, `server.json`, `config.d.ts`, `index.d.ts`, `Dockerfile`, `cli.js`, `index.js`) and `evals/`.
**Artifacts Evaluated:** 19 TypeScript source files (2,329 total lines), 6 root config/manifest files, 4 eval config files
**Evaluation Date:** 2026-07-26
**Language Detected:** TypeScript (Node.js ESM), per `package.json` (`"type": "module"`) and `tsconfig.json`

---

## Knowledge Reference Body

### 1. Package Structure

`mcp-server-browserbase` (published as `@knossos/mcp-stagehand`, mcpName `io.github.autom8y/mcp-stagehand`) is an MCP (Model Context Protocol) server exposing browser-automation tools backed by Stagehand, in either a Browserbase-cloud session or a local Chromium/Playwright session ("LOCAL mode", added in commit `a64b429`/`660c686`).

There is no `cmd/`/`internal/` Go-style split; the TS scope-adaptation applies (`src/` = source, `package.json` = manifest, `src/index.ts` = library entry, `cli.js` = binary entry).

| Path | Purpose | Lines | Exported types/values | Classification |
|---|---|---|---|---|
| `src/index.ts` | Smithery default-export factory: builds `McpServer`, defines `configSchema` (zod), registers resource handlers + all tools, gates Browserbase-key requirement on `config.env !== "LOCAL"` | 215 | `configSchema`, default factory fn | Hub (imports 4 internal modules) |
| `src/program.ts` | CLI entry (commander): defines all `--flag` options, wires `resolveConfig` → `ServerList` → transport selection, `setupExitWatchdog` | 100 | none (side-effect module) | Hub (imports index/server/transport/config) |
| `src/config.ts` | `CLIOptions` type; `resolveConfig`/`configFromCLIOptions`/`mergeConfig`; env-var fallback chain (`GEMINI_API_KEY`→`GOOGLE_API_KEY`→…); LOCAL-mode dummy-key warnings | 173 | `CLIOptions`, `resolveConfig`, `configFromCLIOptions` | Leaf (only `../config.d.ts` type import) |
| `src/context.ts` | `Context` class: request-scoped controller wrapping `SessionManager`, dispatches `tool.handle()`, exposes `listResources`/`readResource` | 122 | `Context` | Mid (3 internal imports) |
| `src/server.ts` | `ServerList`: array-backed registry of live `Server` instances (create/close/closeAll) | 26 | `ServerList` | **Leaf** (zero internal imports) |
| `src/sessionManager.ts` | `createStagehandInstance` factory + `SessionManager` class: LOCAL vs BROWSERBASE Stagehand construction, default-session mutex, stale-session detection, cleanup | 530 (largest file) | `createStagehandInstance`, `SessionManager` | Mid (2 internal imports) |
| `src/transport.ts` | `startStdioTransport`, `startHttpTransport` (+ internal `handleStreamable`) — Node `http` server for Streamable-HTTP transport with per-session `Map` | 118 | `startStdioTransport`, `startHttpTransport` | Mid (imports `server.js` only) |
| `src/mcp/resources.ts` | In-memory screenshot store (`Map<string,string>`) + per-session screenshot tracking/purge; resource list/read handlers | 96 | `registerScreenshot`, `clearScreenshotsForSession`, `clearAllScreenshots`, `listResources`, `readResource`, `RESOURCES` (unused, always `[]`) | **Leaf** |
| `src/mcp/sampling.ts` | Sampling-capability type stub; **zero importers anywhere in `src/`** | 34 | `SAMPLING_CAPABILITY`, `SamplingMessage` — both dead/unconsumed | **Leaf, orphaned module** |
| `src/types/types.ts` | Shared type defs: `StagehandSession` (dead — 0 usages outside definition), `CreateSessionParams`, `BrowserSession` (the type actually used), `ToolActionResult`, `MCPTool`, `MCPToolsArray` | 37 | 6 types | Mid (imports `../tools/tool.js` — see §2 cycle note) |
| `src/tools/tool.ts` | Generic `Tool<Input>` contract, `ToolSchema`, `ToolResult`, `defineTool` helper (identity function; not actually used by any tool file — all tools construct the object literal directly instead of calling `defineTool`) | 39 | `Tool`, `ToolSchema`, `InputType`, `ToolResult`, `defineTool` | Mid (imports `../context.js` as type) |
| `src/tools/index.ts` | Aggregates all 8 tool modules into `TOOLS` array; also exports `sessionManagementTools` (dead export — 0 importers) | 32 | `TOOLS`, `sessionManagementTools`, re-exports | Hub (8 internal imports) |
| `src/tools/session.ts` | 2 tools: `browserbase_session_create`, `browserbase_session_close` (largest tool file; only tool that imports `@browserbasehq/sdk` `Browserbase` client directly for debug-URL lookup, and `@mcp-ui/server` `createUIResource`) | 226 | default export (array of 2 tools) | Leaf-ish (only `tool.js`/`context.js` type imports + 2 external SDKs) |
| `src/tools/navigate.ts` | `browserbase_stagehand_navigate` — `page.goto()` | 66 | default tool | Leaf |
| `src/tools/act.ts` | `browserbase_stagehand_act` — `stagehand.act()` | 74 | default tool | Leaf |
| `src/tools/extract.ts` | `browserbase_stagehand_extract` — `stagehand.extract()` | 68 | default tool | Leaf |
| `src/tools/observe.ts` | `browserbase_stagehand_observe` — `stagehand.observe()` | 71 | default tool | Leaf |
| `src/tools/screenshot.ts` | `browserbase_screenshot` — CDP `Page.captureScreenshot` + `sharp`-based Claude-vision resize (1568px/1.15MP constraint), registers into `mcp/resources.ts` | 142 | default tool | Leaf-ish (1 internal cross-import to `mcp/resources.js`) |
| `src/tools/url.ts` | `browserbase_stagehand_get_url` — `page.url()` | 66 | default tool | Leaf |
| `src/tools/agent.ts` | `browserbase_stagehand_agent` — Stagehand CUA (Computer-Use-Agent) mode, `agent.execute()`, model default `anthropic/claude-sonnet-4-6` (recent addition) | 90 | default tool | Leaf |

**Root-level surface** (non-`src/`): `config.d.ts` (129 lines — the canonical `Config` ambient type consumed via relative `../config.d.ts` imports by 5 src files), `index.d.ts` (public `createServer(config?)` declaration for npm consumers), `cli.js`/`index.js` (2-line ESM shims pointing at `dist/program.js` / re-exporting `dist/index.js`'s `createServer`), `smithery.yaml` (`runtime: "typescript"` — drives `npx @smithery/cli dev src/index.ts`), `server.json` (MCP-registry manifest — **stale/upstream**, see Findings), `Dockerfile` (2-stage: `node:22-alpine` builder → `gcr.io/distroless/nodejs22-debian12` runtime).

**Package-count note**: no formal "package" boundary exists beyond directory grouping (`src/`, `src/mcp/`, `src/tools/`, `src/types/`) — this is a single-package npm module, not a multi-package workspace.

### 2. Layer Boundaries

Layer model (TS-adapted): **CLI/library entry** (`cli.js`/`index.js`, `program.ts`, `index.ts`) → **control/orchestration** (`context.ts`, `server.ts`, `transport.ts`) → **domain logic** (`sessionManager.ts`, `tools/*`) → **shared contracts** (`types/types.ts`, `tools/tool.ts`) → **MCP protocol adapters** (`mcp/resources.ts`, `mcp/sampling.ts`).

**Import-graph evidence** (via `grep -n "^import"` across all 19 files, `src/{*.ts,mcp/*.ts,tools/*.ts,types/*.ts}`):

- **True leaf packages** (zero internal imports): `src/server.ts`, `src/mcp/sampling.ts`.
- **Near-leaf** (1 internal import): `src/config.ts` (`../config.d.ts` type only), most `src/tools/{navigate,act,extract,observe,url,agent}.ts` (each imports only `./tool.js` + `../context.js` [type] + `../types/types.js` [type]).
- **Hub packages**: `src/tools/index.ts` (imports all 8 tool modules — the aggregation point for `TOOLS`), `src/index.ts` (imports `context.js`, `tools/index.js`, `mcp/resources.js`, `types/types.js` — 4 internal deps, the composition root for the MCP server object).
- **Most-imported (fan-in)**: `src/tools/tool.ts` (imported by all 8 tool files + `types/types.ts`), `src/types/types.ts` (imported by `context.ts`, `sessionManager.ts`, and all 8 tool files), `src/context.ts` (imported as a *type* by every tool file for the `handle(context, params)` signature, plus a runtime import in `index.ts`).

**Circular type-only reference (structural note, no runtime cycle)**: `src/types/types.ts:3-4` imports `Tool`/`InputType` from `../tools/tool.js`; `src/tools/tool.ts:6` imports `Context` (type) from `../context.js`; `src/context.ts:7` imports `MCPTool` (type) from `./types/types.js`. This 3-node cycle (`types.ts → tool.ts → context.ts → types.ts`) is entirely `import type` (erased at compile time by TS's `isolatedModules`/type-only-import semantics), so it does not manifest as a runtime circular-require, but a new agent extracting any one of these three files into a separate package would immediately hit a real cycle.

**Boundary-enforcement pattern**: none observed beyond convention — there is no interface-package or barrel that forces one-directional imports; the discipline is informal (tool files import `Context` only as a type, never construct one).

**LOCAL vs BROWSERBASE mode branching is duplicated across 3 call sites**, each independently re-implementing the same `env !== "LOCAL"` gate rather than centralizing it:
1. `src/index.ts:127` (`if ((config as any).env !== "LOCAL")` — note the `any`-cast, since `configSchema` doesn't declare `env`)
2. `src/config.ts:69` (`if (mergedConfig.env !== "LOCAL")`)
3. `src/sessionManager.ts:22,184` (`if (!isLocalMode && ...)`, twice — once in `createStagehandInstance`, once in `createNewBrowserSession`)

### 3. Entry Points and API Surface

**Two independent entry surfaces**, not one:

1. **CLI/stdio-or-HTTP path** (published binary `knossos-mcp-stagehand`): `cli.js` → `dist/program.js` (side-effect import triggers `program.parse(process.argv)` at `src/program.ts:100`) → `.action()` handler (`src/program.ts:69-81`) calls `resolveConfig(options)` [`src/config.ts:52`] → constructs `new ServerList(() => createServerFunction({config}))` [`src/server.ts`] → `setupExitWatchdog(serverList)` (SIGINT/SIGTERM/stdin-close handler, 15s force-exit) → dispatches to `startHttpTransport(port, host, serverList)` or `startStdioTransport(serverList, config)` [`src/transport.ts`] depending on whether `--port` was passed.

2. **Smithery dev/hosted path**: `src/index.ts` is loaded directly by `npx @smithery/cli dev src/index.ts` (per `package.json` `"smithery"` script and `smithery.yaml`'s `runtime: "typescript"`). This path never touches `program.ts`/`resolveConfig` — Smithery injects `config` validated against the exported `configSchema` (zod object, `src/index.ts:22-111`) directly into the default-export factory function (`src/index.ts:114-215`).

These two paths perform **config resolution differently** (CLI-options-cascade vs. Smithery-zod-schema) but must independently implement the same LOCAL-mode credential gate (see §2) — a new agent adding a config field must update both `CLIOptions`/`configFromCLIOptions` (`config.ts`) *and* `configSchema` (`index.ts`) or the two paths drift.

**CLI flags** (from `program.ts:32-68`, commander): `--env`, `--headless`, `--cuaModel`, `--cuaApiKey`, `--browserbaseApiKey`, `--browserbaseProjectId`, `--proxies`, `--advancedStealth`, `--contextId`, `--persist`, `--port`, `--host`, `--browserWidth`, `--browserHeight`, `--modelName`, `--modelApiKey`, `--keepAlive`, `--experimental` (18 flags).

**MCP tool surface** — 8 tools registered via `TOOLS` (`src/tools/index.ts:21-30`), all with `capability: "core"`:

| Tool name | Module | One-line purpose |
|---|---|---|
| `browserbase_session_create` | `session.ts` | Create/resume a Browserbase or LOCAL session, set active |
| `browserbase_session_close` | `session.ts` | Close current session, reset to default |
| `browserbase_stagehand_navigate` | `navigate.ts` | `page.goto(url)` |
| `browserbase_stagehand_act` | `act.ts` | Perform one atomic UI action via Stagehand `act()` |
| `browserbase_stagehand_extract` | `extract.ts` | Extract structured/text content via Stagehand `extract()` |
| `browserbase_stagehand_observe` | `observe.ts` | Locate interactive elements via Stagehand `observe()` |
| `browserbase_screenshot` | `screenshot.ts` | CDP full-page screenshot, Claude-vision-constrained resize, registered as MCP resource |
| `browserbase_stagehand_get_url` | `url.ts` | Return current page URL |
| `browserbase_stagehand_agent` | `agent.ts` | Autonomous multi-step task via Stagehand CUA mode (max 20 steps) |

**Key exported interface**: `Tool<Input>` (`src/tools/tool.ts:27-31`) is the contract every tool module conforms to: `{capability, schema:{name,description,inputSchema}, handle(context,params)=>Promise<ToolResult>}`. Consumers: `src/tools/index.ts` (aggregation), `src/context.ts:64` (`"handle" in tool` runtime duck-check before invocation), `src/index.ts:186` (`tool.schema.inputSchema instanceof z.ZodObject` runtime guard before `server.tool(...)` registration).

**Resource surface**: `ListResourcesRequestSchema`/`ReadResourceRequestSchema`/`ListResourceTemplatesRequestSchema` handlers registered in `src/index.ts:164-180`, delegating to `Context.listResources()`/`readResource()` → `src/mcp/resources.ts`. Only screenshot resources exist at runtime (`RESOURCE_TEMPLATES` and `RESOURCES` are always empty arrays — no templated resources are implemented despite the module scaffolding for them).

### 4. Key Abstractions

1. **`Context`** (`src/context.ts`) — request-scoped controller; owns one `SessionManager`; `run(tool, args)` is the single dispatch point catching all tool errors and normalizing them into `CallToolResult`; `currentSessionId` is a *getter* delegating to `SessionManager.getActiveSessionId()` specifically to prevent Context/SessionManager desync (documented at `context.ts:21-22`).

2. **`SessionManager`** (`src/sessionManager.ts`) — the largest and most complex file (530 lines). Manages `Map<string,BrowserSession>` keyed by internal session ID, distinguishing a mutex-protected "default session" (`defaultSessionCreationPromise` pattern at `sessionManager.ts:323-407` prevents concurrent double-creation) from user-supplied sessions. Implements stale-session detection (`pages.length === 0` check) and idempotent cleanup via a `cleaningUpSessions: Set<string>` guard (`sessionManager.ts:274-282`) to prevent double-close races.

3. **`Tool<Input>` / `defineTool`** (`src/tools/tool.ts`) — the tool-definition pattern: schema (zod) + `handle(context,params) → ToolResult`. `ToolResult.action` is a **deferred closure** — `handle()` returns `{action, waitForNetwork}` without executing side effects; `Context.run()` is what actually invokes `toolResult.action()` (`context.ts:67-68`). This defer-then-invoke split is the load-bearing convention across every tool file (all 9 tool implementations follow the identical `handle → return {action: async()=>{...}, waitForNetwork:false}` shape). Note: `defineTool` itself (an identity-function wrapper, `tool.ts:33-37`) is **never called** by any tool module — every tool constructs its object literal directly and type-annotates it (`const xTool: Tool<...> = {...}`), bypassing the helper that exists for that purpose.

4. **`Config`** (`config.d.ts`) — the single configuration type threaded through all 3 config-resolution paths (CLI cascade, Smithery zod schema, env-var fallback). `env: "LOCAL" | "BROWSERBASE"` is the central mode-switch that changes branching in `config.ts`, `index.ts`, and `sessionManager.ts` independently (3 separate gate implementations, see §2).

5. **`ServerList`** (`src/server.ts`) — minimal array-backed registry allowing multiple concurrent `Server` instances, needed because the HTTP/Streamable transport can host many concurrent sessions (each gets its own `Server` via `serverList.create()`), whereas stdio transport creates exactly one.

6. **Dead/unused abstractions** (documented so a future agent doesn't waste time tracing them): `StagehandSession` type (`types/types.ts:6-12`, 0 usages — `BrowserSession` is the type actually used by `SessionManager`), `mcp/sampling.ts` module in its entirety (`SAMPLING_CAPABILITY`, `SamplingMessage` — 0 importers anywhere in `src/`; the server's `capabilities` object in `index.ts:141-147` registers only `resources` and `tools`, never sampling), `sessionManagementTools` export (`tools/index.ts:32`, 0 importers), `RESOURCES`/`RESOURCE_TEMPLATES` (`mcp/resources.ts:8`, `index.ts:13` — always empty arrays; no templated-resource feature is implemented despite the scaffolding).

**Naming convention**: tool schema names are prefixed `browserbase_` even for LOCAL-mode-only usage (e.g. `browserbase_stagehand_navigate` runs identically in LOCAL mode) — a residual naming artifact from the pre-fork Browserbase-only codebase (see Findings, `[KNOW-CANDIDATE]`).

**Error-handling convention**: every tool's `action` closure wraps its body in `try { ... } catch (error) { const errorMsg = error instanceof Error ? error.message : String(error); throw new Error(...) }` — this exact 3-line pattern recurs verbatim in all 9 tool implementations (`navigate.ts:48-51`, `act.ts:56-59`, `extract.ts:50-53`, `observe.ts:53-56`, `screenshot.ts:124-127`, `url.ts:48-51`, `agent.ts:72-75`, plus both handlers in `session.ts`). `Context.run()` (`context.ts:94-104`) is the single terminal catch that converts any thrown error into `{content:[{type:"text",text:"Error: ..."}], isError:true}`.

### 5. Data Flow

**Config pipeline** (2 divergent paths — see §3): CLI flags → `configFromCLIOptions()` → `mergeConfig(defaultConfig, cliConfig)` [defaults < file/env < CLI-override precedence, `config.ts:54-55`] → env-var API-key backfill (`GEMINI_API_KEY`→`GOOGLE_API_KEY`→`OPENAI_API_KEY`→`ANTHROPIC_API_KEY`, `config.ts:58-64`) → LOCAL-mode-conditional dummy-key substitution with `console.warn` → final `Config` object passed to `createServerFunction`. **OR**: Smithery-injected config → zod `configSchema.refine()` validation (custom-model-requires-API-key rule, `index.ts:95-111`) → `env !== "LOCAL"` credential gate → `internalConfig: Config` cast.

**Session pipeline**: tool `handle(context, params)` → `context.getStagehand(sessionId)` → `SessionManager.getSession(sessionId, config)` → (if default + missing/stale) `ensureDefaultSessionInternal` mutex-guarded creation, or (if named) `browsers.get(sessionId)` with stale-check → `createStagehandInstance(config, params, sessionId)` branches on `config.env === "LOCAL"` to either launch local Playwright/Chromium (`localBrowserLaunchOptions`) or a Browserbase cloud session (`browserbaseSessionCreateParams` incl. proxies/viewport/context/advancedStealth) → returns `{page, sessionId, stagehand}` stored in `browsers: Map`.

**Screenshot pipeline**: `browserbase_screenshot` tool → CDP `Page.captureScreenshot` (base64 PNG) → `sharp` metadata read → conditional resize to satisfy Claude-vision constraints (≤1568px/edge, ≤1.15MP, computed via `Math.min` of 3 shrink ratios, `screenshot.ts:64-69`) → `registerScreenshot(sessionId, name, base64)` into the module-level `Map` in `mcp/resources.ts` → `server.notification({method:"notifications/resources/list_changed"})` → later retrievable via `readResource("screenshot://{name}")`. On session close, `clearScreenshotsForSession(sessionId)` purges the associated entries (`sessionManager.ts:296-304` calls this inside `closeBrowserGracefully`).

**Merge points identified**: (1) `mergeConfig` in `config.ts` (defaults/file/CLI cascade with special-cased deep-merge for `context` object, `config.ts:139-172`); (2) the LOCAL-mode gate re-applied independently at 3 sites (§2); (3) `pickDefined` helper (`config.ts:131-136`) strips `undefined` keys before merge so overrides don't clobber defaults with `undefined`.

---

## Grading Calculation

| Criterion | Grade | Midpoint % | Weight | Contribution |
|---|---|---|---|---|
| Package Structure | A | 95% | 30% | 28.5 |
| Layer Boundaries | A | 92% | 25% | 23.0 |
| Entry Points and API Surface | A | 95% | 20% | 19.0 |
| Key Abstractions | A | 93% | 15% | 13.95 |
| Data Flow | B | 85% | 10% | 8.5 |
| **Total** | | | | **92.95 → A** |

(Data Flow graded B rather than A: the two config-resolution paths were traced and documented, and the three merge points were identified, but the trace does not extend into third-party internals — e.g. exactly how `Stagehand.init()` itself consumes `localBrowserLaunchOptions` — which is out of scope per the audit instructions to "note external dependencies... rather than observing their internals," so full A-level "trace any config value from source to effect" is capped short of the SDK boundary.)

## Findings

### Strengths

- **Consistent tool-module shape**: all 9 tool implementations (`navigate`, `act`, `extract`, `observe`, `screenshot`, `url`, `agent`, plus 2 in `session.ts`) follow an identical `zod schema → handle(context,params) → {action: async closure, waitForNetwork}` structure with an identical try/catch error-wrapping idiom, verified by direct read of all 9 files.
- **Deferred-action pattern is structurally enforced**: `ToolResult.action` as a closure (not immediately executed) centralizes all side-effect invocation in `Context.run()` (`context.ts:67-68`), giving one place to reason about tool-execution error handling.
- **Session lifecycle races are explicitly guarded**: `defaultSessionCreationPromise` mutex (`sessionManager.ts:325-407`) and `cleaningUpSessions: Set` (`sessionManager.ts:274-282`) are named, commented defenses against concurrent-creation and double-cleanup races — this is the kind of evidence a `.know/scar-tissue.md` domain would want to cross-reference. `[KNOW-CANDIDATE]` the mutex/idempotent-cleanup pair in SessionManager is a design decision worth cross-referencing in a future scar-tissue.md if either race has ever actually fired in production.

### Weaknesses

- **LOCAL-mode credential gate duplicated 3x** rather than centralized: `index.ts:127` (`(config as any).env`, note the `any`-cast working around `configSchema` not declaring `env`), `config.ts:69`, and `sessionManager.ts:22` + `sessionManager.ts:184` (2 sites in the same file). A future change to the mode-gate logic (e.g. adding a third mode) requires touching 4 call sites across 3 files with no shared helper.
- **Two independent config-resolution code paths** (CLI-cascade via `resolveConfig`/`config.ts` vs. Smithery zod `configSchema` in `index.ts`) that must be kept in sync by hand — no shared validation function; the `(config as any).env` cast in `index.ts:127` is direct evidence the two paths' types have already drifted (`configSchema` has no `env` field, so the LOCAL-mode fix had to reach for `any`).
- **4 dead exports/modules confirmed via grep with zero other matches**: `src/mcp/sampling.ts` (entire module — `SAMPLING_CAPABILITY`, `SamplingMessage`, unconsumed anywhere in `src/`), `StagehandSession` type (`types/types.ts:6-12`), `sessionManagementTools` (`tools/index.ts:32`), `RESOURCES` (`mcp/resources.ts:8`, always `[]`). `defineTool` helper (`tools/tool.ts:33-37`) is also defined but never called — every tool constructs its object literal directly instead.
- **`server.json` appears stale relative to the fork**: it declares `"name": "io.github.browserbase/mcp-server-browserbase"`, `"version": "2.2.0"`, and lists only `BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID`/`GEMINI_API_KEY` env vars (no `STAGEHAND_ENV`, `CUA_MODEL`, `CUA_API_KEY`) — while `package.json` declares the fork identity `io.github.autom8y/mcp-stagehand` at version `1.0.0`, and `src/index.ts:138` hardcodes a third version string `"2.3.0"` for the `McpServer` constructor. Three different version strings (`1.0.0` in package.json, `2.2.0` in server.json, `2.3.0` in index.ts) across 3 files is a concrete, evidence-backed drift signal. `[KNOW-CANDIDATE]` server.json + hardcoded McpServer version in index.ts have not been updated to match the LOCAL-mode/CUA fork identity in package.json — worth a design-constraints.md or scar-tissue.md entry if a future release process trips on this.
- **3-node type-only import cycle** (`types/types.ts → tools/tool.ts → context.ts → types/types.ts`, all `import type`) — harmless at compile time (TS erases type-only imports) but would immediately become a real circular-require if any of the three files were split into a separate published package.

### Recommendations

1. **Centralize the LOCAL/BROWSERBASE mode gate** into a single exported helper (e.g. `isLocalMode(config): boolean` in `config.ts`, already informally duplicated as a local `const isLocalMode = config.env === "LOCAL"` in both `sessionManager.ts:17` and `sessionManager.ts:181`) and import it at all 4 current gate sites (`index.ts:127`, `config.ts:69`, `sessionManager.ts:22`, `sessionManager.ts:184`) to remove the `any`-cast in `index.ts:127` and prevent the two config paths from drifting further.
2. **Remove or explicitly mark-deprecated the 4 dead exports** identified above (`mcp/sampling.ts` in full, `StagehandSession`, `sessionManagementTools`, `RESOURCES`) — each was confirmed via direct grep with zero matches outside its own definition, so removal is low-risk and would shrink the surface a new agent has to reason about.
3. **Reconcile the 3 divergent version strings** (`package.json` 1.0.0, `server.json` 2.2.0, `src/index.ts:138` hardcoded "2.3.0") and the stale `server.json` package identity (`io.github.browserbase/...` vs. the fork's `io.github.autom8y/...`) before the next `mcp-name` / registry publish, scoped strictly to these 3 files.
4. **Either wire `defineTool` into actual use, or remove it** — it exists as unused scaffolding (`tools/tool.ts:33-37`) while all 9 tool files bypass it with a direct typed object-literal.

## Appendix: Evidence Details

- Import graph extracted verbatim via `grep -n "^import" src/*.ts src/mcp/*.ts src/tools/*.ts src/types/*.ts` (69 import lines across 19 files).
- Dead-export confirmation via targeted greps: `grep -rn "StagehandSession" src/` → 1 hit (definition only); `grep -rn "SAMPLING_CAPABILITY\|SamplingMessage" src/` → 2 hits (both in `mcp/sampling.ts` itself); `grep -rn "sessionManagementTools" src/ evals/` → 1 hit (definition only).
- Line counts via `wc -l ./src/*.ts ./src/mcp/*.ts ./src/tools/*.ts ./src/types/*.ts cli.js index.js` — total 2,329 lines across 19 TS files + 2 JS shims.
- Version-drift evidence: `package.json:2-3` (`1.0.0`), `server.json:11` (`2.2.0`), `src/index.ts:138` (`"2.3.0"`) read directly.
- Git HEAD at audit time: `660c686` ("fix(config): do not require BROWSERBASE_API_KEY in LOCAL mode"), confirming the 3-site duplication (§2, §Weaknesses) is the direct residue of that same commit's fix being applied ad hoc at each of the 3 gate sites rather than through a shared helper.
- No `.know/` directory existed at audit time — this is a from-scratch (FULL) generation; no staleness section applies.
