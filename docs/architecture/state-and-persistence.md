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
| `src/lib/pipeline-artifacts-db.ts` | `pipeline_artifacts` + `pipeline_artifact_revisions` table helpers |
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

**`pipeline_artifact_revisions`** (`src/lib/pipeline-artifacts-db.ts`, same guard pattern) is the
version history behind `pipeline_artifacts`. The live table is keyed
`(catalog_id, entity_id, step)` and upserted, so before this every re-produce **destroyed** what a
step previously held — gallery steps survived because their candidate batches live inside
`data.genHistory`, but a static step's prior output was simply gone. `upsertArtifact` now archives
the row it is about to overwrite, but **only when `contentChanged`** (`data` / `ue_assets` differ):
a gate drain, `verify-static` and `verify-packaging` all re-upsert identical data with a new
verdict, and archiving those would bury the handful of real produce versions. History is bounded to
`MAX_REVISIONS` (20) per step, and each row keeps its own `updated_at` (when that version was
*written*) alongside `archived_at`.

**`GET /api/pipeline-artifacts/summary`** (2026-08-18) is the blob-free projection of the same rows —
`status`/`tier`/`reason`/`updatedAt` plus `contentHash` (`stepContentHash`, the judge binding) and
`driftHash` (`labContentHash`, the drift fingerprint), through the single `toStepSummary` projection in
`layout-lab/stepSummary.ts`. It exists for whole-project readers: the lab's cross-catalog coach reads
every registered catalog on first paint. Measured against the real DB (817 artifacts / 33 catalogs,
live server, warm, concurrency 6, median of 3) the full route answers that fan-out with **7.47 MB** of
produce bodies and this one with **191.5 KB** — a 39.9× reduction, and browser `JSON.parse` drops from
13.4 ms of main-thread work to under 1 ms with retained cache heap falling ~7.4 MB → ~190 KB.
**It is not a wall-time win on localhost** (157 ms → 202 ms): the projection computes two content
hashes the full route never computes, measured at 47 ms of canonicalization + FNV per pass. Persisting
those hashes as columns at write time would make it strictly better and is the recorded follow-up. A
route-level memo was deliberately rejected — the only available key (`updated_at`) has 1-second
resolution, so two writes in one second would serve a stale row, and silent staleness is worse than
47 ms. The summary is a projection, **never a second source of truth**: anything that grades still goes
through `resolveStepAcceptance`. `labArtifactCache` holds it as a second half sharing one listener set,
version signal and invalidation path. Known divergence, measured: a step existing only on the server
reports the persisted verdict rather than a client re-grade — 786 of 817 rows identical, all 31
differences in `items`, the one bespoke catalog the server cannot grade.

**`GET /api/pipeline-artifacts/changes?catalogId&since`** (2026-08-18) answers "what moved since I was
last here" from stored rows and archived versions ONLY. `revisionsSince > 0` is *proof* of a content
change, since a version is archived only when content differed; `0` means the row was written and
nothing more can be claimed — a verdict-only write archives nothing, and the digest says exactly that
rather than implying no change. `historyTruncated` marks a step at the `MAX_REVISIONS` cap, where the
count is a floor, and the row says so. The baseline is `LabPrefs.lastVisitByCatalog`, frozen per page
session by `hooks/useLastVisit.ts` so a visit cannot become its own baseline; a **missing baseline is
refused with a 400**, never treated as "everything changed".

Read + restore go through **`GET/POST /api/pipeline-artifacts/revisions`**. A restore is *not* a raw
copy: it re-runs the step's Checker via `gradeArtifact` exactly as the produce POST does, because an
archived verdict can be stale and trusting a stored `status` would re-open the fabricated-pass hole
that route closed. It returns `regraded` + `archivedStatus` so the UI can say when a restored version
did **not** come back with the verdict it was archived under. A restore is itself a content-changing
upsert, so the version it displaces is archived in turn — reverting is undoable. Surfaced per step by
`layout-lab/steps/shared/StepHistoryPanel.tsx` (loaded on demand, not on mount across ~342 steps).

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
`cli_service.ts` normalizes the result usage/cost via the pure `result-metrics.ts` (tolerant of both
the top-level `total_cost_usd`/`usage` and legacy nested `cost_usd`/`result.usage` shapes) and records
the row **server-side** (`recordExecutionSpend`, from the `emitEvent` choke point, once per execution)
so EVERY spawn is counted — interactive, queued, autonomous (one-shot propose/refine/step,
batch-review), and failed/aborted/synthetic runs — not just clean client results. Each row carries an
additive `status` column (`completed`|`failed`|`aborted`; idempotent ALTER-if-missing, legacy rows
default `completed`). Attribution `{ moduleId, taskType, taskLabel, sessionKey }` is threaded into the
spawn: the query route reads it from the dispatching session (`CompactTerminal.resolveAttribution`,
sourced from `cliPanelStore` `lastTaskType`/`lastTaskLabel` set by `useModuleCLI`), and the autonomous
routes pass their own `taskType`. The old client-side `recordCliSpend` path is removed — no
double-counting. The **Spend** tab (Evaluator) reads `getSpendDashboard()`: per-run / per-module /
per-task-type rollups, a daily trend, a daily/monthly **budget guard** (editable limits in
`cli_spend_budget`), and per-module ROI (spend ÷ checklist items completed). The pre-flight guardrail
(`src/lib/cli-spend/preflight.ts`, pure) reads `getTaskTypeEstimate`, which averages only
`status='completed' AND cost_usd>0` rows so failed/aborted zero-cost rows never bias the estimate; it
classifies expensive task types (live-editor runs + broad scans + the strict **judge** classes) and —
only under genuine budget pressure — interrupts `useModuleCLI.execute` with the global
`PreflightGuardDialog` (queued via `preflightStore`).

