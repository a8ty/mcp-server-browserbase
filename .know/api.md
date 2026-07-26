---
domain: api
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

## Domain Assessment: api

**Overall Grade: B** (83.1% criteria met)

**Audit Scope:** `src/**/*.ts` (`src/tools/*.ts` — 9 MCP tool definitions across 8 files; `src/mcp/resources.ts`, `src/mcp/sampling.ts`; `src/context.ts`, `src/sessionManager.ts`, `src/server.ts`, `src/transport.ts`, `src/program.ts`, `src/config.ts`, `src/index.ts`); config manifests `config.d.ts`, `smithery.yaml`, `server.json`; package manifest `package.json`
**Artifacts Evaluated:** 22 `.ts` files, 3 config/spec manifests, 0 pre-existing `.know/` files (fresh capture, no staleness comparison possible)
**Evaluation Date:** 2026-07-26

**Interpretation note (documented per audit protocol):** This project is not a conventional REST/gRPC service — it is an MCP (Model Context Protocol) server. No framework in the pinakes Framework Detection Table matches directly. I mapped the domain's vocabulary as follows: "routes" = the 9 registered MCP tools (the RPC-callable surface) plus the single HTTP transport path `/mcp`; "auth" = the credential model gating BROWSERBASE vs LOCAL mode and downstream provider API keys; "contracts" = the `CallToolResult` envelope and Zod input schemas; "cross-service dependencies" = the Browserbase cloud API, Stagehand SDK, and LLM provider APIs (Gemini/OpenAI/Anthropic); "spec" = `server.json` (MCP registry manifest, the closest analog to an OpenAPI spec) and `smithery.yaml`.

### Criteria Results

