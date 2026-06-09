# State Management, Persistence, and API Patterns

How PoF stores client-side state, persists it to SQLite, and communicates between
server and client through a uniform API envelope.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/stores/moduleStore.ts` | Checklist progress, verification, scan findings, module health/history |
| `src/stores/projectStore.ts` | Active project config, dynamic scan context, recent-projects list |
| `src/stores/navigationStore.ts` | Active category/sub-module, sidebar mode |
| `src/components/cli/store/cliPanelStore.ts` | Terminal sessions, tab order, inline-height preference |
| `src/services/ProjectModuleBridge.ts` | Runtime bridge that breaks the project↔module circular dep |
| `src/lib/db.ts` | `getDb()` singleton — creates `~/.pof/pof.db`, WAL, all DDL |
| `src/lib/catalog-db.ts` | `catalog_lifecycle` table helpers (pattern representative) |
| `src/lib/pipeline-artifacts-db.ts` | `pipeline_artifacts` table helpers |
| `src/lib/visual-verification-db.ts` | `visual_verifications` table helpers |
| `src/types/api.ts` | `ApiResponse<T>` discriminated-union envelope type |
| `src/lib/api-utils.ts` | `apiSuccess`, `apiError`, `respondFromResult` (Result→envelope), `withRoute` (route try/catch wrapper), `apiFetch`, `tryApiFetch` |
| `src/hooks/useCRUD.ts` | Generic fetch + mutate hook wrapping `apiFetch` |
| `src/types/result.ts` | `Result<T, E>` type + constructors |
| `src/lib/constants.ts` | `getAppOrigin`, `getOriginFromRequest`, `UI_TIMEOUTS` |
| `next.config.ts` | `serverExternalPackages: ['better-sqlite3']` |

---

## How It Works

### 1. Zustand Store Layer

All four stores use `zustand/middleware`'s `persist` with `createJSONStorage(() => localStorage)`.
Each store has a `partialize` selector that explicitly controls what reaches localStorage.

#### `useModuleStore` (`src/stores/moduleStore.ts:56`)

Owns per-module runtime state: `checklistProgress`, `checklistVerification`, `moduleHealth`,
`moduleHistory`, `quickActionsPanelCollapsed`, and `scanResults`.

Persisted keys (via `partialize` at line 222):
- `moduleHistory`, `moduleHealth`, `checklistProgress`, `checklistVerification`, `quickActionsPanelCollapsed`

**`scanResults` is explicitly excluded** from `partialize` (line 228 comment: "restored from DB
on mount via ScanTab's `fetchAndMergeFindings`"). It lives only in memory between reloads.

Every checklist mutation calls `scheduleAutoSave()` (imported from `ProjectModuleBridge`), which
debounces a 2-second write to SQLite via `saveProgress` → `POST /api/project-progress`.

`setChecklistItem` (line 112) returns `state` unchanged when the value is already equal, avoiding
a new object reference and unnecessary re-renders — the canonical no-op set pattern.

`addScanFindings` (line 143) deduplicates by `file::description` key and skips the update when
there are no novel findings (`if (novel.length === 0) return state`). Scan results are capped at
100 per module; history entries are capped at 200 per module.

The store registers itself with the bridge at module scope (line 235):
```ts
registerModuleStore(useModuleStore);
```

#### `useProjectStore` (`src/stores/projectStore.ts:61`)

Owns project identity (`projectName`, `projectPath`, `ueVersion`, `isSetupComplete`, `isNewProject`,
`setupStep`), the `dynamicContext` scan cache (5-minute freshness at line 59: `SCAN_CACHE_MS`),
transient scan runtime state (`isScanning`, `scanError`), and `recentProjects`.

Persisted keys (via `partialize` at line 282):
`projectName`, `projectPath`, `ueVersion`, `isSetupComplete`, `isNewProject`, `setupStep`,
`dynamicContext`.

**`isScanning`, `scanError`, and `recentProjects` are not persisted** — `recentProjects` is always
re-fetched from SQLite; `isScanning`/`scanError` are transient runtime state that must not survive
a reload.

`completeSetup` (line 79) auto-saves to recents and then branches: new projects call
`saveModuleProgress`, existing ones call `loadModuleProgress` — both delegated to the bridge.

`switchProject` (line 203) saves the current project, calls
`useCLIPanelStore.getState().clearAllSessions()` to prevent cross-project CLI leakage, cancels
open session-log entries, touches the target's `last_opened_at` in SQLite, restores target state,
then calls `loadModuleProgress` for the target.

The store registers itself at module scope (line 296):
```ts
registerProjectStore(useProjectStore);
```

#### `useNavigationStore` (`src/stores/navigationStore.ts:30`)

Minimal: `activeCategory`, `activeSubModule`, `sidebarMode`, and `l1Expanded` (whether the L1
icon rail is widened to show category labels inline — toggled via `toggleL1Expanded`). All fields
are persisted (no `partialize` override — the default persists everything). `navigateToModule` resolves whether
a given moduleId is a special-category ID (`project-setup`, `evaluator`, `game-director`) or a
regular sub-module, then sets `activeCategory`/`activeSubModule` accordingly.

#### `useCLIPanelStore` (`src/components/cli/store/cliPanelStore.ts:68`)

Owns terminal session objects, `tabOrder`, `activeTabId`, `maximizedTabId`, and
`inlineTerminalHeight`.

Persisted keys (via `partialize` at line 271):
`sessions`, `tabOrder`, `activeTabId`, `maximizedTabId`, `inlineTerminalHeight`.

**Custom `merge` resets transient session fields on rehydration** (line 278–289): after each page
reload, every persisted session has `isRunning`, `lastTaskSuccess`, `currentExecutionId`, and
`currentTaskId` reset to `false`/`null`. Sessions cannot be running after a page refresh — without
this, a session stuck in `isRunning: true` would prevent any new dispatches.

`createSession` (line 77) enforces a soft cap of `MAX_SESSIONS = 8`. At cap, the least-recently-
active **idle** session is reused. Running sessions are never clobbered (`!s.isRunning` filter at
line 86).

---

### 2. ProjectModuleBridge (`src/services/ProjectModuleBridge.ts`)

**Problem it solves**: `projectStore` needed to call `moduleStore.saveProgress/loadProgress`, while
`moduleStore` needed to read `projectStore.projectPath` for auto-save. A direct import cycle would
fail at module evaluation time.

**Solution**: neither store imports the other. Both import only the bridge. Each store calls
`registerModuleStore` / `registerProjectStore` at module scope, storing a late-bound reference.
At runtime the bridge resolves via `store.getState()` calls.

Exported surface:
- `saveModuleProgress(projectPath)` — called by `projectStore` on setup/reset/switch
- `loadModuleProgress(projectPath)` — called by `projectStore` on setup/switch
- `getChecklistProgress()` — snapshot read, used by `projectStore.saveToRecent`
- `scheduleAutoSave()` — called by `moduleStore` after every checklist mutation; restarts a
  `createTimerLifecycle` debounced 2 seconds (line 70–76)

---

### 3. SQLite Persistence Layer

**Single instance** at `~/.pof/pof.db` managed by `getDb()` in `src/lib/db.ts:11`. The singleton
is module-scoped (`let db: Database.Database | null`). On first call it: creates the `.pof/`
directory if missing, opens the database, sets `PRAGMA journal_mode = WAL`, then runs all `CREATE
TABLE IF NOT EXISTS` DDL (plus inline column-migration `ALTER TABLE` guards for schema evolution).

**`better-sqlite3` is externalized** in `next.config.ts:4`:
```ts
serverExternalPackages: ['better-sqlite3']
```
This tells Next.js not to bundle it — it is loaded natively by Node at runtime only (never in
the browser or edge runtime).

**Core tables created in `db.ts`** (partial list):

| Table | Purpose |
|-------|---------|
| `settings` | Key/value app settings |
| `feature_matrix` | Per-module/feature implementation status + quality scores |
| `review_snapshots` | Point-in-time module health snapshots for trending |
| `eval_findings` | Multi-pass deep-eval scan results |
| `build_history` | Headless UBT build records |
| `recent_projects` | Project switcher history |
| `project_progress` | Full module state (checklist/health/verification/history) per project path |
| `session_log` | Audit trail linking CLI sessions to modules and projects |
| `request_log` | Idempotency-key replay detection for import/mutation routes |
| `session_analytics` | Per-CLI-session prompt/outcome telemetry (analytics dashboard, insights, suggestions) |
| `telemetry_snapshots` | Genre-evolution signal snapshots |
| `genre_suggestions` | Detected sub-genre suggestions (pending/accepted/dismissed) |
| `checklist_metadata` | Per-item priority and notes |
| `milestone_deadlines` | User-set target dates for deliverables |

> `session_analytics` / `telemetry_snapshots` / `genre_suggestions` were previously
> bootstrapped divergently (an unguarded per-call `CREATE TABLE` in `session-analytics-db.ts`
> and a memoized `initialized` flag in `telemetry-db.ts`). Their DDL now lives here; the
> consumer modules keep only the lightweight `ensureTables()` → `getDb()` guard shared with
> `session-log-db.ts`.

**`*-db.ts` pattern**: domain-specific helpers (e.g. `catalog-db.ts`, `pipeline-artifacts-db.ts`,
`visual-verification-db.ts`) call `getDb()` and run `CREATE TABLE IF NOT EXISTS` in a local
`ensureTable()` guard before every operation. They own row mapping (`rowToArtifact`, `rowToLifecycle`,
etc.) and expose typed CRUD functions. No ORM — raw prepared statements throughout.

**Dependency-injected variant** (`src/lib/visual-gen/asset-library-db.ts` — the local Asset Library
backing `audio-asset-db.ts`'s style): the helpers take an explicit `Database` argument so they can be
unit-tested against an in-memory DB (`new Database(':memory:')`), and a thin server-only
`library-db-conn.ts` binds them to the shared `getDb()` and guards schema creation once. Tables:
`asset_library` (every downloaded asset — source/category/license/tags/thumbnail, favorite flag,
`UNIQUE(source, assetId)` so re-downloads upsert), `asset_collections`, and `asset_collection_items`
(many-to-many membership, `ON DELETE CASCADE`). Surfaced as the **Library** tab in `AssetBrowserView`
(client store `useAssetLibraryStore`, instant search/filter via the pure `library-filter.ts`); every
`BrowsePanel` download is recorded here instead of vanishing into a one-shot `window.open`.

**`headless_builds`** (queued/running/completed UBT build jobs) follows this same guard pattern but is
owned by `src/lib/ue5-bridge/build-pipeline.ts` (`ensureHeadlessBuildsTable()`) — the sole reader/writer —
**not** `db.ts`. `src/lib/ue5-bridge/build-health.ts` reads it (+ joins `error_memory`) to derive the
**Build Health & Trends** dashboard (Evaluator → *Build Health* tab, served by
`/api/ue5-bridge/build-health`): success rate, duration trend, slowest targets, recurring error
fingerprints, and rolling-baseline regression alerts.

**`cli_spend` + `cli_spend_budget`** (`src/lib/cli-spend-db.ts`, same guard pattern) capture the
token/cost `result` event every Claude Code CLI run emits — previously parsed but thrown away.
`cli_service.ts` now normalizes the result usage/cost via the pure `result-metrics.ts` (tolerant of
both the top-level `total_cost_usd`/`usage` and legacy nested `cost_usd`/`result.usage` shapes); the
terminal's `useTaskQueue` reports each run through a new `onResult` callback, and `CompactTerminal`
attributes it to the session's module + most-recently-dispatched task type (stored on `cliPanelStore`
as `lastTaskType`/`lastTaskLabel`, set by `useModuleCLI`) before POSTing to `/api/cli-spend`. The
**Spend** tab (Evaluator) reads `getSpendDashboard()`: per-run / per-module / per-task-type rollups, a
daily trend, a daily/monthly **budget guard** (editable limits in `cli_spend_budget`), and per-module
ROI (spend ÷ checklist items completed). The pre-flight guardrail (`src/lib/cli-spend/preflight.ts`,
pure) classifies expensive task types (live-editor runs + broad scans) and — only under genuine budget
pressure — interrupts `useModuleCLI.execute` with the global `PreflightGuardDialog` (queued via
`preflightStore`).

**`prompt_variants` + `prompt_ab_tests`** (`src/lib/prompt-evolution/evolution-db.ts`, same guard
pattern) make the Prompt Evolution engine durable. The engine (`prompt-evolution/engine.ts`) used to
keep variants and A/B tests in module-scoped `Map`s, so a server restart silently wiped every
experiment; it now delegates all variant/test storage to these two tables (template families remain
cheap in-memory derived data). `prompt_variants` carries the `parentId`/`mutationType` lineage plus an
`active` flag (exactly one current version per checklist item, enforced by `setActiveVariant`).
`getVersionHistory(moduleId, itemId)` projects this into a **version timeline**: a lineage forest, each
node annotated with its aggregated A/B success rate (computed across every test the variant joined), and
`restoreVariant(id)` is the one-click rollback that flips `active`. Surfaced as the Evaluator → Prompt
Evolution → **History** tab (`PromptVersionTimeline.tsx`): browse the tree, compare any two versions via
the shared `PromptDiffView`, and restore.

---

### 4. API Envelope

**Type** (`src/types/api.ts:2`):
```ts
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown }
```

**Server side** (`src/lib/api-utils.ts:8,13`):
- `apiSuccess<T>(data, status=200)` → `NextResponse.json({ success: true, data })`
- `apiError(message, status=500, details?)` → `NextResponse.json({ success: false, error, details? })`
- `respondFromResult(result, okStatus=200, errorStatus=502)` — collapses a `Result<T>` into the
  envelope: `ok` → `apiSuccess(data, okStatus)`, `err` → `apiError(error, errorStatus)`. Centralizes
  the upstream-error code routes delegating to a service would otherwise copy-paste; shape the success
  payload first with `mapResult` (e.g. `respondFromResult(mapResult(result, (assets) => ({ assets })))`).
  The blender-mcp routes are the reference adopters.
- `withRoute(handler, fallbackMessage)` — wraps a route handler so any **thrown** error becomes a
  logged `500` envelope (`logger.error` + `apiError(error.message ?? fallbackMessage, 500)`). Use it
  instead of hand-rolling the identical try/catch in every handler — the body stays the happy path
  plus its own validation (`apiError(..., 400)` short-circuits are returned, not thrown, so they pass
  through untouched). `export const GET = withRoute(async (req) => { … }, 'Failed to read X')`.

**Client side** (`src/lib/api-utils.ts:22,30`):
- `apiFetch<T>(url, init?)` — unwraps the envelope; **throws** `new Error(json.error)` on
  `success: false`. Use for fire-and-forget or places already inside try/catch.
- `tryApiFetch<T>(url, init?)` — returns `Result<T, string>`; never throws. Use when the caller
  needs to branch on success/failure without try/catch boilerplate.

**`useCRUD<T>(endpoint, initial, options?)`** (`src/hooks/useCRUD.ts:37`) — generic React hook
wrapping `apiFetch`. Provides `data`, `isLoading`, `error`, `refetch`/`retry`, and `mutate`. The
`mutate` helper calls `apiFetch` for the mutation then automatically calls `refetch`. The shared
`useIsMounted()` guard (below) protects all post-`await` state updates against setting state on
unmounted components. Accepts an optional custom `fetcher` override and `transform` for response
mapping.

**`useIsMounted()`** (`src/hooks/useIsMounted.ts`) — returns a stable `() => boolean` getter that
reports whether the calling component is still mounted. Guard a `setState` that runs after an
`await` with `if (isMounted()) …` to skip updates that resolve post-unmount. The getter identity is
stable across renders (safe to omit from dependency arrays) and re-arms on mount, so it stays
correct under StrictMode's double-invoke. This is the single source for the unmount-safety pattern —
`useCRUD`, `useDesignDocument`, `useGameDesignDoc`, `useSessionDashboard`, and the
RegressionTracker / WeeklyDigest / ProjectWrapped views all consume it instead of hand-rolling a
`mountedRef` + mount/unmount effect.

---

### 5. URL Construction

All client-side API calls use **relative URLs** (`/api/...`). The absolute-URL helpers are only
needed when embedding a callback URL in a CLI prompt or in a server-side route handler.

- `getAppOrigin()` (`src/lib/constants.ts:24`) — returns `window.location.origin` on the client;
  falls back to `http://localhost:${process.env.PORT || '3000'}` on the server.
