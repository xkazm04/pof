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
| `src/lib/api-utils.ts` | `apiSuccess`, `apiError`, `apiFetch`, `tryApiFetch` |
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

Minimal: `activeCategory`, `activeSubModule`, `sidebarMode`. All three fields are persisted
(no `partialize` override — the default persists everything). `navigateToModule` resolves whether
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
| `checklist_metadata` | Per-item priority and notes |
| `milestone_deadlines` | User-set target dates for deliverables |

**`*-db.ts` pattern**: domain-specific helpers (e.g. `catalog-db.ts`, `pipeline-artifacts-db.ts`,
`visual-verification-db.ts`) call `getDb()` and run `CREATE TABLE IF NOT EXISTS` in a local
`ensureTable()` guard before every operation. They own row mapping (`rowToArtifact`, `rowToLifecycle`,
etc.) and expose typed CRUD functions. No ORM — raw prepared statements throughout.

**`headless_builds`** (queued/running/completed UBT build jobs) follows this same guard pattern but is
owned by `src/lib/ue5-bridge/build-pipeline.ts` (`ensureHeadlessBuildsTable()`) — the sole reader/writer —
**not** `db.ts`. `src/lib/ue5-bridge/build-health.ts` reads it (+ joins `error_memory`) to derive the
**Build Health & Trends** dashboard (Evaluator → *Build Health* tab, served by
`/api/ue5-bridge/build-health`): success rate, duration trend, slowest targets, recurring error
fingerprints, and rolling-baseline regression alerts.

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

**Client side** (`src/lib/api-utils.ts:22,30`):
- `apiFetch<T>(url, init?)` — unwraps the envelope; **throws** `new Error(json.error)` on
  `success: false`. Use for fire-and-forget or places already inside try/catch.
- `tryApiFetch<T>(url, init?)` — returns `Result<T, string>`; never throws. Use when the caller
  needs to branch on success/failure without try/catch boilerplate.

**`useCRUD<T>(endpoint, initial, options?)`** (`src/hooks/useCRUD.ts:37`) — generic React hook
wrapping `apiFetch`. Provides `data`, `isLoading`, `error`, `refetch`/`retry`, and `mutate`. The
`mutate` helper calls `apiFetch` for the mutation then automatically calls `refetch`. A `mountedRef`
guards all state updates against setting state on unmounted components. Accepts an optional custom
`fetcher` override and `transform` for response mapping.

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
