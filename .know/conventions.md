---
domain: conventions
generated_at: "2026-07-26T13:19:02Z"
expires_after: "7d"
source_scope:
  - "./src/**/*.ts"
  - "./lib/**/*.ts"
  - "./package.json"
generator: theoros
source_hash: "973dffb9dd81eae830f20c4d090be820841c7c669b5e858ed99e87d22d2d03d4"
confidence: 0.9
format_version: "1.0"
update_mode: "full"
incremental_cycle: 0
max_incremental_cycles: 3
---

## Domain Knowledge: conventions

**Scope observed**: all 19 files under `./src/**/*.ts`, plus `eslint.config.js`, `tsconfig.json`, `package.json`, `config.d.ts`, `index.d.ts`, `.gitignore`. `./tests/` contains only `.gitkeep` (no test files exist — test conventions are out of scope per this domain's cross-reference note and belong to `.know/test-coverage.md`).

---

### 1. Error Handling Style

**Creation**: The codebase uses **plain `new Error(message)`** exclusively. No custom `Error` subclasses, no sentinel error values, no error-code enums exist anywhere in the 19 source files (`grep -rn "class .*extends Error"` returns zero hits).

**Normalization idiom (canonical, zero exceptions)**: every catch site normalizes an unknown `error` the same way, in 11 distinct files (16 total occurrences):

```ts
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  throw new Error(`Failed to <verb>: ${errorMsg}`);
}
```

Verbatim instances: `src/tools/act.ts:56-58`, `src/tools/navigate.ts:48-50`, `src/tools/extract.ts:50-52`, `src/tools/observe.ts:53-55`, `src/tools/screenshot.ts:124-126`, `src/tools/agent.ts:72-74`, `src/tools/url.ts:48-50`, `src/tools/session.ts:109-117` and `:174-180` (two occurrences — create + close), `src/index.ts:195-197`, `src/context.ts:94-97`, `src/sessionManager.ts:255-263` (three occurrences across different failure sites). This is the single most consistent convention in the codebase.

**Propagation — a two-tier boundary**: every tool's `handle()` returns `{ action, waitForNetwork }` without executing anything (see Domain Idioms below); the actual work happens when `Context.run()` invokes `toolResult.action()` inside its own try/catch (`src/context.ts:57-105`). So an error thrown by a tool's inner catch (already prefixed `"Failed to X: ..."`) is caught a second time by `Context.run`'s outer catch, which converts it into the final MCP wire shape:

```ts
return { content: [{ type: "text", text: `Error: ${errorMessage}` }], isError: true };
```

An agent modifying a tool only needs to `throw new Error(...)` with a good message inside the inner catch — the outer boundary is not something tool authors need to touch.

**Boundary logging is NOT single-channel** — this is a real gap. Two conventions coexist without a documented rule for when to use which:
- `process.stderr.write(...)` with a bracketed component tag (`[SessionManager]`, `[tool.createSession]`, `[tool.closeSession]`, `[Smithery Error]`, `[Screenshot]`) — used in `src/index.ts`, `src/sessionManager.ts`, `src/tools/screenshot.ts`, `src/tools/session.ts` (38 occurrences fleet-wide).
- `console.error(...)` — used in `src/program.ts`, `src/transport.ts`, `src/context.ts`, `src/sessionManager.ts` (6 occurrences; note `sessionManager.ts` uses **both** conventions).

Only 5 tool files (`act.ts`, `navigate.ts`, `extract.ts`, `observe.ts`, `agent.ts`, `url.ts`) have zero logging at all — they only throw. This is worth flagging as an inconsistency, not just a gap.

**Criterion 1 Grade: A (95%)** — Creation, wrapping, propagation and (partial) boundary handling documented with 16+ file:line anchors across 11 files. Dual logging channel noted as the one real gap.

---

### 2. File Organization

**`src/tools/`** — one tool per file, one exception:
- `src/tools/act.ts`, `navigate.ts`, `extract.ts`, `observe.ts`, `screenshot.ts`, `url.ts`, `agent.ts` — each exports exactly one `Tool` object as `export default`.
- `src/tools/session.ts` is the **sole exception**: it defines two tools (`createSessionTool`, `closeSessionTool`) and default-exports them as an array (`session.ts:226`) — a deliberate grouping of the two session-lifecycle tools in one file rather than splitting.
- `src/tools/tool.ts` holds the shared contract types (`ToolSchema`, `InputType`, `ToolActionResult`, `ToolResult`, `Tool<Input>`) plus a `defineTool()` helper — the "types + contract" file for the module (analogous to a Go `types.go`).
- `src/tools/index.ts` is a barrel: imports every tool file, re-exports each individually, then assembles the `TOOLS` array and a `sessionManagementTools` alias (`src/tools/index.ts:1-32`).

**`src/mcp/`** — segregates concerns by MCP protocol capability, not by tool: `resources.ts` (Resources capability — screenshot registry + list/read handlers) and `sampling.ts` (Sampling capability — currently just type stubs, capability object is `{}`).

**`src/types/types.ts`** — cross-cutting shared types (`StagehandSession`, `CreateSessionParams`, `BrowserSession`, `MCPTool`, `MCPToolsArray`). **Duplication found**: `ToolActionResult` is defined independently in both `src/tools/tool.ts:17-20` and `src/types/types.ts:30-33` with identical shape — evidence of organizational drift rather than a single source of truth.

**Root `src/` level** (no `internal/`-equivalent boundary — TS/ESM has no package-private enforcement, so this is an accepted absence, not an anti-pattern): `config.ts` (resolution/merge logic), `context.ts` (the `Context` controller class), `sessionManager.ts` (`SessionManager` class + `createStagehandInstance` factory function co-located), `program.ts` (commander CLI entry), `server.ts` (`ServerList` registry, 27 lines), `transport.ts` (stdio/HTTP wiring), `index.ts` (Smithery-compatible default-export factory + `configSchema`).

**Public `.d.ts` surface lives at repo root, not `src/`**: `config.d.ts` and `index.d.ts` sit outside `tsconfig.json`'s `rootDir: "src"`, imported via relative `../config.d.ts` from every `src/*.ts` file that needs `Config`. This is intentional — `package.json`'s `"files"` array (`package.json:22-30`) ships them alongside `dist/` as the published API surface.

**Import style**: 100% of relative imports use explicit `.js` extensions (38 occurrences, e.g. `import type { Tool, ToolSchema, ToolResult } from "./tool.js";`) — required by `tsconfig.json`'s `"module": "ESNext"` / `"moduleResolution": "bundler"` + `"type": "module"` in `package.json`.

**Criterion 2 Grade: B (85%)** — Organization patterns documented across tools/, mcp/, types/, and root with file:line evidence. Docked for the `ToolActionResult` duplication and the unexplained `session.ts` multi-export exception (a real convention an agent could trip over).

---

### 3. Domain-Specific Idioms

**Deferred-action tool pattern (the core idiom, 9/9 tools)**: every tool's `handle(context, params): Promise<ToolResult>` does **not** execute logic — it builds and returns `{ action: async () => ToolActionResult, waitForNetwork: boolean }`. Actual execution happens later, in `Context.run` (`context.ts:67-68`) calling `toolResult.action()`. Notably, **every one of the 9 tools hardcodes `waitForNetwork: false`** (`act.ts:64`, `navigate.ts:56`, `extract.ts:58`, `observe.ts:61`, `screenshot.ts:132`, `session.ts:123` and `:216`, `url.ts:56`, `agent.ts:80`) — the field exists in the type contract but no live branch currently varies it. An agent should preserve the `{action, waitForNetwork}` shape for new tools even though `waitForNetwork` is currently inert.

**`defineTool()` is authored but unused**: `src/tools/tool.ts:33-37` exports a `defineTool<Input>(tool)` identity-function helper, but zero call sites exist across the 9 tool files — every tool instead writes a directly-typed const literal, e.g. `const actTool: Tool<typeof ActInputSchema> = {...}`. An agent should follow the **actual** pattern (typed literal), not the unused helper.

**Config three-tier cascade** (`config.ts:52-94`): `defaultConfig < file/CLI-derived config < explicit CLI overrides`, merged via generic `mergeConfig`/`pickDefined` helpers (`config.ts:131-173`) with special-cased deep-merge for the nested `context` object (`config.ts:148-153`).

**LOCAL/BROWSERBASE environment-mode gating**: a recurring `isLocalMode = config.env === "LOCAL"` guard appears in `config.ts:69`, `sessionManager.ts:17,181`, and `index.ts:127` — it toggles whether missing Browserbase credentials throw vs. warn-and-substitute a dummy value, and which Stagehand constructor branch executes. `index.ts:114-126` explicitly documents this as a deliberate "WS-F defensive gate" comment block — a named, intentional idiom, not incidental.

**Dual session-ID model**: an "internal tracking ID" (`browserbase_session_{contextId}_{timestamp}_{uuid}` for the default session, or a raw user-supplied string) is explicitly distinct from the "Browserbase session ID" returned by Stagehand once initialized (in LOCAL mode the internal ID doubles as the Browserbase-shaped ID). Documented in the module comment `sessionManager.ts:110-120` and enforced through parameter naming (`newSessionId` vs `resumeSessionId` vs `browserbaseSessionId`) in `createNewBrowserSession` (`sessionManager.ts:176-207`).

**MCP-UI type-escape hatch**: `session.ts:102-106` casts `createUIResource(...) as unknown as TextContent` to bridge the third-party `@mcp-ui/server` helper into the MCP SDK's stricter `TextContent` type — the only such double-cast in the codebase; a future agent adding UI resources should expect to repeat this cast, not fight it.

**Claude-vision-adaptive screenshot idiom**: `screenshot.ts:56-90` computes a `shrink` factor against three simultaneous constraints (1568px width, 1568px height, 1.15 megapixel budget) specifically to satisfy Claude's vision API limits — a non-obvious, hardcoded domain constant with an inline citation to Anthropic's docs (`screenshot.ts:57`).

**Uniform `capability` tag**: all 9 tools set `capability: "core"` (the type permits `"core" | string`, `tool.ts:28`, implying a future extension point that is not yet used anywhere).

**Criterion 3 Grade: A (95%)** — Seven distinct, non-obvious project idioms documented with file:line anchors and rationale, including one "idiom that isn't actually followed" (`defineTool`) that an agent must not mistake for the live convention.

---

### 4. Naming Patterns

**Fully consistent (0 exceptions, 9/9 tools each)**:
- Input schema: `{ToolName}InputSchema` — `ActInputSchema`, `NavigateInputSchema`, `ScreenshotInputSchema`, `GetUrlInputSchema`, `CreateSessionInputSchema`, `CloseSessionInputSchema`, etc.
- Tool metadata object: `{toolName}Schema` — `actSchema`, `navigateSchema`, `extractSchema`, `getUrlSchema`, `createSessionSchema`, etc.
- Tool export object: `{toolName}Tool` — `actTool`, `navigateTool`, `extractTool`, `getUrlTool`, `createSessionTool`, `agentTool`, etc.
- Handler function: `handle{ToolName}` — `handleAct`, `handleNavigate`, `handleExtract`, `handleCreateSession`, `handleGetUrl`, etc.

**Acronym convention (dual-rule, both applied consistently)**:
- In **type/interface names**, multi-letter acronyms stay ALL-CAPS as a prefix: `MCPTool`, `MCPToolsArray` (`types/types.ts:36-37`), `CLIOptions` (`config.ts:6`).
- In **variable/property names**, acronyms take a Capitalized tail: `sessionId`, `browserbaseSessionId`, `contextId`, `browserbaseApiKey`, `modelApiKey`, `cuaApiKey`, `currentUrl` — zero exceptions in project-authored code.
- **One inherited inconsistency**: `CreateSessionParams.browserbaseSessionID` (`types/types.ts:19`, also used at `sessionManager.ts:76`) uses full-caps `ID` — this mirrors the upstream `@browserbasehq/stagehand` SDK's own field name rather than the project's own `Id` convention. An agent should preserve this one field as-is (SDK contract) rather than "fixing" it to `browserbaseSessionId`.

**Real naming inconsistencies to flag (not to imitate)**:
- **MCP tool-name string convention breaks twice**: 7 of 9 tools follow `browserbase_stagehand_{verb}` (e.g. `browserbase_stagehand_act`, `browserbase_stagehand_get_url`, `browserbase_stagehand_agent` — `tools/act.ts:31`, `tools/url.ts:18`, `tools/agent.ts:27`). `browserbase_session_create` / `browserbase_session_close` (`session.ts:23-25`, `:139-141`) use `browserbase_{noun}_{verb}` instead. `browserbase_screenshot` (`screenshot.ts:21`) drops the `_stagehand_` infix entirely (likely because it uses raw CDP, not the Stagehand SDK method) — a new tool author should not assume a single template string.
- **File-name-to-tool-name mismatch**: the file is `url.ts` but the MCP tool name is `browserbase_stagehand_get_url` and the handler is `handleGetUrl` — file naming does not always mirror the full tool-name verb phrase.

**Criterion 4 Grade: A (90%)** — Constructor/schema/tool/handler naming rules documented with 9/9 compliance counts; the acronym dual-rule documented with its one SDK-inherited exception; two genuine tool-naming inconsistencies flagged by name so an agent doesn't propagate them.

---

## Grading Calculation

| Criterion | Grade | Midpoint | Weight | Weighted |
|---|---|---|---|---|
| Error Handling Style | A | 95% | 40% | 38.0 |
| File Organization | B | 85% | 30% | 25.5 |
| Domain-Specific Idioms | A | 95% | 15% | 14.25 |
| Naming Patterns | A | 90% | 15% | 13.5 |
| **Total** | | | | **91.25 → A** |

## Related

- Test conventions intentionally omitted here — `./tests/` contains only `.gitkeep`; see `.know/test-coverage.md` (owns the test domain, and should note the currently-empty test directory as a coverage gap).
- No `.sos/land/` experiential knowledge exists for this domain; this section is omitted per the invocation contract.
