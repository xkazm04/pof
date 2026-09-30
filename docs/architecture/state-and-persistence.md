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
| `src/services/projectTransition.ts` | The one project-flip owner: enumerated triggers + ordered outgoing-project teardown |
| `src/lib/db.ts` | `getDb()` singleton — creates `~/.pof/pof.db`, WAL, all DDL |
| `src/lib/catalog-db.ts` | `catalog_lifecycle` + `catalog_entities` table helpers (pattern representative) |
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

**Completion ledger (`checklistCompletedAt`).** `checklistProgress` records THAT an item is done, never
WHEN, so it cannot drive a velocity. `setChecklistItem` / `toggleChecklistItem` stamp
`checklistCompletedAt[module][item] = Date.now()` on the first transition to done and remove the stamp on
un-done (pure helpers in `src/lib/roadmap/completion-ledger.ts`). It is held by the `project_progress` row
(`completed_json`, schema 5) as well as the `pof-modules` partialize: `saveProgress` sends it, the server
unions it with the stored ledger (`mergeLedgers`, earliest stamp wins) pruned to done items (un-done drops the
date server-side too), and `/api/checklist/complete` stamps `Date.now()` on a CLI completion (an item already
done keeps its first stamp or stays undated). `clearProgress` and a failed foreign load still empty the
in-memory copy, but a load now ADOPTS the server's stamps — merged with the local ones only when the memory
already belonged to this project — so a project switch no longer erases velocity history.

**One progress ledger (`src/lib/project-progress-db.ts`).** The only owner of the `project_progress` row;
`/api/project-progress`, `/api/checklist/complete` and `/api/recent-projects` are thin callers. The row id
is `progressRowId(path) = sha256(normalizeProjectId(path)).slice(0,16)` — equal to the old per-route hash for
every canonical spelling (no row is re-keyed), while `C:/x/PoF/` and `c:\x\pof` now share one row. A row
stored under the legacy hash of a non-canonical spelling (`legacyProgressRowId`) is still returned for that
spelling: `readProgress` projects it in, the next write copies it into the canonical row and records its id in
`folded_json` so it folds exactly once. The fold is lossless (a `true` is never overwritten by `false`,
earliest stamp wins) and the legacy row is never deleted or rewritten. `saveProgress` is the one merge
(per-key checklist, orphan-key migration on every write, ledger union, keep-or-replace for
health/verification/history); `markComplete` is the CLI's dated mark. The switcher's % is
`countAllChecklists` over `readProgress` (declared items only); `recent_projects.checklist_json` is only the
fallback for a project with no progress row. The health engine (`computeProjectHealth(..., ledger, now)`)
derives weekly velocity, the burn-up and milestone ETAs from these stamps only; done items without a stamp
are reported as `velocitySample.undated`, never bucketed, and with no dated completion `avgVelocity` and
every `predictedDate` are `null`. No series is simulated (the former seeded RNG is gone).

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

`switchProject` saves the current project to recents, hands the outgoing-project teardown to the
flip owner (`transitionProject({ kind: 'switch' })`, section 2b), touches the target's
`last_opened_at` in SQLite, restores target state, then calls `loadModuleProgress` for the target.
`resetProject(trigger = 'new' | 'delete')` runs the same teardown before clearing the identity. The
store does not import the CLI panel store or any other per-project cache.

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
this, a session stuck in `isRunning: true` would prevent any new dispatches. The transient
run-door fields `runPhase`/`runSeq` are reset to `'idle'`/`0` there too.

**Run lifecycle is written through one door** (`beginRun` / `settleRun` / `endRun`, wired by
`store/sessionRun.ts` `bindSessionRun`): `beginRun` clears the previous run's
`lastTaskSuccess`/`lastCallbackStatus` and bumps `runSeq`; `runPhase` is
`'running' → 'settling'` (stream ended, callback still settling — `isRunning` stays true) →
`'idle'`; `endRun(id, seq, outcome)` flips `isRunning` false and records the outcome in ONE
`set()`, ignoring a stale `seq`. `isRunning` stays a stored field kept in lockstep, so
selectors reading it are unchanged. See `prompts-and-cli.md` § callback truth.

`createSession` (line 77) enforces a soft cap of `MAX_SESSIONS = 8`. At cap, the least-recently-
active **idle** session is reused. Running sessions are never clobbered (`!s.isRunning` filter at
line 86).

#### `useCharacterBlueprintStore` (`src/stores/characterBlueprintStore.ts`)

Character Blueprint state under the `pof-character-feel-stack` key. Persisted keys (`partialize`):
`baseFeelPresetId`, `feelLayers` (the feel adjustment-layer stack, incl. the Property Inspector's
reserved `inspector-overrides` layer) and `bindingOverrides` — the Input tab's sparse
`action -> key` rebinds over `INPUT_BINDINGS`. The custom `merge` sanitizes every key on rehydration
(unknown preset -> default, `sanitizeLayers`, and `sanitizeBindingOverrides` drops unknown actions,
non-string keys and overrides equal to the default); `activeSubTab` is not persisted. Rebinds go
through `setBindingOverride` (the `rebindAction` swap rule; key groups such as the movement cluster
never swap) and every input surface — table, keyboard caps, legend, mouse, ability badges, the
Features `KeyboardMetric` — reads the one `useResolvedBindings()` value (pure
`resolveBindings` in `src/lib/character/input-bindings.ts`). "Apply to IMC_Default" only dispatches
a CLI task on an explicit click, gated off at defaults and while any key conflicts.

