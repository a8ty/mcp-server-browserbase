---
domain: scar-tissue
generated_at: "2026-07-26T13:19:02Z"
expires_after: "7d"
source_scope:
  - "./src/**/*.ts"
  - "./lib/**/*.ts"
  - "./package.json"
generator: theoros
source_hash: "973dffb9dd81eae830f20c4d090be820841c7c669b5e858ed99e87d22d2d03d4"
confidence: 0.85
format_version: "1.0"
update_mode: "full"
incremental_cycle: 0
max_incremental_cycles: 3
---

# Scar Tissue Knowledge Reference: mcp-server-browserbase

> Observation date: 2026-07-26 | HEAD: `660c686` | Repo: `mcp-server-browserbase`

## Scope and Method

Full repository (`src/**/*.ts`, 20 TypeScript source files). Evidence sources: `git log --oneline --all | grep -iE "fix|bug|regress|revert|hotfix|race|stale|leak|crash|hang|deadlock"` (79 matches on `--all`, cross-checked for ancestry to current HEAD), inline-comment scan for `CRITICAL|HACK|FIXME|BUG-|SCAR-|DEF-|WORKAROUND|race|stale|retry|guard|Note:` across `src/`, and `git merge-base --is-ancestor` checks to distinguish fixes that landed on the current branch from fixes authored on abandoned/unmerged sibling branches.

**No numbered `SCAR-NNN` markers exist anywhere in this codebase** (0 matches). All scars below are reconstructed from commit history + surrounding prose comments; there is no dedicated scar-catalog convention in this repo today.

---

## Scar Catalog

### SCAR-1: Concurrent default-session double-creation race

- **What failed**: Multiple concurrent tool calls (`ensureDefaultSessionInternal`) could each observe "no default session" and each launch a separate `createNewBrowserSession`, producing duplicate/leaked Stagehand instances.
- **Fix commit**: `927db9b` "race condition in cleanup + better JSDoc in config + dockerfile formatting" (2025-07-06); superseded/re-landed structurally in `d07db08` "fix session manager bugs" (2025-10-12) class-based SessionManager rewrite.
- **Current defensive mechanism**: `src/sessionManager.ts:128` — `private defaultSessionCreationPromise: Promise<BrowserSession> | null = null;` (comment at line 127: "Mutex to prevent race condition..."). Consumed at `src/sessionManager.ts:323-330`: if a creation promise is already in flight, subsequent callers `await` it instead of starting a new one, and the promise is cleared in a `finally` block at line 403.
- **Regression test**: **None.** `tests/` contains only `.gitkeep`; `package.json` has no `test` script. This scar has zero automated guard.
- **Category**: Race condition (concurrency).
- **Agent relevance**: Any agent modifying `ensureDefaultSessionInternal` or the `defaultSessionCreationPromise` field must preserve the "check-promise-first, else-set-mutex-then-clear-in-finally" shape — removing the `finally` clearing step reintroduces a permanent lock.

### SCAR-2: Idempotent-close race (double `stagehand.close()`)

- **What failed**: Concurrent calls to close/cleanup the same session (e.g., explicit `browserbase_session_close` racing with stale-session detection in `getSession`) could invoke `stagehand.close()` twice on the same underlying browser.
- **Fix lineage**: Same `d07db08` rewrite that introduced the class-based `SessionManager`.
- **Current defensive mechanism**: `src/sessionManager.ts:130` — `private cleaningUpSessions: Set<string> = new Set();`. Consumed in `closeBrowserGracefully` (`src/sessionManager.ts:269-319`): line 274 checks membership and short-circuits ("is already being cleaned up, skipping"); line 282 adds to the set before doing work; the `finally` block at line 315-318 always removes the ID.
- **Regression test**: None.
- **Category**: Race condition (concurrency).
- **Agent relevance**: Session-lifecycle agents must route all closes through `closeBrowserGracefully` — calling `session.stagehand.close()` directly reintroduces the double-close race.