The **judge fleet** (`scripts/judge-run.ts`, `scripts/judge-one.ts`) reaches the same seam. Those
harnesses spawn the Claude CLI themselves (Opus/high per draw, one spawn per entity×step×median), so
until they were metered the Spend tab's total was structurally incomplete after any fleet run and no
budget could refuse one. They now run `--output-format json` and pass the parsed envelope through
`src/lib/judge/spendMeter.ts` (`parseCliJsonRun` → `judgeSpendRecord`) into `recordSpend` — module
`judge`, task type `judge-content`/`judge-visual`, one row per DRAW labelled
`catalog::step [entity] draw i/N`, so cost is attributable per run. `judgeBudgetGate` runs the same
`evaluatePreflight` engine before every step; because a headless harness has nobody to answer a
confirm dialog, a `warn` is a hard refusal (`--force-budget` overrides), checked again per step so a
budget crossed mid-fleet stops the remaining spawns. Spend is written direct to SQLite, adding no
dev-server coupling beyond the artifact/verdict fetches the harness already needs. A spawn whose cost
the CLI did not report is still recorded, labelled `(cost unreported by CLI)` rather than presented as
a measured $0.

A mid-run budget stop **drains, never kills** (2026-08-18). `runDrainPool` stops claiming new targets
and `drawJudge` refuses to start a further median draw, but spawns already in flight are awaited: a
draw's cost only arrives in the CLI's closing JSON envelope, so killing one burns the tokens *and*
makes them unmeasurable, and half-read stdout could parse into a partial verdict. A counted overshoot
beats an invisible one. The overshoot is bounded rather than merely reported — the drained width is
observed at claim boundaries and returned as `drainedAtStop` (measured: 12 post-stop draws before,
4 after, at concurrency 4 × median 3). The closing report (`summarizeJudgeSpend`) states spend against
the run's starting headroom (`judgeSpendCeiling`), or says plainly that no budget was configured so
the run had no ceiling to hold; it names any `CEILING EXCEEDED by $X`, the spend recorded *after* the
stop, and any `costKnown:false` spawns — which make the printed total a **floor**, not a measurement.

**Judge calibration** (`--calibrate` on `scripts/judge-run.ts`) measures the judge against the
human-labelled targets in `src/lib/judge/calibration.ts` without writing to `judge_verdicts` —
measuring the judge must not re-grade live content. Runs append to `~/.pof/judge-calibration.jsonl`
(override with `POF_JUDGE_CALIBRATION_PATH`), and `calibrationDrift()` compares consecutive runs.
`CALIBRATION_THRESHOLD` is 0.85 and enforcement is scoped to **non-provisional** labels only:
`unrun` / `stale` / `unscored` / `provisional` are explicit not-proven standings, never a green. As
shipped, all seeded targets are still `provisional`, so the standing reads UNCALIBRATED with 0
confirmed targets backing any rate — the module, the harness output and the guard all say so out
loud rather than implying an enforcement that no label yet supports.

`judge-run` also **plans before it spawns** (`src/lib/judge/fleetPlan.ts`, pure). It fetches the
catalog's stored verdicts alongside its artifacts and, per (entity, step, judge class), asks
`judgeSkipDecision` whether the standing verdict still binds: same `stepContentHash` **under the
current scheme** (`isComparableHash` first — a legacy/absent/older-scheme hash MUST re-judge) and the
same `RUBRIC_VERSION`. A bound verdict is SKIPPED with a printed reason (never on a timestamp, and
never silently — a skipped step must not read as a judged one); `--rejudge` forces the sweep. The
survivors run through `runPool` at `DEFAULT_JUDGE_CONCURRENCY` (4, the same ceiling
`deep-eval-engine.ts` uses — these are real CLI processes), results kept in input order so output
reads as the old serial loop did. Note that every verdict stored before the `content_hash` column
existed is NULL, so nothing skips until a fresh run stamps hashes: that is the conservative
behaviour, not a broken skip.

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

**`deepEvalStore` is the fast baseline cache; durable history lives in SQLite.**
`src/stores/deepEvalStore.ts` (localStorage `pof-deep-eval`) keeps only the *most recent* deep-eval
scan's findings so the next scan can be tagged new/resolved/persisting against it (see
`regression-diff.ts`) — do not accumulate scan history here. The **authoritative** history is the
`evaluator_results` table (`src/lib/evaluator/evaluator-results-db.ts`, one row per completed scan:
findings + module set + failed modules + timings + derived severity counts), written and read via
`/api/evaluator/results` (POST a completed scan; GET `?limit=N` history / `?latest=1` baseline).
`useDeepEvalResults` persists every completed scan there and **hydrates its baseline from the DB when
localStorage is empty** (fresh browser / cleared storage), so regression diffing survives re-scans,
reloads, and browser switches. This durable history is also what the Game Director's regression
tracker reads as a source (see below / `module-system.md`).

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