#### `useLabPipelineStore` (`src/components/layout-lab/labPipelineStore.ts`)

The `/layout` lab's per-step artifacts under the `pof-lab-pipeline` key. Its persist options live in
`src/components/layout-lab/labPipelinePersistence.ts` (`labPersistOptions`). **It persists the
OUTBOX, not the in-memory map:** server rows are re-fetched and re-hydrated whenever an entity is
opened, so `partialize` (`outboxOf`) writes every step EXCEPT one proven, by a server observation in
this session, to be an exact copy of the row just observed — `done`, `ueAssets` and `data`
INCLUDING the local-only `genHistory` canonically equal, no `error`, no `syncError` (`_provenance`
is excluded: the server stamps it on every write). `hydrateEntity`, `refreshEntity` and
`adoptServer` record each observation (`observeServerRow`); the proof is a `WeakMap` keyed by the
artifact object, so any later write un-proves the step, a rehydrated (or legacy full-mirror) blob is
unproven until a hydrate proves it, and neither the in-memory nor the persisted shape changes. Do
not swap in `isServerDerived` as the admission rule: it is true for an adopt that kept local
`genHistory`, for a never-synced produce whose `syncError` a newer server row cleared, and for
drifted content — all local-only work. The storage adapter (`quotaSafeLocalStorage`) never throws:
a refused write (quota) used to escape `set()` and skip the produce write-through; it is now
recorded in the non-persisted `persistError` and shown as one line in `ProduceLogPanel`.

#### `useCatalogStore` (`src/stores/catalogStore.ts`) — seed provenance

The lab's catalog entities under the `pof-catalog` key. **A persisted copy never shadows a code seed
by default:** it used to mirror all ~503 seeded entities and let every persisted copy win forever,
so a seed correction (Vael crit ×2.5, bestiary loot links 5→14) never reached a returning browser
and the lab previewed/graded content the server (`seededEntities`) no longer holds. `partialize`
(`persistableSeedState`, `src/lib/catalog/seedSync.ts`) writes only entities NOT byte-equal to
their code seed (server overlays, edits, `user-<slug>` rows) plus `seedHashes` (`catalog/id` → the
content hash of the seed each copy was written against; overlays `lifecycle`/`ueAssets`/
`lastTestResult`/`lastVerifiedAt` excluded) and the drafts. `merge` runs `planSeedMerge` per
entity in `canonSync`'s closed vocabulary: `fresh`/`follow` (untouched → code content, overlays
kept), `edited` (kept, silent), `conflict`/`unrecorded` (kept, ask), `local` (kept), `orphaned`
(untouched retired seed removed, edited one kept; both reported). Asking findings land in the
non-persisted `seedDrift` and render as `SeedDriftNotice` atop `CatalogTree`, answered in bulk by
`adoptShippedSeeds` (code wins, overlays kept) or `keepMine` (records the current seed hash, so the
copy reads `edited` until the code moves again). **Persist version stays 0** — no bump, no
`migrate`: a blob without `seedHashes` IS the legacy case (`unrecorded`, never auto-overwritten),
and zustand 5 discards a version-mismatched blob that has no `migrate`, so a bump would make a
revert silently drop local rows and browser-only drafts.

#### `useLootTuningStore` (`src/components/modules/core-engine/sub_loot/_shared/lootTuningStore.ts`)

The loot module's one tuned enemy->loot roster and its one gold-per-rarity table. It lives in memory only and is never persisted, so a tune is a what-if that writes no catalog row, DB row or UE file. It is module-level rather than component state because `LootTabPanels` mounts each tab under `AnimatePresence` keyed by the tab, and tab-local state would be lost on every tab switch. All state changes go through `dispatch(action)` into the pure `tunerReducer` (`_shared/bindingTuner.ts`: select / setField / setWeight / setGold / goalSeek / undo / reset). Inputs are clamped, the history is capped at 50, and undo on an empty history returns the same state. Every Core-tab loot surface reads this store: the header Enemy Source picker (the 22 bindings in tier optgroups), `BindingTuner`, `EnemyLootBindingSection` (simulated drops plus the C++ export) and `EVCalculator`, whose sell-value inputs write the shared gold table. Goal-seek solves against that same table (`solveWeightsForTargetEV`, then one-point integer refinement if the rounded weights miss the target). `rosterFindings` lints each binding against the peers of its **untuned** tier (`lootTierOf` in `src/lib/loot/economy.ts`, the same rule the catalog seed uses), so a drop-chance edit never moves the binding into a different peer group.

#### `useItemGenomeStore` (`src/stores/itemGenomeStore.ts`)