### SCAR-3: Stale-session detection (dead pages not recreated)

- **What failed**: A default or named session's underlying browser/page could die while `SessionManager` still held a reference, causing subsequent tool calls to operate against a dead page.
- **Current defensive mechanism**: Liveness probe repeated at two call sites: `src/sessionManager.ts:341-346` (default, inside `ensureDefaultSessionInternal`) and `src/sessionManager.ts:443-448` (named, inside `getSession`). Both use `const pages = session.stagehand.context.pages(); if (!pages || pages.length === 0) throw ...`, caught to trigger `closeBrowserGracefully` + removal + recreation-on-next-access. Log evidence: line 350 ("is stale, recreating"), line 450 ("stale, removing").
- **Regression test**: None.
- **Category**: Integration failure (Stagehand/Playwright context desync).
- **Agent relevance**: Any new session-retrieval path must replicate the `pages.length === 0` probe or sessions will silently serve dead pages.

### SCAR-4: Default-session creation failure with no retry (hardened)

- **What failed**: A transient failure during default-session creation left the server unable to serve the default session for the rest of the process lifetime.
- **Fix commit**: `d07db08` "fix session manager bugs" (2025-10-12/10-16).
- **Current defensive mechanism**: `src/sessionManager.ts:363-405` — the mutex-wrapped creation IIFE retries exactly once on failure (lines 379-388: "Retrying creation of default session..."), only throwing a final wrapped error (lines 397-399) if the retry also fails.
- **Regression test**: None.
- **Category**: Integration failure / resilience.
- **Agent relevance**: Session-lifecycle agents should not assume "creation failed" is terminal after one throw — the retry is embedded inside `ensureDefaultSessionInternal`, not at the caller.

### SCAR-5: Context/SessionManager active-session-ID desync

- **What failed**: `Context` previously held its own copy of the "current session ID," which could drift from `SessionManager`'s view after a session was recreated/invalidated internally.
- **Current defensive mechanism**: `src/context.ts:23-25` — `public get currentSessionId(): string { return this.sessionManager.getActiveSessionId(); }`, a getter with **no backing field**. Documented at `src/context.ts:21-22` ("...to ensure synchronization / This prevents desync between Context and SessionManager session tracking") and cross-referenced at `src/sessionManager.ts:118-119`.
- **Regression test**: None.
- **Category**: Data corruption / state-consistency (in-memory desync).
- **Agent relevance**: Any refactor that reintroduces a `currentSessionId` field on `Context` (rather than a delegating getter) reintroduces this desync class. One-line but load-bearing architectural constraint.

### SCAR-6: Screenshot memory leak (session-scoped resources never purged)