| Criterion | Grade | Evidence | Notes |
|-----------|-------|----------|-------|
| Route Inventory (30%) | A (93%) | 9 MCP tools cataloged across 8 files (`src/tools/{navigate,act,extract,observe,screenshot,session,url,agent}.ts`), plus 1 HTTP transport route (`/mcp` in `src/transport.ts:82`) and 2 transport modes (stdio `src/transport.ts:10-31`, streamable-HTTP `src/transport.ts:33-118`). All tools traced to registration site `src/tools/index.ts:21-30` and dispatch site `src/index.ts:185-212`. Handler locations, Zod input schemas, and description strings captured for every tool (see body table below). | Minor gap: response/output schemas are untyped (`content: (ImageContent\|TextContent)[]`) rather than per-tool Zod output schemas — this is a code-level gap, not a documentation gap, and is noted as such. |
| Authentication & Authorization Model (25%) | B (85%) | Two operating modes traced end-to-end: LOCAL (`STAGEHAND_ENV=LOCAL`, no Browserbase credential required, gate at `src/config.ts:69-84` / `src/index.ts:127-134`) vs BROWSERBASE (requires `browserbaseApiKey` + `browserbaseProjectId`, validated at 3 separate sites: `src/config.ts:69-81`, `src/index.ts:127-134`, `src/sessionManager.ts:183-193`). Model-provider auth (Gemini/OpenAI/Anthropic/CUA key fallback chain) traced at `src/config.ts:58-64`, `src/sessionManager.ts:26-32`, `src/tools/agent.ts:41-48`. No MCP-transport-level auth (the `/mcp` HTTP endpoint has zero authentication — any client reaching the port can invoke tools). | All 9 tools are uniformly "authenticated-by-session-context" (no route-level auth tiers exist — this is a single-tenant local/embedded server, not a multi-tenant API). No admin-only or public/private route split exists to classify. Recommendation below addresses the missing HTTP-transport auth as a discoverable gap. |
| Request/Response Contracts (20%) | B (82%) | Response envelope documented: `{content: (TextContent\|ImageContent)[], isError: boolean}` produced uniformly by `Context.run()` at `src/context.ts:57-105`. Error contract: caught exceptions become `{content:[{type:"text",text:"Error: {msg}"}], isError:true}` (`src/context.ts:94-104`) — no structured error code/field, just a text message. No pagination model exists (stateless single-shot tool calls). Field naming is camelCase throughout (`sessionId`, `browserbaseSessionId`). Content types: JSON-RPC over stdio/HTTP; screenshot resources use `image/png` MIME type (`src/mcp/resources.ts:58`). | Gap: error contract lacks a machine-parseable error code taxonomy (text-only), and there are no typed enums/constraints documented on output fields — this caps the grade at B rather than A. |
| Cross-Service Dependencies (15%) | B (84%) | Outbound dependencies mapped: (1) Browserbase Cloud API via `@browserbasehq/sdk` — session debug URL fetch at `src/tools/session.ts:79-90`; (2) Browserbase Cloud sessions via Stagehand's `browserbaseSessionCreateParams` at `src/sessionManager.ts:63-104`; (3) LLM provider APIs (Gemini default, OpenAI/Anthropic/Google fallback) instantiated per-session at `src/sessionManager.ts:26-32`; (4) CUA provider APIs (Anthropic default) at `src/tools/agent.ts:41-56`. Service discovery is purely env-var-driven (`BROWSERBASE_API_KEY`, `STAGEHAND_ENV`, `CUA_MODEL`, `GEMINI_API_KEY`, etc. — no service mesh/config file). No inbound webhook handlers exist (this server has no inbound push surface; it is invoked by an MCP client, which is documented as the sole "inbound consumer"). | Complete for outbound; inbound consumer is simply "an MCP client" (Claude Desktop, Smithery, etc.) with no further structural detail available in-repo to document beyond the transport contract already captured in Criterion 1. |
| Spec Completeness & Freshness (10%) | D (65%) | `server.json` exists (`server.json:1-77`) but is STALE: cites `name: "io.github.browserbase/mcp-server-browserbase"` and `version: "2.2.0"` while `package.json:2-10` declares `name: "@knossos/mcp-stagehand"`, `mcpName: "io.github.autom8y/mcp-stagehand"`, `version: "1.0.0"`, and `src/index.ts:138` declares runtime version `"2.3.0"` — three different version/name identities across 3 files. `server.json`'s `environment_variables` list (`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `GEMINI_API_KEY`) omits the newer LOCAL-mode / CUA env vars (`STAGEHAND_ENV`, `CUA_MODEL`, `CUA_API_KEY`, `HEADLESS`) introduced per the recent `feat: add LOCAL mode and Anthropic CUA support` commit (`a64b429`). `smithery.yaml` is a 1-line stub (`runtime: "typescript"`) with no route/tool inventory. | This is the weakest criterion: the closest thing to an OpenAPI-equivalent spec (`server.json`) has drifted materially from current code — 3-way name/version mismatch plus at least 4 undocumented env vars. |

**Weighted total**: (93×0.30) + (85×0.25) + (82×0.20) + (84×0.15) + (65×0.10) = 27.9 + 21.25 + 16.4 + 12.6 + 6.5 = **84.65 → B**

### Findings

#### Strengths

- **Complete, mechanically-verifiable tool inventory**: All 9 MCP tools are enumerable from a single export list (`src/tools/index.ts:21-30`) with zero indirection — no dynamic route registration, no reflection-based discovery needed. `[KNOW-CANDIDATE]` this is a durable structural fact useful for any future agent modifying tool registration.
- **Dual-mode credential gating is consistently enforced at 3 independent checkpoints**: `src/config.ts:69-81`, `src/index.ts:127-134`, `src/sessionManager.ts:183-193` all independently gate Browserbase credential requirement on `config.env !== "LOCAL"`. This defense-in-depth pattern (rather than a single central gate) is notable and was the subject of the current branch's fix commit (`660c686 fix(config): do not require BROWSERBASE_API_KEY in LOCAL mode`). `[KNOW-CANDIDATE]` this triple-checkpoint pattern is a load-bearing convention any future auth-mode change must update in 3 places, not 1.
- **Uniform response envelope across all 9 tools**: every tool handler routes through the single `Context.run()` method (`src/context.ts:57-105`), producing one consistent `CallToolResult` shape server-wide — there is no per-tool envelope divergence.