- `getOriginFromRequest(request)` (`src/lib/constants.ts:35`) — derives the origin from the
  incoming request's `Host` + `x-forwarded-proto` headers; falls back to `getAppOrigin()`.

---

## Conventions and Gotchas

**Do not persist transient runtime state.** `isRunning`, `isScanning`, `scanError`, and execution
IDs must not appear in `partialize`. Persisting them causes snapshot instability on rehydration:
e.g. a session stuck `isRunning: true` after a crash blocks all future dispatches.
`cliPanelStore` handles this with a custom `merge` that resets those fields after rehydration
(`:278`); `projectStore` handles it by simply omitting them from `partialize` (`:282`).

**`scanResults` is memory-only.** It is excluded from `moduleStore`'s `partialize` and rebuilt
from the database on mount. Do not add it back to `partialize` — it can be large and is always
authoritative in the DB.

**`deepEvalStore` persists exactly one scan as a diff baseline.** `src/stores/deepEvalStore.ts`
(localStorage `pof-deep-eval`) keeps only the *most recent* deep-eval scan's findings so the next
scan can be tagged new/resolved/persisting against it (see `regression-diff.ts`). Only the single
latest scan is retained to bound localStorage size — do not accumulate scan history here.

**No-op set returns unchanged state.** `setChecklistItem` (`:112`) and several mutations in
`cliPanelStore` return the existing `state` object when no change is needed. This prevents Zustand
from notifying subscribers unnecessarily. Always mirror this pattern for conditional mutations.