- **What failed**: Screenshots taken via `browserbase_screenshot` were stored in a global `Map` (`src/mcp/resources.ts:14`) keyed only by name, with no association to session lifecycle — closing a session never freed its screenshots, so long-running servers accumulated unbounded base64 image data.
- **Fix commit**: `990a8b2` "fix: clear session screenshots in the mcp" (#120, 2025-09-25).
- **Current defensive mechanism**: `src/mcp/resources.ts:16-18` — a second map `sessionIdToScreenshotNames: Map<string, Set<string>>`; `registerScreenshot` (line 20-32) populates both maps; `clearScreenshotsForSession` (line 34-42) is called from `closeBrowserGracefully` (`src/sessionManager.ts:296-304`) immediately after a successful `stagehand.close()`, wrapped in its own try/catch so a purge failure doesn't block session teardown (WARN-logged).
- **Regression test**: None.
- **Category**: Performance cliff / resource leak.
- **Agent relevance**: Any new resource type registered per-session needs the same "purge-on-close, tolerate-purge-failure" pattern or it reintroduces this leak class.

### SCAR-7: LOCAL-mode credential gate — unconditional Browserbase key requirement

- **What failed**: `src/index.ts`'s Smithery entry-point threw unconditionally (`browserbaseApiKey is required` / `browserbaseProjectId is required`) even when `env === "LOCAL"`, where Stagehand drives a local Playwright browser and never calls Browserbase's cloud API.
- **Fix commit**: `660c686` "fix(config): do not require BROWSERBASE_API_KEY in LOCAL mode" (current HEAD, 2026-06-28).
- **Current defensive mechanism**: `src/index.ts:127-134` — `if ((config as any).env !== "LOCAL") { ...throws... }`. Note the `(config as any).env` cast at line 127: `configSchema` (`src/index.ts:22-111`) has **no `env` field defined at all**, so the cast is a structural workaround — the Smithery config schema and the internal `Config` type (`config.d.ts`) have diverged. Inline rationale at `src/index.ts:115-126` ("WS-F defensive gate", "OPERATOR NOTE").
- **Parallel/independent guard**: `src/sessionManager.ts:17-24` (`createStagehandInstance`) has its own separately-implemented `isLocalMode` gate; `createNewBrowserSession` has another at `src/sessionManager.ts:181-193`. Same guard-class implemented multiple times with no shared helper — a config-drift risk.
- **Regression test**: None.
- **Category**: Config drift / security-credential topology.
- **Agent relevance**: Any agent adding a new BROWSERBASE-mode-only startup validation must gate it identically on `config.env !== "LOCAL"` in **both** `src/index.ts` and `src/sessionManager.ts` — there is no single canonical gate function today.

### SCAR-8: `notifications/resources/list_changed` fired without `await` (ordering bug)

- **What failed**: `serverInstance.notification(...)` was called without `await` after registering a screenshot, risking out-of-order delivery relative to subsequent transport writes.
- **Fix commit**: `2c7ba02` "fix screenshot tool" (2025-12-09, merged via PR #141 / `5946678`).
- **Current defensive mechanism**: `src/tools/screenshot.ts:105-109` — `await serverInstance.notification({...})`.
- **Regression test**: None.
- **Category**: Integration failure (MCP transport ordering).
- **Agent relevance**: Any new `server.notification(...)` call site must be awaited.

### SCAR-9: Claude-vision image-size constraint handling (screenshot downscale)

- **What motivated**: Full-page CDP screenshots frequently exceed Claude's vision API image constraints (documented at `src/tools/screenshot.ts:56-57`: max 1568px on any edge AND max 1.15 megapixels), which would cause the image to be rejected or degraded.
- **Landed as**: `460a9c2` "feat: update screenshot tool ... use direct cdp calls and downscale image size for claude code" (#136) — feature-shaped but functionally a defensive fix for a real integration limit.
- **Current defensive mechanism**: `src/tools/screenshot.ts:58-90` — `sharp(imageBuffer).metadata()` read, then `shrink = Math.min(1568/width, 1568/height, sqrt(1.15MP/pixels))` (lines 65-69), only resizing when `shrink < 1` (line 72), preserving aspect ratio via `fit: "inside", withoutEnlargement: true` (lines 82-84).
- **Dependency-churn scar**: `sharp` was added in `114ab1c` (2025-11-17), required a Docker build change (`4083123` "switch node build to slim for sharp dep"), then **fully removed** in `901c4b7` "revert to old screenshot tool, remove sharp dep" (2025-11-20), then **re-added** in `460a9c2`. **Ancestry finding**: `114ab1c`, `4083123`, `901c4b7`, `82854ed`, `2a02524` are **NOT ancestors of current HEAD** (`git merge-base --is-ancestor` confirms) — that November 2025 screenshot saga happened on an abandoned branch; only `2c7ba02` (SCAR-8) and the later, independently-authored `460a9c2` made it into mainline.
- **Regression test**: None.
- **Category**: Integration failure / config-dependency drift.
- **Agent relevance**: `sharp` is load-bearing for the Claude-vision size constraint and has previously been removed-then-reinstated once already — removing it again without an equivalent resize mechanism reintroduces an oversized-image failure mode for Claude clients specifically.

### SCAR-10: 15-second force-exit watchdog on shutdown

- **What motivated**: Graceful shutdown (`SessionManager.closeAllSessions()`) could hang indefinitely if a browser process failed to terminate cleanly, leaving the MCP server process alive after the client disconnected.
- **Current defensive mechanism**: `src/program.ts:83-98` (`setupExitWatchdog`) — `setTimeout(() => process.exit(0), 15000)` is armed **before** awaiting `serverList.closeAll()` (line 85-88), guaranteeing exit within 15s regardless of cleanup outcome; cleanup errors are caught and logged (line 89-90). Wired to `process.stdin.on("close")`, `SIGINT`, `SIGTERM` (lines 95-97).
- **Fix lineage**: Hardened in `927db9b` (2025-07-06), which wrapped the original unguarded close sequence in `try/catch` + `Promise.all` (pre-fix version threw uncaught and could skip `process.exit(0)` on error).
- **Regression test**: None.
- **Category**: Performance cliff / hang prevention.
- **Agent relevance**: Any change to `setupExitWatchdog` must preserve the "arm timeout first, then attempt graceful close, tolerate close-errors" ordering — swapping the order reintroduces the original hang risk.

---

## KNOWN GAPS (searched-for, explicitly not found — evidence of absence)

1. **No regression-test suite of any kind.** `tests/` contains only `.gitkeep`; `package.json` `scripts` has no `test` entry. None of SCAR-1 through SCAR-10 has an automated guard.
2. **No `SCAR-NNN` / numbered-marker convention** anywhere in `src/`.
3. **No unified LOCAL-mode credential gate.** The `env !== "LOCAL"` check is implemented independently in `src/index.ts:127`, `src/sessionManager.ts:22`, and `src/sessionManager.ts:184` — three separate call sites, not one shared function.

## Candidate scar (unmerged fix — active regression risk, not yet landed on this branch)

**Model-family-unaware API key resolution** — `src/config.ts:58-63` resolves `modelApiKey` via a fixed precedence chain (`GEMINI_API_KEY || GOOGLE_API_KEY || OPENAI_API_KEY || ANTHROPIC_API_KEY`) with **no awareness of which provider family the configured `modelName` belongs to**. A sibling branch commit, `4fd2d10` "fix: model-family-aware API key resolution + STAGEHAND_MODEL_NAME env" (on `remotes/origin/fix/model-family-aware-key-resolution`, confirmed `NOT ancestor` of HEAD), fixes exactly this and adds a regression test (`tests/model-api-key-resolution.test.ts`, 5 cases). **This fix is not present on the current branch (`fix/local-mode-no-browserbase-key`, HEAD `660c686`).** Live bug today: an operator using a Gemini model who also has `ANTHROPIC_API_KEY` set — or vice versa — can silently receive the wrong provider's key, surfacing only as an `invalid x-api-key` error at tool-call time. A structurally similar (distinct, unfixed anywhere) instance exists in `src/tools/agent.ts:43-48`, whose CUA key chain (`CUA_API_KEY || ANTHROPIC_API_KEY || GEMINI_API_KEY || GOOGLE_API_KEY || GOOGLE_GENERATIVE_AI_API_KEY`) is Anthropic-first and safe only for the default `anthropic/claude-sonnet-4-6` CUA model — it would misroute for a Gemini-configured CUA model. `[KNOW-CANDIDATE]` novel cross-branch/cross-file observation not previously captured.

## Related open risk (gap surfaced by cross-reading SCAR-7's LOCAL-mode retrofit)

`src/tools/session.ts`'s `browserbase_session_create`/`browserbase_session_close` construct `new Browserbase({ apiKey: config.browserbaseApiKey })` (`src/tools/session.ts:79-81`) and call `bb.sessions.debug(browserbaseSessionId)` (`src/tools/session.ts:89`) **unconditionally**, with no `env === "LOCAL"` branch — unlike `SessionManager`, which does branch correctly (SCAR-7). In LOCAL mode this call would fail against the live Browserbase API. `[KNOW-CANDIDATE?]` Uncertain whether reachable in practice (LOCAL-mode users may not invoke `browserbase_session_create`), but a genuine code-path gap adjacent to a documented scar.

---

## Category Coverage Summary

| Category | Scars | Count |
|---|---|---|
| Race condition | SCAR-1, SCAR-2 | 2 |
| Integration failure | SCAR-3, SCAR-4, SCAR-8, SCAR-9 | 4 |
| Config drift | SCAR-7, (candidate: model-family API key) | 1 confirmed + 1 candidate |
| Data corruption (state desync) | SCAR-5 | 1 |
| Performance cliff / resource leak | SCAR-6, SCAR-10 | 2 |
| Security / credential topology | SCAR-7 (dual-tagged) | 1 |
| Schema evolution | *searched, not found* | 0 |

Six distinct categories represented. Schema-evolution scars were explicitly searched for (no DB/schema in this repo; MCP tool-schema Zod changes checked, none carry fix-commit evidence of a schema-migration failure) and not found.

## Fix-Location Index (file:function quick reference)

| Scar | File | Function/Location |
|---|---|---|
| SCAR-1 | `src/sessionManager.ts:128,323-330,403` | `ensureDefaultSessionInternal` |
| SCAR-2 | `src/sessionManager.ts:130,274-282,315-318` | `closeBrowserGracefully` |
| SCAR-3 | `src/sessionManager.ts:341-346,443-448` | `ensureDefaultSessionInternal`, `getSession` |
| SCAR-4 | `src/sessionManager.ts:363-405` | `ensureDefaultSessionInternal` (retry IIFE) |
| SCAR-5 | `src/context.ts:23-25` | `Context.currentSessionId` getter |
| SCAR-6 | `src/mcp/resources.ts:16-42`, `src/sessionManager.ts:296-304` | `registerScreenshot`/`clearScreenshotsForSession`, `closeBrowserGracefully` |
| SCAR-7 | `src/index.ts:127-134`, `src/sessionManager.ts:17-24,184-193` | Smithery entry gate, `createStagehandInstance`, `createNewBrowserSession` |
| SCAR-8 | `src/tools/screenshot.ts:105-109` | `handleScreenshot` |
| SCAR-9 | `src/tools/screenshot.ts:58-90` | `handleScreenshot` (sharp resize) |
| SCAR-10 | `src/program.ts:83-98` | `setupExitWatchdog` |

## Agent-Relevance Tagging

- **Session-lifecycle work** (`src/sessionManager.ts`, `src/context.ts`): must preserve SCAR-1 through SCAR-5's mutex/idempotency/desync-prevention shape — all five are instances of the same underlying hazard (concurrent/stateful session access) sharing one file.
- **Screenshot/resource-tool work** (`src/tools/screenshot.ts`, `src/mcp/resources.ts`): must preserve SCAR-6 (purge-on-close), SCAR-8 (await notification), SCAR-9 (Claude vision size constraint via sharp).
- **Config/credential work** (`src/config.ts`, `src/index.ts`, `src/sessionManager.ts` credential branches): must know SCAR-7's dual-implementation gap and the unmerged model-family-API-key fix (candidate). Most actively-churning area with the highest silent-config-drift risk.
- **Process-lifecycle/CLI work** (`src/program.ts`): must preserve SCAR-10's arm-before-await ordering.
- **Platform-wide**: total absence of a regression-test suite (all 10 scars) — any agent adding new session/tool logic is working without a safety net and should consider introducing the first test file.