#### Weaknesses

- **Spec/code identity drift (3-way mismatch)**: `server.json` (`io.github.browserbase/mcp-server-browserbase`, v2.2.0), `package.json` (`@knossos/mcp-stagehand`, `mcpName: io.github.autom8y/mcp-stagehand`, v1.0.0), and `src/index.ts:138` (runtime-declared v2.3.0) present three different name/version identities for the same server. Any external registry consuming `server.json` would resolve to the wrong package name.
- **`server.json` env-var list is stale relative to LOCAL/CUA feature work**: missing `STAGEHAND_ENV`, `CUA_MODEL`, `CUA_API_KEY`, `HEADLESS` — all introduced by commit `a64b429` (`feat: add LOCAL mode and Anthropic CUA support`) and referenced live in `src/config.ts:29-48`, `src/program.ts:35-38`.
- **No authentication on the HTTP transport surface**: the `/mcp` streamable-HTTP endpoint (`src/transport.ts:82-83`) accepts any client that can reach the port — session IDs are the only access-control primitive (`mcp-session-id` header, `src/transport.ts:39-46`), and they are server-generated UUIDs with no binding to a caller identity. This is architecturally consistent with MCP's typical trust model (local stdio or same-trust-boundary HTTP) but is undocumented as an explicit security boundary anywhere in-repo.
- **Error contract is text-only, no structured error codes**: `Context.run()`'s catch block (`src/context.ts:94-104`) collapses all error types into a single `{content:[{type:"text",...}], isError:true}` shape — an agent cannot programmatically distinguish "session not found" from "Browserbase API key missing" without string-parsing.

#### Recommendations

1. **Reconcile the 3-way name/version mismatch** across `server.json`, `package.json`, and `src/index.ts:138` before the next npm/registry publish — pick one canonical identity string and version source.
2. **Regenerate or hand-update `server.json`'s `environment_variables` array** to include `STAGEHAND_ENV`, `CUA_MODEL`, `CUA_API_KEY`, and `HEADLESS`, matching the current `config.d.ts` surface.
3. **Document the HTTP-transport trust boundary explicitly** (e.g., in `src/transport.ts` header comment or README) — state that `/mcp` has no request-level authentication and is intended for same-trust-boundary deployment only, since this is a discoverable but currently undocumented security-relevant fact.

### Appendix: Evidence Details

**Tool inventory (Route Inventory criterion, full table):**

| Tool name | File:handler | Input schema fields |
|---|---|---|
| `browserbase_session_create` | `src/tools/session.ts:22-132` | `sessionId?: string` |
| `browserbase_session_close` | `src/tools/session.ts:137-224` | `{}` (no params) |
| `browserbase_stagehand_navigate` | `src/tools/navigate.ts:13-61` | (url string, per description at line 13-14) |
| `browserbase_stagehand_act` | `src/tools/act.ts:13-74` | `action: string`, `variables?: object` |
| `browserbase_stagehand_extract` | `src/tools/extract.ts:15-63` | `instruction: string` |
| `browserbase_stagehand_observe` | `src/tools/observe.ts:14-66` | `instruction: string` |
| `browserbase_screenshot` | `src/tools/screenshot.ts:14-137` | `name?: string` |
| `browserbase_stagehand_get_url` | `src/tools/url.ts:13-61` | `{}` (no params) |
| `browserbase_stagehand_agent` | `src/tools/agent.ts:15-90` | `prompt: string` |

Registration site: `src/tools/index.ts:21-30`. Dispatch/wiring site: `src/index.ts:185-212` (per-tool `server.tool(name, description, inputSchema.shape, handler)` binding, with a runtime guard rejecting non-`ZodObject` input schemas at `src/index.ts:186,207-211`).

**HTTP transport route**: single path `/mcp` (`src/transport.ts:82-83`), session-scoped via `mcp-session-id` header (`src/transport.ts:39-46`), POST-only for new sessions (`src/transport.ts:50-62`).