The Item DNA lab's genome library, mounted as the Item Catalog's **Item DNA** sub-tab (`sub_inventory/index.tsx` -> `dna-genome/ItemDNAGenomeEditor`) and also fed by the Genre Template Gallery's one-click imports. It persists to localStorage key `pof-item-genomes` (`genomes`, `selectedId`, `compareIds`, `breedParentA/B`; `merge` re-sanitizes every genome and drops stale ids). Breeding is the lab's one random operation, so it previews before it writes: `previewBreed()` rolls an offspring of the two parents into the **transient** `breedPreview` (excluded from `partialize`, so the persisted payload is unchanged) and touches neither `genomes` nor `selectedId`; `rerollBreed()` replaces it with a fresh roll; `keepBreed()` appends exactly the previewed genome and selects it; `discardBreed()` drops it. The child takes item type, rarity floor and mutation profile from the dominant parent `inheritGenomes` names (not `createGenome`'s `'Weapon'` default). A preview never outlives a parent it names: `deleteGenome` of a named parent, a parent change and `resetToPresets` all clear it. `breedSelected()` remains as preview + keep for callers that commit at once.

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

### 2b. Project-flip owner (`src/services/projectTransition.ts`)

Everything that must happen to the OUTGOING project when the open project changes lives in one
ordered list, `TEARDOWN_STEPS`, run by `transitionProject({ kind, from })`:
`save-outgoing-progress` → `cancel-auto-save` → `clear-module-progress` → `clear-cli-sessions` →
`cancel-open-session-log` (fire-and-forget) → `clear-activity-feed`.

- **Triggers** are enumerated: `PROJECT_FLIP_TRIGGERS = ['switch', 'new', 'delete']`. Each runs the
  full list. TopBar handlers call the store action only; they never clear a cache themselves.
- **Recorded exclusion**: `PROJECT_FLIP_EXCLUSIONS = ['rename']`. Rename changes `projectName`
  only and never rewrites `projectPath` (no folder moves on disk), so it runs no teardown.
- **Placement**: the owner sits below both the identity store (`projectStore` calls it) and the
  caches (it imports `cliPanelStore`, `activityFeedStore` and the bridge).
- **Isolation**: each step runs in its own try/catch. A throwing step is reported through
  `logger.warn` and the flip still completes. The synchronous steps finish before
  `transitionProject` returns, so `resetProject` can clear the identity immediately.
  `switchProject` awaits the returned promise (the outgoing save) before loading the target.
- **Adding a per-project cache** means adding one entry to `TEARDOWN_STEPS`. The activity feed is
  on the list because its events carry Fix prompts written for the project that was open.

---

### 3. SQLite Persistence Layer

**Single instance** at `~/.pof/pof.db` managed by `getDb()` in `src/lib/db.ts:11`. The singleton
is module-scoped (`let db: Database.Database | null`). On first call it: creates the `.pof/`
directory if missing, opens the database, sets `PRAGMA journal_mode = WAL`, then runs all `CREATE
TABLE IF NOT EXISTS` DDL (plus inline column-migration `ALTER TABLE` guards for schema evolution).

**Two migration shapes, in this order.** Prefer **additive**: a `PRAGMA table_info(...)` probe plus
`ALTER TABLE ... ADD COLUMN` for a new nullable column (the pattern used throughout `*-db.ts`).
SQLite cannot alter a `CHECK` constraint or drop `NOT NULL` in place, so widening either needs a
**table rebuild** — create the new shape under a `__rebuild` suffix, copy every row, count the copy
against the original *inside the same transaction* (a mismatch throws and rolls back, leaving the old
table untouched), then drop and rename. Gate it on the stored DDL from `sqlite_master` so a second
run is a no-op, and suspend `PRAGMA foreign_keys` around it (never inside the transaction — SQLite
ignores the change there). `migrateFindingsTable` in `game-director-db.ts` and
`migrateOccurrencesTable` in `regression-tracker.ts` are the reference implementations; both keep one
parameterised `CREATE TABLE` string so the rebuild cannot drift from the bootstrap DDL.

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
| `feature_matrix` | Per-module/feature implementation status + quality scores. Every row carries `source` (`review` = CLI review import · `verify` = UE5 auto-verify · `fix` = CLI fix PATCH · `seed` · `unknown` for legacy rows) and `last_reviewed_at`, stamped by every write path — the compliance engine reads these as evidence provenance, and a PATCH stamps `last_reviewed_at = now` + `source='fix'` (a dated but weaker-class assertion, since the actor that made the change is the one reporting it). `reviewedAt` on import is validated as ISO-8601 before any write. |
| `review_snapshots` | Point-in-time module health snapshots for trending. Captured only when a write actually changed rows; an identical-timestamp re-capture updates the row in place; retention bounded to 200/module (module-scoped prune, so a quiet module never loses its only point). `getReviewHistory` returns the RECENT window. |
| `eval_findings` | Module Scan findings. `resolved_at` (nullable, schema 4 — `SCHEMA_VERSION` bumped so existing DBs gain it) is the durable resolution: `PATCH /api/module-scan/import {moduleId, ids, resolved}` stamps or clears it (undo), and unknown ids come back in `missing`. `pass` is one of `EVAL_PASS_VOCABULARY` (`module-eval-prompts.ts`, the keys of `PASS_LABELS` — the only pass list; the route's zod enums, `ScanFinding.pass`, the callback hint and the Scan tab derive from it). db.ts still creates the older 3-pass `CHECK`, so the POST first runs `ensureEvalFindingsPassVocabulary` (`src/lib/evaluator/scan-findings-db.ts`, once per connection): a count-verified rebuild of the stored DDL with only the pass `CHECK` widened, which also re-creates the table's indexes/triggers (`DROP TABLE` drops them). `module_scans.finding_count` counts rows actually stored — `INSERT OR IGNORE` swallows a `CHECK` violation silently. |
| `module_scans` | One row per Module Scan run, **including a clean one** (`finding_count 0`), written in the same transaction as its findings: `scan_id`, `module_id`, `passes_json` (every pass the scan RAN, from the callback's `passes` staticField — any `EvalPass`, so the 4-pass default incl. ground-truth is accepted), `created_at`. `GET ?view=delta` reconciles the newest scan against the findings still unresolved before it with the pure `reconcileScan` (`src/lib/evaluator/scan-reconcile.ts`): new / persisting / cleared / notRescanned — a pass that did not run clears nothing. |
| `build_history` | Headless UBT build records |
| `recent_projects` | Project switcher history. The listed % is counted from the project's `project_progress` row (see the progress ledger above); its own `checklist_json` snapshot is only the fallback when no row exists. A new path takes `progressRowId` as its id; an already-listed path keeps its id. |
| `project_progress` | Full module state (checklist/health/verification/history) per project, keyed by `progressRowId`. Schema 5 added `completed_json` (the completion ledger, `{module: {item: epoch ms}}`) and `folded_json` (legacy non-canonical row ids already folded in) — additive, defaults `'{}'`/`'[]'`. Owned by `src/lib/project-progress-db.ts`. |
| `session_log` | Audit trail linking CLI sessions to modules and projects |
| `request_log` | Idempotency-key replay detection for import/mutation routes |
| `session_analytics` | Per-CLI-session prompt/outcome telemetry (analytics dashboard, insights, suggestions, Weekly Digest, Project Wrapped). `completed_at` is stored as ISO UTC; reporting periods are cut from it by one authority (see the note below). |
| `telemetry_snapshots` | Genre-evolution signal snapshots |
| `genre_suggestions` | Detected sub-genre suggestions (pending/accepted/dismissed) |
| `checklist_metadata` | Per-item priority and notes |
| `milestone_deadlines` | User-set target dates for deliverables |

> **Reporting windows.** Every "which day / week / month is this row" decision for the session
> ledger goes through `src/lib/analytics/report-window.ts`: `reportZone()` is the single declared
> accessor (the server process's resolved Intl zone = the operator's calendar in this single-user
> desktop app), and `dayKey` / `monthKey` / `weekKey` / `weekWindow` take the zone explicitly.
> Windows are half-open `[start, end)` cut at zone midnight (DST-safe), weeks are Monday-first, and
> calendar arithmetic runs on keys. `generateWeeklyDigest(ref?, zone?)` and
> `aggregateProjectWrapped(rows, now, zone?)` read every key from it and echo `zone` on the result
> (`periodEnd` is the exclusive next Monday). Nothing new is stored; tests pin an explicit zone.

> `session_analytics` / `telemetry_snapshots` / `genre_suggestions` were previously
> bootstrapped divergently (an unguarded per-call `CREATE TABLE` in `session-analytics-db.ts`
> and a memoized `initialized` flag in `telemetry-db.ts`). Their DDL now lives here; the
> consumer modules keep only the lightweight `ensureTables()` → `getDb()` guard shared with
> `session-log-db.ts`.

**`*-db.ts` pattern**: domain-specific helpers (e.g. `catalog-db.ts`, `pipeline-artifacts-db.ts`,
`visual-verification-db.ts`) call `getDb()` and run `CREATE TABLE IF NOT EXISTS` in a local
`ensureTable()` guard before every operation. They own row mapping (`rowToArtifact`, `rowToLifecycle`,
etc.) and expose typed CRUD functions. No ORM — raw prepared statements throughout.

**`catalog_entities`** (`src/lib/catalog-db.ts`, same `ensureTable()` guard) is the durable record
of a **user-created** catalog entity — keyed `(catalog_id, entity_id)` with `data` (the whole
`StoredCatalogEntity` as JSON), `source` (`'user' | 'one-shot' | 'ingest'`), `created_at` and `updated_at`.
An `'ingest'` row carries `entity.provenance` (`EntityProvenance`: source game, project, file, row and a
**per-row licence note**) — written by the legacy-game ingest chassis (`src/lib/catalog/ingest/`, see
`docs/research/legacy-game-ingest-spec.md`). **The payload must be JSON-safe:** `upsertEntity` stringifies it,
and a React component or `Map` survives as a hollow `{}` that still passes every presence check
(`ArchetypeConfig.icon` did exactly this until it became `iconKey` + `ARCHETYPE_ICONS`, 2026-09-22). `jsonUnsafeKeys`
(`src/lib/catalog/entityPayload.ts`) names such keys in a `logger.error` at the write. The route's accepted-source list is DERIVED from the union
(an exhaustive `Record<CatalogEntitySource, …>`), so widening the type cannot leave the API rejecting it.
Before it, the one-shot flow created a `draft-<catalog>-<ts>` entity in the browser store
(`catalogStore.addDraft`, persisted to `localStorage`) while writing its ~11 pipeline artifacts to
SQLite, so the server could never resolve the entity again: `seededEntities` missed it,
`listEntitySummaries` omitted it, the server `CheckerContext.has()` said false, and the
static-verify resolver returned `null` — **an L2 static gate could never run for user-created
content, so absence read as exemption.** `seededEntities` (`src/lib/catalog/seed.ts`) now returns
the **union** of the code seeds and these rows, with one-directional precedence: a persisted row
can never shadow a code seed (the walker, the drain and the judge all resolve the reviewed,
version-controlled definition), and a colliding id is reported by `entityCollisions` + a one-time
`logger.warn` rather than silently merged. Writes go through `POST /api/catalog-entities` (never a
direct client DB write, and a code-seed id is refused 409); the browser store is the cache, and a
draft the server did not accept is flagged `browserOnly` and rendered `BROWSER-ONLY` in the catalog
tree. `deleteEntity` returns the real `changes()` count, and the lab's discard calls
`DELETE /api/pipeline-artifacts` first so a discarded entity leaves no orphaned artifact rows.
Reads use an explicit column list (never `SELECT *`).
**The lab reads these rows back.** `usePersistedEntityHydration` (mounted in `LayoutLab`) calls
`GET /api/catalog-entities?all=1` once and merges the rows into the draft cache through the pure
`mergePersistedDrafts` (`src/lib/catalog/persistedHydration.ts`): a row never shadows a code seed,
a server row replaces a stale cached copy, and a browser-only draft the server does not know is kept.
Before it, the store's "cache of `catalog_entities`" was filled only by the same browser session's
`addDraft`, so a persisted entity from anywhere else was gate-resolvable and invisible. An `ingest`
row renders an **INGEST** tag in the tree with its provenance and licence note in the tooltip.

**`reference_wrappers` + `reference_ingest_runs`** (`src/lib/catalog/reference/wrappers-db.ts`,
injected `db` handle) hold ingested reference-game rows for the `/diablo` loop: each wrapper keeps
the RAW source record (`raw`, `raw_hash`, the reading `technique`) apart from its current projection
into a catalog entity (`projection`, `projection_hash`, `mapping_version`), so a mapping adjustment is
a counted re-projection rather than a re-read. `upsertWrappers` reports `created / rawChanged /
reprojected / unchanged` (the projection hash ignores `provenance.ingestedAt`, so an identical re-run
is `unchanged`); every run's summary (coverage, gaps, undecoded sentinels, unresolved links) is kept in
`reference_ingest_runs`. Promotion into `catalog_entities` (`source: 'ingest'`) is selective and refuses a
JSON-unsafe payload. The raw values are another studio's design data and live only in the local DB,
never in the repo. Consumers that need the reference's NUMBERS read the wrapper's `raw` row, not a
produced step artifact (a produced Stat Block's inner shape is unconstrained — /diablo W07 found 3
`damage` shapes in 5 rows): `reference/playerScale.ts` converts a monster's raw HP/damage/resistance to
PoF's scale through two named player anchors (hits-to-kill preserved both ways, a loss grade per field)
for the UE stat rows `scripts/diablo/stats.ts` writes, and `reference/behaviourScale.ts` derives each monster's walk speed and attack cadence from its animation frames plus its AI routine (engine-derived laws parsed from the diablo1 canon; an unmodelled routine is refused), applied as the per-entity `MoveSpeedOverride`/`AttackCooldownOverride` on the UE enemy; a table spec may also DERIVE (`reference/derive.ts`, D29): values computed at ingest from mapped columns plus engine-derived canon laws land in the projection as `data.derived` in the reference's own units (a missing input or an unmodelled routine is a declared gap), and the derivation's version — code revision plus the law texts it reads — is part of the mapping version so a law edit re-projects; `reference/spellLaw.ts` (W13, D33) does the same for a SPELL, whose damage/to-hit/cast timing are engine code, not data — per-spell damage laws plus one `d1-spell-cast-law`, evaluated for a named reference caster read from the class tables at seed time (`ingest.ts --seed-steps spellbook --root`), refusing an unstated number or level; `reference/familyHead.ts` derives a family head from
the mapped `data.artSet`; `reference/ueRoot.ts` gives each entity its gitignored `/Game/Diablo` folder,
disambiguating display names another source row also carries.

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

**Stored content hash** (2026-09-29, the follow-up above, done): `pipeline_artifacts.content_hash` is a
stored read model of `data` (`stepContentHash`). `upsertArtifact` stamps it in the same upsert; `ensureTable`
adds the column to an old-DDL DB and backfills every NULL or foreign-`CONTENT_HASH_SCHEME` row in one
transaction; the `artifacts_content_hash_invalidate` trigger NULLs the hash when a writer that bypasses the
door changes `data` without restamping (it compares values, `NEW.data IS NOT OLD.data`, so identical drain /
verify re-upserts keep the hash; the door restamps a hash the trigger NULLed on a `_provenance`-only
rewrite). `listArtifactVerdicts` reads verdicts without selecting `data` and re-hashes only NULL /
foreign-scheme rows (an unparseable blob yields no `contentHash`, never a hash of `{}`); `/summary` and
`/changes` read through it, wire shapes unchanged. Measured on a 1,679-row DB copy: whole-project summary
fan-out 212.6 ms -> 8.7 ms, 0 parity mismatches, one-time backfill 265 ms. Rollback:
`DROP TRIGGER IF EXISTS artifacts_content_hash_invalidate` (the nullable column is inert to old code).

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
`layout-lab/steps/shared/StepHistoryPanel.tsx` (loaded on demand, not on mount across ~342 steps). `POST {revisionId, dryRun: true}` is the compare-before-restore preview: the same read-only
`gradeArtifact` run and **no upsert** (nothing archived, no history slot spent), answering the RAW
`wouldStatus`/`wouldTier`/`wouldReason` the restore would persist; the panel shows it beside a
`revisionDiff.ts` field diff against the on-screen artifact.

**Dependency-injected variant** (`src/lib/visual-gen/asset-library-db.ts` — the local Asset Library
backing `audio-asset-db.ts`'s style): the helpers take an explicit `Database` argument so they can be
unit-tested against an in-memory DB (`new Database(':memory:')`), and a thin server-only
`library-db-conn.ts` binds them to the shared `getDb()` and guards schema creation once. Tables:
`asset_library` (every downloaded asset — source/category/license/tags/thumbnail, favorite flag,
`UNIQUE(source, assetId)` so re-downloads upsert), `asset_collections`, and `asset_collection_items`
(many-to-many membership, `ON DELETE CASCADE`). Surfaced as the **Library** tab in `AssetBrowserView`
(client store `useAssetLibraryStore`, instant search/filter via the pure `library-filter.ts`); every
`BrowsePanel` download is recorded here instead of vanishing into a one-shot `window.open`. Download opens
`VariantPicker`: the source's real format x resolution files with sizes (pure `download-variants.ts`;
ambientCG variants ride on the search row, Poly Haven's come from `GET /api/visual-gen/browse/files`, cached
per id). `downloadUrl` records the picked variant's main file, never the `api.polyhaven.com/files/<id>` JSON
listing (`isListingUrl`; `recordDownload` refuses one), since `libraryReference.ts` cites it into prompts as
already downloaded. Single files go to the browser as a direct download (a 1 GB zip never enters page memory);
multi-file sets are fetched one file at a time, glTF saved flat via `flattenGltfUris`.

**Audio persistence uses the same door** (`src/lib/audio-db-conn.ts`, 2026-09-30): `getAudioDb()` is
`getDb()` plus a one-time guard for `audio_sets` / `audio_assets` / `audio_gen_usage` (`createAudioAssetDb`)
and `audio_import_runs`; `audio-import-db.ts`, `api/audio-gen` and `api/audio-codegen` call it instead of
the three private `new Database(~/.pof/pof.db)` blocks they used to carry, which walked past `POF_DB_PATH`
and leaked every audio test fixture into the operator's DB. Clip bytes follow the DB: `resolveAudioDir(env)`
= `POF_AUDIO_DIR` else `audio/` beside `resolveDbPath(env)` (exported from `db.ts`), i.e. `~/.pof/audio` in
production and a temp dir under the vitest floor; asset rows keep paths relative to it. Ratchet:
`db-containment.test.ts` pins `src/lib/db.ts` as the ONLY non-test `new Database(` site.

**`headless_builds`** (the UBT build ledger: a row is written `queued` at enqueue, `running` before the spawn, then its result; history and health read settled rows only, see runtime-patterns "Headless UE builds") follows this same guard pattern but is
owned by `src/lib/ue5-bridge/build-pipeline.ts` (`ensureHeadlessBuildsTable()`) — the sole reader/writer —
**not** `db.ts`. `src/lib/ue5-bridge/build-health.ts` reads it to derive the
**Build Health & Trends** dashboard (Evaluator → *Build Health* tab, served by
`/api/ue5-bridge/build-health`): success rate, duration trend, slowest targets, recurring error
fingerprints, and rolling-baseline regression alerts. Recurring errors come from the same project-scoped
rows' own `diagnostics_json` (selected only where `error_count > 0`), fingerprinted by the pure
`build-error-recurrence.ts` and judged resolved **per lane** (target | target type | configuration |
platform: still failing while the latest finished, parseable build of any lane it hit carries it) — not
from `error_memory`, which has no project column and which no build writes without a `moduleId`. When the
builds counted errors that carried no parseable diagnostic, the card says so instead of an all-clear.

**`ai_test_run_history`** (`src/lib/ai-testing-db.ts`, same `ensureAITestingTables()` guard, additive:
no existing column or row is touched; `ON DELETE CASCADE` from `ai_test_scenarios`) retains the AI
Testing Sandbox's per-scenario run outcomes, which every run used to overwrite in place. One row per
**(scenario, runId)** — `status` (`passed | failed | error`), `ran_at`, `definition_hash` (FNV-1a of
description + stimuli + expected actions as graded) and the head of the graded output. It is written by
**one door only**, `recordRunVerdicts(runId, ranAt, verdicts)`, which `POST record-run-results` calls
with the verdicts `deriveRunVerdicts` read from UE's `index.json` — so history holds report-graded
outcomes, never the CLI's claim. Grading the same run twice (callback + view close) upserts one row.
`updateScenario`, `bulkUpdateScenarioStatus` (dispatch `running`, the ungraded bulk `error` fallback) and a
client-set `status` never record a run. `getAllSuites` / `getSuite` attach the 8 newest as
`scenario.history` (`RUN_HISTORY_LIMIT`); the pure `src/lib/ai-testing/run-trend.ts` derives
`classifyTrend` (never-run | steady-pass | steady-fail | regressed | fixed, plus `afterEdit` when the
definition hash changed between the last two runs) and `summarizeTrends`, which drive the sandbox's
"Since last run: N regressed / N fixed" header, the per-card Regressed / Fixed chip + outcome strip and
the per-suite regression count. There is deliberately **no "flaky" kind**: the BT/C++ under test is not
fingerprinted, so a pass/fail flip on an unchanged scenario is the designer's break/fix loop, not
evidence of non-determinism. No `SCHEMA_VERSION` bump: that version gates `db.ts` migration probes, and
this table is a lazy `CREATE TABLE IF NOT EXISTS` with no probe.

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

The budget guard **echoes its enforced windows** (2026-09-29). `getBudgetStatus()` returns
`periods: { zone: 'UTC', day, month }` (half-open ISO instants) built by `budgetPeriods` in
`src/lib/cli-spend/budgetPreview.ts` from the same `report-window.ts` day/month keys it sums over, so the
period the UI shows IS the one `/api/cli-spend`, `judge-run` and `judge-one` enforce (the enforcer
dictates the zone: UTC, unlike the session ledger's reporting zone). The field is additive; no enforcement
reads it. The Budget guard uses it, with the dashboard's existing `daily` rollup, for two pure
derivations that store and send nothing: while editing, `previewDailyLimit` replays the typed daily limit
over the recorded active days ("exceeded on N of the last M active days; worst …") and `projectPeriod`
checks the typed monthly limit against this month's pace; in view mode `BudgetPace` shows the month
projected at the current run rate (refused under one elapsed day), the date it reaches the limit, and
the local time the UTC daily budget resets.

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
`unrun` / `stale` / `unscored` / `provisional` / `undersampled` (fewer than
`CALIBRATION_MIN_CONFIRMED` = 10 confirmed) are explicit not-proven standings, never a green, and
the guard fails the build only on `enforced-fail`. The seed targets in `CALIBRATION` stay
`provisional`; a target is confirmed only through the **calibration bench**: the operator labels the
artifact they are looking at (fail / placeholder / shippable) in the /status Evidence modal
(`CalibrationLabelBar`), and `POST /api/judge-calibration` stores it in the additive
`judge_calibration_labels` table (`src/lib/judge/calibration-labels-db.ts`, one row per
catalog/entity/step) bound through `currentStepBinding` to the artifact's `stepContentHash` and the
`RUBRIC_VERSION` in force — 400 when no artifact is on record, 409 when the content moved since the
modal opened. `GET /api/judge-calibration` resolves the measured set with the pure
`resolveCalibrationTargets` (`src/lib/judge/calibrationLabels.ts`): a label that still binds
confirms its target, a label whose content or rubric moved is `excluded` with its reason and never
counted, and `progress` counts confirmed labels by band toward the floor so a lopsided set shows.
`judge-run --calibrate` reads that route through `calibrationTargetsFromResponse` — no fallback to
the seed constant. The bar hides the judge's band for a target until a human label exists
(anti-anchoring). Nothing in acceptance or `statusModel` reads the label table: labels measure the
judge and never change a grade.

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
authoritative in the DB. That includes resolutions: `useScanTab`'s `fetchAndMergeFindings` REPLACES the
module's findings with the server's (a merge kept a stale active copy over a server-side resolution),
and every resolve path (row, Mark Selected, Resolve all, a verified fix, the ScanDelta
"Resolve N no longer found") goes through one `PATCH`. A scan this view dispatched shows as
`unrecorded` — never as an earlier scan's delta — when no scan newer than its dispatch was recorded.
**Fix & verify** (`src/lib/evaluator/scan-fix-verify.ts`): a fix run exiting 0 resolves nothing.
Batch and single-row Fix This both go through the fix session (a fix is not counted as a scan) and
mark each target `fixed` / `fix-failed` in `useScanTab`'s `fixVerification` (hook state, never
persisted). Only the operator's Verify click (`verifyFixes`) dispatches ONE module scan over the fixed
targets' passes naming exactly them; when its delta is recorded, targets it `cleared` are PATCHed
resolved, `persisting` ones stay open as `still-present`, and an `unrecorded` verification scan
resolves nothing (`status: 'unverified'` with the reason).

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

**Paid in-flight work the browser cannot keep lives in a server ledger, not a persisted store.**
The asset-forge queue (`useForgeStore`) is memory-only by design, so a Blender-MCP generation's
provider job id used to vanish on reload and the only recovery (Retry) paid again.
`src/lib/blender-mcp/generation-ledger.ts` is a `globalThis`-anchored in-process map (the
visual-gen `*-job-store.ts` idiom) of `{ jobId, provider, prompt, createdAt, state }` — ids and
state only, no credentials, no SQLite table. `POST /api/blender-mcp/generate` records, `/status`
moves state, `/import` runs once per job (`ledger.importOnce`: a repeat or concurrent caller is
answered from the ledger with `alreadyImported: true`), and `GET /api/blender-mcp/generate/jobs`
lists resumable jobs plus a per-process `ownerEpoch`. `GenerationQueue` calls `resumeMcpJobs()`
once on mount; a changed `ownerEpoch` (remembered per tab in sessionStorage) is shown as a server
restart rather than read as "nothing in flight". `reattachJob(id)` re-polls a transport-failed
job's same provider id for free; `retryJob` still submits a new, paid generation.

**A paid cloud Tripo task is recovered by its provider-side id, never re-bought.** Unlike the
MCP ledger, the handle needs no server memory: `tripo-job-store` records `providerTaskId` through
`runTripo`'s `onTaskCreated` hook the moment Tripo accepts the task, and `GET
/api/visual-gen/generate/status` projects it (plus `recoverable`) on every poll, so the forge job
keeps it even when a restart later 404s the job. An attempt whose task is still live (poll window
spent, unreadable polls - `isRecoverableTripoFailure`, not a Tripo `failed` verdict) stops the
best-of-N loop and errors `recoverable` instead of buying another task. `recoverJob(id)` (a click on
a `runnerRecoverable` card) POSTs `/api/visual-gen/generate/recover` `{ providerId, taskId,
assetClass }`; the dispatch entry's `recover` (tripo3d only - `RECOVERABLE_RUNNER_PROVIDERS` mirrors
it) starts `startTripoRecoveryJob`, which runs `awaitTripoTask` (GET `/task/{id}` + download, no
create, no upload) through the same Tier-1 gate and class face budget a fresh job gets, and 202s a
`jobId` on the same status poller.

**Feature done = `isFeatureDone`; plan dispatch = `usePlanDispatch`.** A feature-matrix status is
done when `isFeatureDone(status)` (`src/lib/feature-done.ts`, re-exported unchanged by `src/lib/constellation/layout.ts`: implemented OR improved) - the
one rule `generatePlan`, `unblockFrontier` and `moduleGraph` share, so the planner's `isReady` /
`unmetDeps` / `implementedCount` agree with the Dependencies tab. The plan's own Build lands as
`improved` (the feature-fix callback), so a planner counting only `implemented` could never advance.
Every plan dispatch (plan table, plan map, Dependencies Build) goes through `usePlanDispatch`
(`src/hooks/usePlanDispatch.ts`), only from an explicit click: `planDispatch(item, origin)`
(`plan-dispatch.ts`) refuses a not-ready item with `{ reason: 'blocked', unmet }` and creates no
task; a ready item runs as a feature-fix task via `useModuleCLI.execute`; `onComplete(true,
'confirmed')` calls `invalidateFeatureData()` so every plan view re-derives from fresh statuses
(`onSettled(item, landed)` lets a sequencer advance). The blocker and roll-up readers go through the
same module: `computeBlockers` (every blocked badge, so a Built dependency stops blocking), the NBA
engine's unblock claim, the Feature Matrix blocked chip, the Dependencies detail dot, and
`moduleCompletion` / `projectCompletionPct` for the Features tab, the Quality tab headline and cells,
and the Overview correlation `pctComplete` - one completion % across the three tabs. **Grade
effect:** the Summary health `coverage` term (`pctComplete`) and `dependencyHealth` term (blocked
count via `computeBlockers` -> `moduleGraph`) now count improved as done, so the gauge rises when a
Build lands; 'improved' is the Build callback's self-report, not a review. `feature-done-rule.test.ts`
pins the migrated files (no `=== 'implemented'` done-comparison, rule imported) and the re-export
identity. Left alone: 14 hand-rolled sites that already agree (implemented || improved) and
`gdd-synthesizer.ts` (implemented-only, out of that slice).

**Build session = one budgeted run through the same door.** `planBuildSession(statusMap, { budgetMinutes,
moduleId?, exclude? })` (`src/lib/implementation-planner/build-session.ts`) proposes steps greedily by
impact per estimated minute among ready features, re-deriving readiness (`isFeatureDone`) after each
pick so an in-session unlock (`unlockedBy`) is eligible; deselecting (`exclude`) drops a step and all
that waited on it, and `projected` is recomputed over the hypothetical statuses, never summed.
`useBuildSession` (ImplementationPlan) takes the page's `usePlanDispatch` door (relayed `onSettled`, so
still ONE CLI session): nothing dispatches until Start; each emitted step is re-read from the refreshed
statuses and dispatched only once ready; `advanceBuildSession` advances only on (success, 'confirmed')
and otherwise stops naming the step and why (also on operator Stop, a step still blocked after
`UI_TIMEOUTS.callbackSettleMax`, or a run not started within `callbackAwaitTimeout`).

**UI_TIMEOUTS is the single source for all timing constants.** Inline `setTimeout(fn, 3000)` or
similar literals are a lint target. Import `UI_TIMEOUTS` from `@/lib/constants`.

---

## See Also

- [Overview](overview.md)
- [Runtime Patterns](runtime-patterns.md)
- [SQLite↔UE data contract](../catalog/WIRING-AND-ACCEPTANCE.md)