**Bridge registration is synchronous and module-scoped.** Both stores call their `register*`
function at the bottom of their module file, before any React component can import them.
The bridge functions guard against null refs (`if (!moduleStore || !projectPath) return`) so
order-of-import races are safe.

**`better-sqlite3` is synchronous.** All DB helpers block the Node.js event loop. Keep queries
fast; avoid large scans in request handlers. WAL mode (`PRAGMA journal_mode = WAL`) allows
concurrent reads alongside a single writer without full-table locks.

**`*-db.ts` tables are lazily created.** `ensureTable()` is called on every access, not on app
startup. This means a table will be created on first use even if the app has been running for a
while. It also means `getDb()` in `db.ts` need not know about every domain table.

**`Result<T, E>` vs thrown errors.** Use `tryApiFetch` + `Result` for operations where the caller
must handle both paths (e.g. a form submit that shows an inline error). Use `apiFetch` (throws)
inside `useCRUD`'s `refetch` and anywhere already wrapped in try/catch.

**`useCRUD`'s `mutate` silently returns `null` on error** (`:84`) and logs via `console.error`.
If you need to surface the error to the user, use `apiFetch` directly or check the return value.

**UI_TIMEOUTS is the single source for all timing constants.** Inline `setTimeout(fn, 3000)` or
similar literals are a lint target. Import `UI_TIMEOUTS` from `@/lib/constants`.

---

## See Also

- [Overview](overview.md)
- [Runtime Patterns](runtime-patterns.md)
- [SQLite↔UE data contract](../catalog/WIRING-AND-ACCEPTANCE.md)
