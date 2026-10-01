# UI Shell — `/layout` Homepage & Composition Screen

The `/layout` lab is the production homepage of the PoF app. It is a full-screen catalog pipeline
studio: a Category→Catalog→Entity tree drives a vertical pipeline timeline, and each selected step
opens a work canvas whose produce output is persisted to SQLite and verified by a server-backed
rollup strip.

---

## Key files

| File | Role |
|------|------|
| `src/app/page.tsx` | Root page; `useSyncExternalStore(popstate, readShellPref)` switches between `NewHome` and `AppShell` |
| `src/lib/ecw/shell-pref.ts` | `readShellPref()` / `writeShellPref()` / `switchShell(to)` — a URL that names its shell (`?legacy=1` / `?legacy=0`) wins, else `localStorage['pof.shell']` |
| `src/lib/shell/shellRoute.ts` | The root page's ONE address codec (pure): `parseShellRoute(search, stored)` → `{ shell, moduleId }` (module validated against `SUB_MODULE_IDS` + the 3 special categories), `moduleHref(id)`, `shellUrl(href, shell, moduleId?)`, and the derived `MODULE_DESTINATIONS` (40 rows, registry labels) |
| `src/hooks/useShellRouteSync.ts` | Mounted in `AppShell`: keeps the legacy shell's open module and the address (`?legacy=1&module=<id>`) in step — deep link in, one history entry per module move, popstate re-applies |
| `src/components/layout-lab/NewHome.tsx` | Calls `usePofBridge()`, then gates: Blueprint `<SetupWizard />` when no project is loaded, else `<LayoutLab />` |
| `src/components/layout-lab/LayoutLab.tsx` | Top-level shell: 3-zone header bar (brand · centered Catalogs/Matrix/Canon/One-shot/Legacy actions · right-corner status + icon theme toggle), `<LabBridgeStrip>` |
| `src/components/layout-lab/labLocation.ts` (+ `hooks/useLabLocation.ts`) | The lab's ONE navigate door (pure): `LabLocation` (catalog · entity · step · view), `reduceLocation(loc, action)` → `{ loc, patch }` for `catalog`/`entity`/`step`/`view`/`open`, `resolveLocation` (phantom-entity reconcile + step clamp as a render derivation), `adoptPrefs` (the one-time restore). `useLabLocation()` holds it, adopts once, persists each action's patch, and consumes `pendingNavigation` |
| `src/lib/shell/labRoute.ts` (+ `layout-lab/hooks/useLabRouteSync.ts`) | The lab's address codec (pure, the lab half of `shellRoute.ts`): `parseLabRoute(search)` → `{ catalogId, entityId?, step?, view? }` (catalog validated against `CATALOG_SECTIONS` — an unknown one refuses the whole address; an unknown view is dropped), `labHref(route)` (`/?legacy=0&c=&e=&s=<step LABEL>&v=`), `labUrl(href, route)` (keeps the pathname, so `/layout` stays `/layout`). `useLabRouteSync(location, apply, universe?)` keeps the location and the address in step; `useLabAddress(loc, detail, nav)` is LayoutLab's binding |
| `src/components/layout-lab/Baseline/index.tsx` (+ `Baseline/useBaseline.ts`, `constants.ts`, `types.ts`) | 3-column composition screen: tree / pipeline timeline / work canvas. `index.tsx` is layout only; every produce→persist→render hook lives in `useBaseline.ts`. **Controlled** step position via `stepIdx` + `onSelectStep` (parent-owned so it survives view-toggle remounts); falls back to internal state when `onSelectStep` is omitted |
| `src/components/layout-lab/CatalogMatrix.tsx` | Catalog-wide status matrix: entities (rows) × steps (columns) colored by derived Acceptance; per-entity `summarizeEntity` rollup + blocker flags; cells jump to that entity's step. **Controlled** catalog dropdown (`catalogId` + `onSelectCatalog` write-through — no private `selected` fork). Header hosts the batch-drain action; every entity in the in-flight batch shows a left-accent + "draining…" badge (`drainState.activeEntityIds`). **Catalog-wide freshness (2026-08-18):** a `Refresh catalog` action composes the existing `refreshArtifacts(catalogId)` with the per-entity `refreshEntity` — one fetch path, one merge rule — and reconciles ONLY entities holding local state (reconciling every server-only entity would copy a whole catalog's produce bodies into the persisted localStorage store: ~0.5 MB for `items` against a ~5 MB quota). It reports what it re-read — adopted / removed / kept, naming local-only steps with `SERVER_MISSING_REASON` — rather than claiming "nothing changed", which it is in no position to assert. **Changed-since digest (2026-08-18):** above the legend, `CatalogChangesDigest` lists steps that moved since your last visit to this board, sourced only from stored rows + archived versions (see `GET /api/pipeline-artifacts/changes`); it states its own blind spots — a truncated history reads "at least N", a first visit reads "no baseline yet", a failed read reads "unknown, not nothing". **Regressions first (2026-10-01):** `labCatalogChanges.ts` classifies each row from the archived `priorStatus` only (`verdictShift`: regressed / improved / same / sideways / unknown) and ranks rows in that order (`rankChanges`). The headline counts "N stopped passing / N now pass", and each row states was/now in words with a glyph. "Work through N that stopped passing" opens `regressionQueue` through the board's `onOpenQueue` door. Jumps use the entity's OWN step index (`stepIndexResolver` over `MatrixRow.stepIndex`), never the catalog-wide list. The digest never changes a grade |
| `src/components/layout-lab/MatrixBatchDrain.tsx` | Matrix header action — "drain all deferred gates in this catalog" (shown only when ≥1 entity is deferred). **Executor truth (2026-09-04):** the lab sends no `executor`/`allowSpawn`, so `buildExecutors` always builds the BRIDGE executor — the drain runs THROUGH a running UE editor and never boots one. The button therefore discloses that requirement BEFORE the click from `usePofBridgeStore.connectionStatus` (the same read `LabBridgeStrip` uses) without ever disabling itself, the progress/cancel copy names the request rather than a boot, and a run where nothing executed (`ranNothing`: `ran===0` with skipped gates, and no lock/error) renders a first-class "0 gates ran — no UE executor was available" line instead of hiding the cause in a hover `title`. Plus a flips summary (passed/failed/still-deferred/locked) with per-step fail reasons, and an honest Cancel (skips the retry only — the request already sent can't be recalled). `ranNothing` lives in `entityDrainOutcome.ts` and the captured-frame thumbnails in `DrainFrameLinks.tsx`, both shared with the per-entity coach drain |
| `src/components/layout-lab/hooks/useBatchDrain.ts` | Batch-drain engine: sends the WHOLE deferred set in ONE request (`drainCatalogGates(catalogId, entityIds)`) — one server-side collection + one grouped runner pass over every gate (through the bridge executor — an already-running editor), not one request per entity. All-or-nothing lease: a 409 refuses the whole batch → retry once, then record every entity locked. Invalidates the whole-catalog cache on completion; cancel only skips the retry |
| `src/components/layout-lab/batchDrainModel.ts` | Pure batch-drain model: `DrainOutcome` (ok/locked/error) + `summarizeBatchDrain(entities, outcome)` — derives the catalog-wide flips summary from the single aggregate `DrainSummary` (groups per-step results back to their `job.entityId`; locked/error mark the whole set) |
| `src/components/layout-lab/CatalogTree.tsx` | Category→Catalog→Entity collapsible tree (left column) |
| `src/components/layout-lab/LabSearch.tsx` | Lab-wide search overlay (shared `ui/Modal`): finds any catalog, entity, or pipeline step by name/id and jumps through the shell's ONE navigate door (`nav.catalog` / `nav.open`, see `labLocation.ts`) — no parallel nav state. `useLabSearchShortcut()` binds ⌘/Ctrl+K and `/` (ignored while typing) |
| `src/components/layout-lab/entityPipeline.ts` | The lab's ONE per-entity step door: `toLabEntity` (the single stored→`LabEntity` constructor, wrapping `labIdentityOf` so `canonProfile` / `reference` are never dropped), `entityStepList(catalogId, entity, catalogSteps?)` (`stepScope.stepLabelsForProfile` over the catalog list — the list the rail renders and every `stepIndex` indexes), `resolveStepJump` (a step named by LABEL → the target entity's own index). Read by `useLabDetail`, `useGlobalCoach` / `globalCoachModel`, `useBaseline`, `LabSearch`, and the `resolveLocation` step clamp (`useLabLocation`) |
| `src/components/layout-lab/ui/SearchCombobox.tsx` | The shared type-ahead combobox behind BOTH lab search and `status/EntitySearch` (extracted from the latter): ARIA combobox + `aria-activedescendant`, ↓/↑ (wrapping) · Home/End · Enter · Escape, live-region hit count, stated `maxHits` cap, and "no match" vs "nothing loaded" empty states |
| `src/components/layout-lab/steps/index.ts` | `getStepComponent(catalogId, stepName)` — looks up the `STEP_REGISTRY` |
| `src/components/layout-lab/steps/ArchetypeStep.tsx` | Generic renderer for any registered `StepSpec`; drives View + CliProduce + Acceptance. **Fix honesty (2026-09-04):** `fixEffectOf` classifies what a one-click "⚡ Produce fix" can achieve (`reroll` / `first-produce` / `live-produce` / `no-op`) and the button is withheld for `no-op` — an already-produced step whose produce body is direction-blind and deterministic, where re-producing writes byte-identical data. The banner then carries `noopFixSuggestion`: what would change it, plus the derived direction as an input rather than an imminent dispatch. See docs/catalog/WIRING-AND-ACCEPTANCE.md |
| `src/components/layout-lab/NextStepCoach.tsx` | Compact single-row "what to do next" coach in the work canvas; primary CTA (jump / drain) + a disclosure that expands plain-language mode + summary. Scoped to the OPEN entity, ranked by the SHARED `coachLadder.ts` (fed `driftByStep` so it has a drift rung). For a fail/deferred next step it shows the concrete checker `reason` (via `reasonForStep`) instead of a generic hint; no reason available → the generic hint stays (never invented) |
| `src/components/layout-lab/GlobalCoach.tsx` | Lab-level, **cross-catalog** next-step coach shown above the Baseline view — highest-value moves across ALL catalogs (ranked by the SHARED `coachLadder.ts`). Collapsed to one row; the disclosure shows the top-`GLOBAL_COACH_TOP_N`, and a **"show all N blockers"** control reveals every remaining candidate (the cap is stated, never a silent truncation). Each row shows the concrete checker `reason` when one is carried (fail/deferred: artifact reason; drift: local-vs-server), else the generic hint. Clicking dispatches the one-shot `pendingNavigation` carrying the flagged **`stepIndex`** so Baseline opens ON that step. The passive `/status` map's active complement |
| `src/components/layout-lab/coachLadder.ts` | **The ONE priority ladder** both coaches rank through: `COACH_LADDER` (`fail > drift > pending > deferred > unproduced`, with the justification for that order), `COACH_PRIORITY_RANK`, `COACH_HINT`, `pickLadderIssue`. Changing the order here changes both coaches at once — they cannot drift apart |
| `src/components/layout-lab/globalCoachModel.ts` | Pure model for `GlobalCoach`: `pickEntityIssue` (alias of `pickLadderIssue`) / `rankCoachCandidates` / `buildCatalogCandidates` (ONE catalog — the memoizable unit) / `groupVerdictsByCatalog` / `buildGlobalCoach` = group + per-catalog + rank (reuses `deriveEntityArtifacts` — no new status logic). Candidates carry `stepIndex` + optional `reason`; `unproduced` (never-produced) ranks LAST, labelled honestly, so real in-flight work always outranks "start something new" |
| `src/components/layout-lab/hooks/useGlobalCoach.ts` | Aggregation hook: one deduped whole-catalog fetch per catalog via the shared cache, memoized on `useArtifactCacheVersion()` so the ranked list fills in progressively without a per-catalog hook. **Derives per catalog, not per fleet** — a module-scoped `catalogId → (deps-by-reference, candidates)` memo (`_resetGlobalCoachCache()` is the test seam) means a catalog is re-derived only when its OWN entities / artifacts / verdicts / local steps change, so a landing fetch or a produce in one catalog leaves the other 30 untouched. Returns the FULL ranked list; the top-N cut is `GlobalCoach`'s presentation decision |
| `src/components/layout-lab/LabBridgeStrip.tsx` | Compact UE bridge status dot+label; reads `usePofBridgeStore` (display-only) |
| `src/components/layout-lab/labPipelineStore.ts` | Zustand persisted store (`pof-lab-pipeline`); `produce/produceFrom/fail/clearError/setSyncError/resetEntity/hydrateEntity/adoptServer`; module-level `_labSync` function pointer. `produce`/`produceFrom` call `fail` themselves when a dispatch throws (then re-raise), so a failed produce always leaves an artifact-level `error` — recorded NON-destructively (previously produced content survives). Also `refreshEntity` — the EXPLICIT reconciliation that may adopt server content and drop a step the server no longer has (see "Refresh from server"), and the `serverSeen` provenance stamp that makes that safe |
| `src/components/layout-lab/ProduceErrorBanner.tsx` | Work-canvas banner for a step's recorded produce failure (`artifact.error`) + Dismiss (`clearError`). No retry button — the Produce panel below owns the prompt and already offers "Retry with same prompt" |
| `src/components/layout-lab/labArtifactClient.ts` | `fetchArtifactsResult` (`Result` — keeps the failure; what the cache reads), its lossy `fetchArtifacts` wrapper (`[]` on failure; NOT for /status — every /status tab reads the shared status evidence read instead: `status/statusArtifactSource.ts` `useStatusArtifacts([scope])`, blob-free summary rows via `labArtifactCache`, plus `status/statusVerdictSource.ts` `useStatusVerdicts`, one deduped judge-verdict read on the `useStepJudgeVerdicts` 60 s cache whose `readAllJudgeVerdicts` keeps the failure and never caches it; a failed read renders UNKNOWN / PARTIAL, never R0 or a verdict-less grade), `postArtifact`, `drainGates` (single entity, for the per-entity coach drain — returns the whole `DrainResponse`: `ok` with the full `DrainSummary`, `locked` carrying the server's 409 refusal reason, or `error`; it used to collapse every failure to `null`), and `drainCatalogGates(catalogId, entityIds)` (409-aware whole-catalog BATCH drain returning ok/locked/error) — thin wrappers around `/api/pipeline-artifacts` |
| `src/components/layout-lab/labArtifactCache.ts` | Shared artifact-fetch cache (`useCachedArtifacts`, `invalidateArtifacts`, `retryArtifacts`, `refreshArtifacts` — the user-initiated force-refetch that RETURNS the rows; nothing here polls) — one deduped fetch path + LOADING / EMPTY / **ERROR** states for Baseline + Matrix. A failed GET is stored as an explicit `error` (never as a successful empty load) and never auto-retries. Also exposes `getCachedArtifacts` (non-hook read) + `useArtifactCacheVersion` (change signal) for the cross-catalog coach aggregation. **Notifications are coalesced onto a microtask** (the store is still mutated synchronously, so a same-tick `getCachedArtifacts` sees the new truth) — the homepage fans out one fetch per catalog and each key emits at least twice, which used to wake every subscriber ~2N times per paint. All zero-data entries (empty / loading / error) share ONE `arts` array reference, so a consumer memoizing on `arts` pays nothing for the empty→loading flip, which carries no artifact news |
| `src/components/layout-lab/catalogManifest.ts` | Single per-catalog resolver over section · steps · grader · bespoke-UI (`resolveCatalogSteps`, `isBespokeCatalog`) |
| `src/components/layout-lab/matrixRows.ts` | `buildMatrixRows` — CatalogMatrix rows via the shared `deriveEntityArtifacts` path (one status code path with the rail). Blockers read the checker `reason` carried on each derived artifact (no second `resolveAccept` pass) |
| `src/components/layout-lab/matrixTriage.ts` · `workQueue.ts` · `MatrixTriageBar.tsx` · `WorkQueueStrip.tsx` | Matrix triage + work queue (see *Matrix triage + work queue* below): rank rows by the coach ladder, filter to a rung / a column's status, and walk the filtered set from the canvas with Next |
| `src/components/layout-lab/DriftBanner.tsx` | Server↔local drift banner + "adopt server truth" affordance (preserves `genHistory` unless confirmed) |
| `src/components/layout-lab/canonStore.ts` | Zustand store for project canon rules; seeded from `CANON_SEED`, refreshed from `/api/project-rules` |
| `src/components/layout-lab/theme.ts` | `LIGHT` (Blueprint) and `DARK` (Studio Dark) `LabTheme` tokens; `LAB_THEMES` array |
| `src/components/layout-lab/CanonView.tsx` | Full-screen canon rule editor (game / art / project categories) |

---

## How it works

### 1. Page entry — shell selection (`src/app/page.tsx` : 15–24)

```
useSyncExternalStore(
  popstate listener,         // subscribe
  readShellPref,             // client snapshot
  () => 'ecw'                // SSR snapshot (always 'ecw')
)
```

`readShellPref()` checks `?legacy=1` first, then `localStorage['pof.shell']`; everything else
resolves to `'ecw'`, which renders `<NewHome />`. The `?legacy=1` path renders `<AppShell />` (the
old 7-category sidebar shell). The "Legacy shell" button in `LayoutLab` calls `writeShellPref('legacy')`,
pushes the query param, and fires a synthetic `popstate` event so the store re-reads without a
full navigation. The reverse trip is symmetric: the legacy `TopBar`'s **"Blueprint"** button
(`NewShellButton`) calls `writeShellPref('ecw')`, deletes the `legacy` param, and fires `popstate`
to swap back to the lab.

**Addresses + Back.** Both switches now go through `switchShell(to)`: it first `replaceState`s the
CURRENT entry to name the shell it shows (`?legacy=0` in the lab; `?legacy=1&module=<id>` in the
legacy shell), then stores the preference, pushes the target entry and fires `popstate`. Because an
entry that names its shell beats the stored value in `parseShellRoute`, Back after a flip lands on
the shell that entry was — before, the lab entry carried no flag, the stored `'legacy'` won, and
Back was dead. A plain `/` still resolves by the stored preference (then `'ecw'`).

Inside the legacy shell `useShellRouteSync` treats the address as the location's public face (the
store stays the source of truth): on arrival a validated `module` param is applied through
`navigateToModule` (the one navigate door; an unknown id is dropped and the persisted location
stands), and the entry is `replaceState`d to name the visible module — arriving never pushes. A
module-to-module move pushes ONE entry. `popstate` re-applies the entry's module, and a location
that came FROM the address is never pushed back (the push is skipped whenever the address already
names the visible module), so Back/Forward cannot grow or truncate history. The location rides in
the URL, not `history.state`: Next's app-router patches `pushState`/`replaceState` to copy its own
`__NA` internals into plain calls, and a framework replace would erase anything state-held. The
destinations are derived from `SUB_MODULE_IDS`, so they vanish with the legacy shell
(`docs/catalog/LEGACY-SALVAGE.md`).

**Sub-location — the module's open tab is part of the navigation model.** `navigationStore` holds
`moduleTabs: Record<moduleId, tab>` next to `activeCategory`/`activeSubModule` (persisted with them).
`navigateToModule(id, { tab })` writes the module AND its tab in ONE `set` (no subscriber sees the
module without its tab); `setModuleTab(id, tab)` moves one module's tab without changing the active
module. Views read their own entry through `useModuleTab(moduleId, validTabs, fallback?)`
(`src/hooks/useModuleTab.ts`): a primitive selector, validated against that module's tab ids, so a
stale or foreign persisted tab falls back to the first valid one. `useReviewableModuleView` (the 23
Reviewable module views) uses it for its tab bar, so a jump addressed to one module never moves
another mounted LRU pane, and a jump written before the target pane mounts lands on its first
render. Producers: InlineTerminal's `navigate` suggestion resolves its target with
`tabJumpTarget(action, session.moduleId)` (`suggestionIntents.ts` — the action's module, else the
session's own) and Material Lab's "apply to editor" calls `setModuleTab('material-lab', 'editor')`.
This replaced the untargeted `window` `pof-navigate-tab` CustomEvent (it flipped every mounted pane
with a matching tab id and dropped jumps fired before the listener mounted); a ratchet in
`navigationStore.moduleTab.test.ts` keeps it out of `src/`. The remaining sub-tab vocabulary is
`useTabParam` (`src/hooks/useTabParam.ts`): the core-engine authoring shells (`sub_ability`,
`sub_character`, `sub_combat`) hold their inner sub-tab in a URL param, read once on mount — not yet
part of this model.

### 2. Bridge + project gate — `NewHome` (`src/components/layout-lab/NewHome.tsx`)

`NewHome` calls `usePofBridge()` at the correct React subtree root, then **gates on project
setup** the same way the legacy `AppShell` does: behind the Zustand persist hydration guard
(`useSyncExternalStore(() => () => {}, () => true, () => false)`), it renders the Blueprint
`<SetupWizard />` (now `data-theme="blueprint"` + `--lab-*` tokens) when `isSetupComplete` is
false, and `<LayoutLab />` once a project is loaded. The `/layout` route
(`src/app/layout/page.tsx`) renders `<LayoutLab />` directly and stays project-agnostic — it is
the entry the e2e catalog walker uses. Because the homepage `/` now gates, `e2e/global-setup.ts`
seeds a completed project into a Playwright `storageState` (wired via `playwright.config.ts`'s
`use.storageState`) and runs its identity-guard + warm-up against `/layout`, so every spec that
hits `/` still lands on the lab. Lab tests render `<LayoutLab />` directly and are unaffected.

### 3. Top-level shell — `LayoutLab` (`src/components/layout-lab/LayoutLab.tsx`)

Renders a `100vh` flex column:

- **Header bar**: a 3-zone flex (`flex:1` brand · `flex:0 0 auto` centered actions · `flex:1`
  right-aligned status) so the action group stays centered. Left zone: the `PoF·LAB sheet · <catalog>`
  brand label. Center zone: **Catalogs** / **Matrix** / **Canon** view toggle (local `view` state),
  **+ One-shot**, and the **Legacy shell** switch. Right zone (corner): `<ActivityChip t={theme} />` (the ONE "what is running
  right now" affordance — it replaced the old `RunnerChip` + `LabJobsChip` pair), `<LabBridgeStrip t={theme} />`, and the
  single-icon **theme toggle** (`ThemeToggle`, an `IconButton` showing Moon→Studio Dark /
  Sun→Blueprint; toggles `themeId`).
- **Navigation is ONE location behind ONE door (the lab never forgets)**: where the lab is —
  `catalogId`, `entityId`, pipeline `stepIdx` and `view` — is one `LabLocation` value owned by
  `useLabLocation()` (`hooks/useLabLocation.ts`) and changed only by dispatching a `LabNavAction`
  through the pure reducer in `labLocation.ts`. `reduceLocation(loc, action)` returns the next
  location AND the exact prefs patch that records it (`catalog` resets entity+step and persists
  those three; `entity` resets the step; `step` persists only `lastStepIdx`; `view` only
  `lastView`; `open` sets all four and lands on the Catalogs view). Because `AnimatePresence
  key={view}` remounts `Baseline` on every catalogs↔matrix↔canon toggle, holding the location in
  the shell is what makes it survive the swap. `open` is THE "take me to this entity's step"
  action: matrix cell and row, LabSearch hit, work-queue stop, `GlobalCoach` jump and the one-shot
  toast's "Open" all dispatch it, so none of them can move the location while leaving the Matrix
  or Canon view on screen (the toast/coach path used to). A jump is a plain dispatch consumed
  exactly once, so nothing replays stale. The stored location is adopted once after hydration
  (`adoptPrefs`, the one remaining render-phase bail-out).
  **Resolved, not reconciled:** `resolveLocation(loc, entities, stepCountOf)` derives in render
  the entity and step the canvas actually shows — an `entityId` that names nothing (a removed
  entity, or no pick yet) resolves to `entities[0]`, and a step index past the resolved entity's
  own list (`entityStepList`) resolves to 0. It returns the same object when nothing changes and
  never writes state or prefs (a render must not write localStorage). Every consumer — `Baseline`,
  `LabSearch`'s `currentEntityId` (so step-hit resolution never targets a phantom), the work queue
  and the `data-lab-entity` attribute on the lab root — reads the resolved location, so
  render-truth and location-truth stay checkable. The rules are pinned at the unit rung in
  `labLocation.test.ts`; the whole-shell suites (`LayoutLab.navigation` / `.openDoor` /
  `.entityStepClamp`) pin the wiring.
- **First paint tells the truth**: `GlobalCoach` renders from the FIRST paint. An empty candidate
  list is also the pre-fetch state, so returning `null` used to pop the bar in once data landed and
  shove the canvas down; `useGlobalCoach` now reports `loading` (any catalog neither loaded nor
  errored) and the bar reserves its row with the shared `ui/Skeleton` placeholder (`aria-busy`).
- **Body**: when `view === 'canon'` renders `<CanonView t={theme} />`; when `view === 'matrix'`
  renders `<CatalogMatrix … catalogId={catalogId} onSelectCatalog={nav.catalog} onOpenStep={nav.open} />`
  (the matrix dropdown is **controlled** — it writes through `onSelectCatalog` to the single-source
  `catalogId` instead of forking a private `selected`, so switching catalog in the matrix and then
  opening the Catalogs tab lands on the SAME catalog); otherwise renders
  `<Baseline … stepIdx={stepIdx} onSelectStep={nav.step} … />` (controlled step position; `Baseline`
  falls back to internal `stepIdx` only when `onSelectStep` is omitted, for direct-render tests),
  prefaced by `<GlobalCoach t={theme} />` (the cross-catalog next-step coach, catalogs view only).
  A matrix cell click dispatches `open` (catalog + entity + step, and `view` back to `'catalogs'`). `Work these N` on the matrix hands a work queue to `useLabWorkQueue` (the shell's
  one live queue, session state only); while it is active `<WorkQueueStrip>` sits under the coach.
- **Cross-view navigation**: a one-shot `pendingNavigation` store subscription (`oneShotLabStore`)
  drives navigation from anywhere — used by the One-shot panel and by `GlobalCoach`. The payload
  carries an optional `stepIndex`; `useLabLocation` dispatches it as `open` with `stepIndex ?? 0`
  (consumed once, persisted like any other move, and it lands on the Catalogs view — the toast
  is global, so its "Open" may be pressed from the Matrix or Canon).
- **Addresses + Back (lab)**: every lab location has an address,
  `/?legacy=0&c=<catalog>&e=<entity>&s=<step LABEL>&v=<view>` (`labRoute.ts`). The step travels by
  LABEL — an index means a different step per canon profile — and is resolved against the target
  entity's own list on arrival (`entityStepList`; no entity named → `resolveStepJump`). `legacy=0`
  is always named, so a lab link opens the lab whatever shell preference is stored. The prefs blob
  stays the reload mechanism; the address is an additional door into the SAME location, and
  `useLabAddress` applies it only through `nav` (`open`, then `view` when the address names
  Matrix/Canon) — never a parallel setter. History classes (`useLabRouteSync`):
  - **arrival**: a parsed address outranks the persisted location and is applied; the entry is
    REPLACED once the location lands (arriving never pushes). No address, or an unparseable one,
    leaves the persisted location and replaces the entry to name it (the defined fallback);
  - **push**: a catalog, entity, `open` or view move adds ONE entry (so Back after a matrix-cell
    jump returns to the Matrix instead of leaving the app);
  - **replace**: a rail step move, the step clamp, and an entity reconcile (the resolved entity
    changed in the same commit as the entity list — persisted entities landing, an entity removed)
    rewrite the current entry, so the URL bar is always a link to what is on screen;
  - **popstate** re-applies the entry's location through `nav` and pushes nothing, so Back/Forward
    cannot grow history;
  - the lab's params leave with the lab: on unmount (a shell switch) `c/e/s/v` are stripped from
    the entry left behind, deferred a microtask and counted per mounted shell so a StrictMode
    remount keeps them.
  The sync writes `labUrl(window.location.href, …)`, which keeps the pathname (`/` or `/layout`)
  and every param the lab does not own. First consumer: the `/status` evidence ledger's per-row
  **Lab ↗** link (`EvidenceEntityLedger`, `labHref({ catalogId, entityId, step, view: 'catalogs' })`)
  opens the entity AT the step being read — before, the only way back was the bare `/layout` link
  to wherever the lab was last left.

On mount, `useEffect(() => { hydrate(); }, [hydrate])` fetches the server's project canon rules into
`canonStore` (replaces the seed if the server responds).

Default `catalogId` is `'items'`; `useLabCatalogData()` and `useLabDetail(catalogId)` supply the
`LabGroup[]` and `LabDetail | null` props.

#### Activity chip — `ActivityChip` (`src/components/layout-lab/ActivityChip.tsx` + `hooks/useLabActivity.ts`, `activityModel.ts`)

(Corrected 2026-09-30: this section used to describe `RunnerChip.tsx`, which no longer exists.
`ActivityChip` replaced the unrelated `RunnerChip` (drain lease) + `LabJobsChip` (one-shot) pair
with ONE header answer to "is anything running right now?".)

It is a unified READ, not a merged runtime: `useLabActivity()` subscribes to the stores each engine
already publishes and `summarizeActivity` (pure, `activityModel.ts`) renders them as lanes in one
state vocabulary — **drain** (the UE drain lease), **one-shot** (`oneShotJobStore`) and **forge**
(asset-forge background polls). Every lane carries a `blindSpot` naming what it cannot see.

The L3/L4 drain runner talks to a single, non-reentrant UE editor guarded by a **lease**. The
lease registry lives in `src/lib/test-gate-runner/drain-lease.ts` (`acquireLeases` — all-or-nothing,
`releaseLeases`, `getLeaseState`; keyed `catalog|entity`, `*|*` = global). `POST /api/pipeline-artifacts/drain`
acquires it (409 on overlap) and `GET /api/pipeline-artifacts/drain/status` READS it (`{ held, scope,
since, scopes }`, envelope via `apiSuccess`). The drain lane's states (`drainLane`):

- **running here** (`draining <scope> (via the UE bridge)`) — THIS session is draining, read from
  `labRunnerStore.localDrain` (published by `useBaseline.runDrain` and `useBatchDrain`). Authoritative,
  so the lease is **not** polled while it is set.
- **running elsewhere** — the status API reports a lease this page did not take (a batch drain here
  would 409).
- **unknown** — before the first lease poll answers, and after one fails (`leaseProbe`
  `unpolled` / `failed`). Never read as idle: a false idle invites a second editor boot.
- **idle** — no local drain and the API reports the lease free.

The lease poll is suspend-safe (`useSuspendableEffect`) on `UI_TIMEOUTS.runnerLeasePoll` (5 s) and does
zero work while draining locally or hidden. The chip also feeds the tab title (`useDynamicTitle`).

### 4. Category→Catalog→Entity tree — `CatalogTree` (`src/components/layout-lab/CatalogTree.tsx`)

Left column of `Baseline`. Renders three levels:

1. **Category** heading (monospace, uppercase) — one per `LabGroup`. Chapters are **compact by
   default**: only the chapter that holds the current selection auto-opens, so the tree reads as a
   chapter overview and the user expands others on click (`▸`/`▾`). A per-chapter `override` map
   records explicit expand/collapse (so the auto-opened chapter can still be collapsed); absent ⇒
   the default rule.
2. **Catalog** row — `label` + `verified/total` count. `borderLeft: 3px solid t.ink` marks the
   selection. Clicking calls `onSelectCatalog`.
3. **Entity** rows — only shown when the catalog is selected; a 7 px lifecycle dot (ok/bad/muted)
   precedes the entity name. Clicking calls `onSelectEntity`.

### 4b. Lab-wide search (`LabSearch.tsx`)

The tree opens exactly ONE chapter and lists entities only under the selected catalog, so
reaching a known entity was expand→click→scan, and a step could not be reached at all without
first opening its entity. `LabSearch` indexes all `CATALOG_SECTIONS` catalogs, every seeded
entity in `catalogStore`, and every step of every catalog (`resolveCatalogSteps`) into one flat
list, rebuilt only when the entity universe changes. The index is **built on the first open**,
never while closed (a render-phase `everOpened` latch): the overlay is mounted for the whole
session but on screen for seconds of it, and the index spans hundreds of rows. Once built it is
kept, so reopening is instant.

- **Open**: header "Search ⌘K" button, `⌘/Ctrl+K`, or `/` when focus is not in a text field.
- **Jump**: catalog hit → `onSelectCatalog`; entity hit → `navigateTo(catalog, entity, 0)`;
  step hit carries the step LABEL, and `resolveStepJump` picks the entity at selection time —
  the CURRENTLY open entity when its own pipeline has the step, else the first entity whose
  pipeline does — then `navigateTo(catalog, entity, <that entity's own index>)` (no entity has the
  step → the hit degrades to selecting the catalog). Every path runs the lifted callbacks, so
  last-location persistence is unchanged.
- **Pages + modules**: `NAVIGABLE_SURFACES` rows (badge `page`) and one row per legacy-shell
  module from `MODULE_DESTINATIONS` (badge `module`) both reuse the `route` hit kind — a
  full-page jump (`window.location.href`), e.g. `packag` → `/?legacy=1&module=packaging`.
- **Keyboard**: ↓/↑ (wrapping) · Home/End · Enter opens · Escape clears the query, then closes
  the overlay (the first Escape is `stopPropagation`'d so clearing never also closes the Modal).

Search+jump only — deliberately not a command palette with actions.

### 4c. Legacy-shell Ctrl+K palette — intents (`src/components/layout/GlobalSearchPanel/`)

The legacy shell's `GlobalSearchPanel` (FTS5 hits from `src/lib/search-index.ts`) IS a palette
with actions. `searchIntents.ts` resolves each hit client-side, from its doc id (`cat-` `mod-`
`cl-` `qa-` `feat-` `fm-` `ef-` `build-`; the item id is the id minus the known
`<prefix>-<moduleId>-` head, so hyphenated module ids stay unambiguous) and the registry, into:

- **primary** — always a navigation: a category with no sub-module list lands on its first
  sub-module, builds land on `packaging`, findings on an unknown module land on `evaluator`.
- **run** — quick actions (indexed as `checklist`, shown as **Action**) carry their registry
  prompt verbatim, dispatched through `useModuleActions.sendPromptToModule` (the activity feed's
  Fix door) **only** on Shift+Enter or the row's Run button — never on Enter, row click, or render.
- **state** — checklist hits show Done/Open from `moduleStore.checklistProgress`.

`searchIntents.test.ts` ratchets zero dead ends over every doc `rebuildSearchIndex` writes.

### 4d. Keyboard door — one owner per chord, LIFO Escape, hidden panes inert (`src/lib/hotkeys/hotkeyRegistry.ts`, `src/hooks/useHotkey.ts`)

The legacy shell's shortcuts go through ONE window keydown listener owned by `hotkeyRegistry`
(pure of React; attached only while something is registered), not one listener per component:

- **Chords** (`mod+k`, `ctrl+b`, `ctrl+1`; `mod` = Ctrl or Meta; listed modifiers are required,
  unlisted ones unchecked; the key is compared to `KeyboardEvent.key`) have ONE owner per keypress:
  the innermost active scope (`module:<id>` beats `shell`), last-registered within a scope. Two
  owners of one chord in one scope is misuse: `collisions()` reports it and `logger.warn` fires
  once (last wins). The door `preventDefault`s only what it handles. `allowInInput` defaults to
  false; every migrated chord passes `true`, because the raw listeners it replaced never checked focus.
- **Escape is a LIFO layer stack** (`pushLayer(id, close)`): one Escape pops and closes only the
  top layer, so Escape over the search palette no longer also collapses the persisted
  quick-actions panel or the drawer under it.
- **Exclusive capture** (`captureNext`): capture phase + `stopPropagation`, one-shot, releasable
  (the `InputBindingsTable` rebind).
- **Hooks** — `useHotkey(chords, handler, opts)`, `useEscapeLayer(id, active, close)`,
  `useCaptureNext(active, handler)` — register only while `SuspendContext` is false, so a pane
  hidden in the keep-alive LRU is keyboard-inert: the `!isVisible` that sets `display:none` is the
  condition that unregisters its keys (a half-finished rebind in a hidden pane releases its
  capture). Scope defaults to `module:<PaneIdContext>` inside a pane and `shell` outside one.
  Handlers are read through a ref, so a new handler identity never re-registers or re-orders a layer.

Adopters: `useKeyboardShortcuts` (Ctrl+B / Ctrl+J / Ctrl+1–5, shell), `useGlobalSearchPanel`
(`mod+k` shell + `global-search` layer), `SpellbookSearch` (`mod+k` in `module:arpg-ability` +
`spellbook-search` layer), `useReviewableModuleView` (`quick-actions-panel` layer), `Sidebar`
(`sidebar-drawer`), `ActivityFeedPanel` (`activity-feed`), `InputBindingsTable` (capture).
Parity is pinned by `src/__tests__/hooks/hotkeyCallersParity.test.tsx`.

Behaviour to know: **Ctrl+K inside the ability module opens the Spellbook palette only — global
search no longer opens there** (one owner per chord); it opens global search again as soon as
that pane is hidden. Still raw (13 listeners, deliberately untouched): `TopBar/useTopBar.ts` (the
legacy-shell project dropdown's Escape is a `document` listener, so it still co-closes with the
top door layer — LIFO holds among door layers only), the lab shell's `LabSearch` / `ActivityChip`
/ `LabBridgeStrip` / `useBaseline` (page.tsx mounts one shell, so they never meet these), and
local popovers / dev tools. New shortcuts use the hooks, not another window listener.

### 4e. Tab title + favicon — outcome held until seen (`src/lib/shell/tabAttention.ts`, `src/hooks/useDynamicTitle.ts`)

The browser tab is the operator's ambient signal while minutes-long work runs in another window.
`tabAttention` is a pure reducer `(prev, signal, visible, now) -> { title, tone, latched }` fed by two
adapters over consecutive snapshots: `fromCliSessions` (legacy shell, cliPanelStore: per-session
`isRunning` edge + `lastTaskSuccess` + `lastCallbackStatus`) and `fromLabActivity` (lab shell,
`activityModel` lanes: `running-here` -> `attention` is `(Failed)` for a failed one-shot lane, else
`(Needs you)`; -> `idle` is `(Done)`). A failed run is `(Failed)`, never `(Done)`; a run that exited 0
but whose asked-for `@@CALLBACK` failed or went missing is `(Not landed)` (only when `lastDispatch`'s
prompt carried callback ids — the `suggestionIntents` rule); one failure among running sessions reads
`(Running · 1 failed)`. A first snapshot is never an edge. An outcome latches while
`document.visibilityState` is hidden; the `UI_TIMEOUTS.tabOutcomeLinger` countdown starts only once
the tab is visible. `useDynamicTitle()` (AppShell) keeps base `POF` and the `(N sessions)` /
`(Running)` / `(N running)` strings; `useDynamicTitle(summary)` is called by `ActivityChip` (always
mounted in the lab header) with the document's own title as base, left untouched while nothing runs
or ends. The favicon (STATUS_* from chart-colors) repaints only when the tone changes.

### 5. Composition screen — `Baseline` (`src/components/layout-lab/Baseline/index.tsx` + `Baseline/useBaseline.ts`)

Three-column CSS grid `260px 320px 1fr`:

| Column | Content |
|--------|---------|
| Left 260 px | `<CatalogTree>` |
| Middle 320 px | Pipeline timeline: vertical connector line + step buttons; "Populate demo" / "Reset" buttons for the Items catalog. Step buttons carry badges for drift (`≠`), a failed server write-through (`⚠`, whose `title` is the server's own reason), and a recorded produce failure (`✕`), each folded into the button's aria-label |
| Right 1fr | Work canvas: compact `<NextStepCoach>` row + step heading + step component (the full per-step status lives in the middle pipeline rail, not repeated here) |

**Responsive collapse**: the grid is `wide ? '260px 320px 1fr' : '1fr'`. Width comes from
`useViewportWidth()` (`src/hooks/useViewportWidth.ts`) — a `ResizeObserver` on `documentElement` that
defaults to `WIDE_FALLBACK_WIDTH` (1440) for SSR / first paint / jsdom (no `ResizeObserver`), so the
shell starts wide and collapses only once a narrow viewport is confirmed. Below `COLLAPSE_BREAKPOINT`
(1100 px) the two left columns un-mount and reappear as left **slide-over drawers** (`LabDrawer`,
framer-motion, backdrop + Escape to close) toggled by persistent header buttons (`DrawerToggle`),
keeping the canvas full-width. Both column bodies (`treeBody`, `pipelineBody`) are factored so they
render identically inline (wide) or inside a drawer (narrow); picking a catalog/entity/step closes
the drawer.

**Step source**: `getCatalogPipeline(detail.catalog.catalogId)` wins if the registry has a pipeline;
otherwise falls back to `detail.steps` (line 47–48). The `live` flag on each step button is set when
`getStepComponent(catalogId, step)` returns non-null, and is shown as a green dot.

### 6. Step-render precedence (work canvas, `Baseline/index.tsx`)

```
const Bespoke = detail && entity ? getStepComponent(detail.catalog.catalogId, stepName) : null;
const spec = pipeline?.steps.find((s) => s.label === stepName) ?? null;

if (Bespoke && entity)
  → <Bespoke key={entity.id + ':' + stepName} t={t} entity={entity} step={stepName} />
else if (spec && entity)
  → <ArchetypeStep key={…} t={t} entity={entity} step={stepName} spec={spec} catalogId={…} />
else
  → placeholder <div> ("Work canvas for … not prototyped yet")
```

1. **Bespoke** (`getStepComponent`) — explicit hand-built component from `STEP_REGISTRY` in
   `steps/index.ts`. Currently the full 13-step Items pipeline is registered here.
2. **ArchetypeStep** — generic renderer driven by a `StepSpec` from the catalog pipeline registry.
   Renders a `<StepFrame>` with a `ViewPanel` (prose / table / checklist / manifest / graph / gallery)
   and a `<CliProduce>` that injects canon rules via `canonContextFor`.
3. **Placeholder** — plain panel with instructional text.

### 7. Server-backed produce→persist→render→rollup loop

#### Write-through (`Baseline/useBaseline.ts`)

On every `catalogId` change an effect calls `setLabSync(fn)`, binding a closure over `catalogId`:

```
setLabSync((entityId, step, art) => {
  const accept = resolveAccept(catalogId, step);
  const res = accept ? accept(art.data) : null;
  void postArtifact({ catalogId, entityId, step, data, ueAssets,
                      status: res?.status ?? 'pass',
                      tier:   res?.tier   ?? 'L0',
                      reason: res?.reason });
});
```

`_labSync` is a module-level function pointer in `labPipelineStore.ts` (line 91–92). When
`store.produce()` runs (line 51), it calls `_labSync?.(entityId, step, artifact)`, which fires
`postArtifact` → `POST /api/pipeline-artifacts`.

#### Hydrate on entity-open (via the shared artifact cache, `labArtifactCache.ts`)

Baseline and CatalogMatrix used to own independent fetch paths, so rapid tree clicks issued a fetch
storm and each surface reset to "everything pending" mid-fetch. Both now read through **one shared,
hand-rolled cache** (`labArtifactCache.ts`, `useCachedArtifacts`) keyed `catalogId` (whole-catalog,
for the matrix) or `catalogId|entityId` (one entity, for Baseline):

```
useCachedArtifacts(catalogId, entity.id) → { arts, loading, loaded, error }
  loading:true (deduped fetch in flight)  → rail/matrix show an honest LOADING shimmer
  → arts arrive                            → serverArts (rollup overlay) + hydrateEntity(add-only)
  → fetch FAILS                            → error:'<reason>', loaded:false — the third state
```

Key properties: **concurrent readers of a key share one fetch** (no storm); a per-key request
sequence **discards stale in-flight responses**; and `invalidateArtifacts(catalogId[, entityId])` —
called on **produce** (write-through) and **drain** — drops the matching keys so the next read
refetches the server-graded verdict. `hydrateEntity` (store) only adds steps not already present in
the local cache; it never overwrites or clears existing local state — the explicit
`refreshArtifacts` + `refreshEntity` pair is the one path that can adopt content or reconcile a
deletion (see "Refresh from server" below).

**A failed fetch is not an empty catalog.** Every GET failure used to be folded into `[]` and cached
as a SUCCESSFUL empty load, so a dead server / 500 / offline moment rendered as "nothing has been
produced here" — and the coaches advised starting work that was already green on the server. The
cache now stores `error` explicitly, and the surfaces distinguish all three states:

- **PipelineRail** — an `error` renders the shared `InlineErrorRetry` above the rail, and every step
  with no LOCAL verdict reads `data-step-status="unknown"` (glyph `?`), not `unproduced`.
- **CatalogMatrix** — the error + retry replaces the grid (a full grid of `unproduced` cells is the
  lie being removed).
- **NextStepCoach** — declines to advise while the fetch is failed (it would be guessing from
  statuses it could not read) and offers the retry.
- **GlobalCoach** — `useGlobalCoach` returns `{ candidates, failedCatalogs }`; an errored catalog
  contributes NO candidates and is named in a retry banner instead.

The retry is always explicit (`retryArtifacts`): an errored key never auto-refetches, or a failing
server would spin a fetch loop through every subscriber's effect.

**Honest loading ≠ pending ≠ unproduced.** Three distinct display states, never conflated:
- `loading` — a fetch is in flight: the pipeline rail shimmers steps of not-yet-known status
  (`pending`/`unproduced`); a locally-known pass/fail/deferred is real truth and is never masked;
  the matrix renders a `MatrixSkeleton` grid instead of an all-pending flash; `NewHome`'s
  pre-rehydration first paint shows a lightweight lab-shell skeleton.
- `pending` — an artifact EXISTS but its acceptance is still resolving.
- `unproduced` — NO artifact exists for the step (nothing has been produced here).

`unproduced` is the honest replacement for the old **lifecycle-fraction pseudo-progress** — a step
with no artifact used to be mapped to a fabricated `pass`/`pending` from `labStepsDone(lifecycle)`,
so the rail, matrix, and both coaches showed progress that never happened (and the global coach
ranked those fake pendings). That heuristic is gone: `deriveEntityArtifacts` now reads real produce
state for EVERY catalog (`stepDone = has an artifact`) and a no-artifact step displays as
`unproduced` — a distinct, colorblind-safe cue (dotted dimmed dot / `·` glyph / "not produced" word,
via `UNPRODUCED_GLYPH`/`UNPRODUCED_WORD` in `statusLanguage.ts`; kept OUT of the exact 4-status
`STATUS_GLYPH`/`STATUS_WORD` maps). All shimmers use the `lab-shimmer` keyframe (`lab-tokens.css`)
and freeze under reduced motion.

#### Rollup overlay (`hooks/useEntityArtifacts.ts` — `deriveEntityArtifacts`)

After hydration, `artifacts: PipelineArtifact[]` is derived client-side: for each step that has a
local artifact, `resolveAccept` recomputes status/tier from the current data. If the local
recompute returns `'deferred'` (a Test Gate that has not run) but the server record has a real
`pass` or `fail`, the server verdict wins:

```
const status = localStatus === 'deferred'
  && srv && srv.status !== 'deferred' && srv.status !== 'pending'
  ? srv.status
  : localStatus;
```

Each derived artifact also carries the concrete checker `reason` (`res.reason`, or the server
record's reason when the overlay above won), so coaches, tooltips, and matrix blockers can explain
WHY a step failed/deferred without a second `resolveAccept` pass.

#### Drain deferred gates (`Baseline/useBaseline.ts` — `runDrain`, `labArtifactClient.ts`)

`runDrain` (extracted into `Baseline/useEntityDrain.ts`) calls `drainGates(catalogId, entity.id)` →
`POST /api/pipeline-artifacts/drain`, then `invalidateArtifacts(catalogId, entity.id)` so the refreshed
verdicts are re-read through the shared cache. **The outcome is displayed, never discarded
(2026-09-28):** the pure `entityDrainOutcome(steps, response)` (built on `summarizeBatchDrain` +
`ranNothing`, adding each gate's index in THIS entity's step list) yields `ran` (counts, per-gate
fail/deferral reasons, captured frames), `ran-nothing` (0 ran, N skipped → names the missing UE
editor on the bridge), `refused` (quotes the server's 409 lease reason) or `error` (a missing
response is an error, never a throw). The hook keeps it keyed by `${catalogId}/${entityId}` — the
same key as the draining flag, so it never renders on another entity — and `<EntityDrainResult>`
renders it under the coach: message, Retry (refused / ran-nothing / error), Dismiss, "Open step" per
failing gate, and the frames via the shared `<DrainFrameLinks>`. A new run clears the old result. The drain trigger lives in `<NextStepCoach>`: it surfaces a
"Run N deferred gates" button (as the primary CTA when the next actionable step is itself deferred,
otherwise inside the disclosure) whenever `rollup.deferred > 0` and an `onDrain` callback is provided.

#### Produce failure + Reset (`labPipelineStore.ts`, `Baseline/useBaseline.ts`)

Two truth paths that used to dead-end:

- **A failed produce now leaves a trace.** `CliProduce` reports a rejected dispatch inline,
  but that message dies with the panel. `produce`/`produceFrom` wrap the dispatch: on a throw
  they record `fail(entityId, step, reason)` and re-raise (so the inline report + "Retry with
  same prompt" are unchanged). Recording is non-destructive — an existing artifact keeps its
  `data`/`ueAssets`/`done` and only gains `error`, because a re-produce that blew up must not
  erase content that did land. The rail badges the step (`✕`) and the canvas renders
  `<ProduceErrorBanner>`; `clearError` dismisses it, dropping a failure-marker-only step
  entirely so it reads as honest `unproduced` again (and stays open to server hydration).
  **While the marker exists it is not an artifact either (2026-10-01):** every reader decodes
  the record through `stepRecord.ts` — `contentOf` (content iff `done`), `produceFailureOf`,
  `effectiveSteps` (the one add-only server/local merge for the matrix and the global coach;
  a marker never shadows a server row) and `coachVerdictOf`. The derivation, matrix and both
  coaches grade only content, so a marker-only step reads `unproduced` (never a graded `{}`:
  no fabricated pass, no phantom deferred gate), and its error reaches the coach through the
  one hint channel (`settlementOf` → `coachActionFor`: "Produce — Last produce failed — …").
- **Reset now means reset.** `resetEntity` clears LOCAL state only; because hydration is
  add-only, the surviving server rows were re-adopted on the next load and the reset silently
  un-did itself. `resetEntityEverywhere` (behind the shared `ConfirmDialog`, whose copy states
  the full scope) calls `deleteEntityArtifacts(catalogId, entityId)` →
  `DELETE /api/pipeline-artifacts?catalogId&entityId[&step]` FIRST and only clears local state
  when the server delete succeeded. A failure surfaces through the shared `InlineErrorRetry`
  (retry re-runs the delete) and local state is left intact — a reset never falsely reports done.

#### `NextStepCoach` (`src/components/layout-lab/NextStepCoach.tsx`)

Mounted above the step heading in the work canvas as a **single compact row** (the middle pipeline
rail already carries the full per-step status, so the old in-canvas `PipelineRollup` strip was
removed). The row shows the next actionable step (`pickNextActionableStep`, ranked through the
shared `coachLadder.ts`) + one primary button
(jump to it, or drain when it's deferred). A `▾ more` disclosure expands a second region with the
plain-language toggle, an optional `plainEntitySummary(rollup)` line, and the drainer when it isn't
already the compact CTA.

#### Entity rollup — `summarizeEntity`

There is no rollup COMPONENT any more (the old in-canvas `PipelineRollup.tsx` strip was deleted —
the left pipeline rail is the status display). `summarizeEntity(artifacts, steps.length)` in
`@/lib/catalog/rollup` still produces `{ done, total, deferred, pending, failed, highestTier,
configComplete }`, and `NextStepCoach` consumes it for the plain-language summary + the drain count.

---

## Conventions / gotchas

### Shell-preference hydration trio (`src/app/page.tsx` : 15–22)

The root page uses `useSyncExternalStore` to read the shell preference without a `useEffect`:

```typescript
useSyncExternalStore(
  (cb) => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); },
  readShellPref,   // client snapshot
  () => 'ecw'      // SSR snapshot — server always pretends 'ecw' to avoid mismatch
)
```

The Zustand persist hydration guard used in `AppShell` (legacy path) follows the same pattern with
a no-op subscribe: `useSyncExternalStore(() => () => {}, () => true, () => false)` — client always
`true`, SSR always `false`, preventing layout flicker on initial paint. Do not replace this with
`useEffect(() => setMounted(true))` — the `react-hooks/set-state-in-effect` ESLint rule errors on
that pattern.

While `hydrated` is `false`, `AppShell` renders **`ShellSkeleton`** (`src/components/layout/ShellSkeleton.tsx`)
— a branded skeleton that mirrors the real chrome (44px top bar, 56px icon rail, and the shared
`ModuleSkeleton` tile grid) rather than a centered spinner. When `hydrated` flips `true` the skeleton
is crossfaded out (`AnimatePresence` exit) while the real shell fades in underneath, so first paint
reads as one continuous reveal with no spinner-to-app cut or layout jump. `ModuleSkeleton` lives in
its own module (`src/components/layout/ModuleSkeleton.tsx`) and is shared by the `ModuleRenderer`
Suspense fallback and the shell skeleton's content area.

### Theme tokens

`LabTheme` (`theme.ts`) is a typed struct of raw hex / rgba strings. It is intentionally **not**
derived from the app's `chart-colors` tokens — these panels are a bespoke design lab. The two
themes are:

| id | label | font-body | font-mono | grid |
|----|-------|-----------|-----------|------|
| `light` | Blueprint | Inter | IBM Plex Mono | 24 px blueprint grid |
| `dark` | Studio Dark | Inter | JetBrains Mono | none, `glass: true` |

`LAB_THEMES` is the source-of-truth array; `LayoutLab` maps over it to render theme buttons.

### ArchetypeStep canon injection

`ArchetypeStep` (line 15–24) maps `spec.archetype` → a fixed set of `RuleCategory[]`:

```typescript
const ARCHETYPE_CANON: Record<string, RuleCategory[]> = {
  brief:    ['game'],
  schema:   ['project', 'game'],
  balance:  ['project', 'game'],
  gallery:  ['art', 'game'],
  ...
};
```

`canonContextFor(canonRules, catalogId, categories)` prepends the matching rules to the CliProduce
prompt so every generic step receives relevant project/game laws without bespoke wiring.

### `labPipelineStore` — add-only hydration invariant + drift reconciliation

`hydrateEntity` adopts a server row whole only where the local record holds no content (absent,
or a failure marker — `stepRecord.contentOf`; the marker's `error` is kept). This means server data can
backfill steps a new browser session has not produced yet, but a locally-produced step is never
silently overwritten by a stale server record. This is intentional — **the add-only default protects
offline-produced work**.

Because the server **re-grades every artifact POST** (`app/api/pipeline-artifacts/route.ts`), the
add-only rule can leave the local verdict and the server verdict genuinely diverged. That divergence
is now made **visible** rather than silent:

- `deriveEntityArtifacts` returns a `driftByStep: Map<step, {kind, local, server}>` with two kinds:
  - `status` — a concrete local `pass`/`fail` contradicts a concrete server `pass`/`fail`. (The
    sanctioned `deferred`→server overlay is *resolution*, not drift, and is excluded.)
  - `content` — the verdicts AGREE but the produced data differs, compared by fingerprint
    (`labContentDrift.ts` → `contentDiverges`). This is the quiet case a status-only comparison can
    never see: another session, the MCP submit path or a headless run rewrites a step and the
    checker still grades it identically. The fingerprint excludes `genHistory` (the gallery's kept
    re-roll log, deliberately preserved across an adopt) and `_provenance` (stamped SERVER-SIDE by
    the POST route's `stampPromptVersion`, so the row that comes back always carries a key the local
    artifact never had — without excluding it, every produced step would read as drifted). Both
    exclusions live in `stepContentHash` (`@/lib/judge/contentHash`) — **one** rule shared with the
    judge write path and the verdict bridge. `labContentDrift.ts` used to keep a second, local
    `_provenance` strip, and that duplication is precisely how the two sides diverged: drift saw no
    change while the verdict bridge saw a hash mismatch on the same pair, so a current judge FAIL
    was reported as "re-produced since" and neither the drift banner nor `adoptServer` could
    correct it. Do not reintroduce a second stripping rule.
  A step whose write-through is already flagged (`syncError`) is not double-reported as drift.
- The pipeline rail marks a drifted step with a `≠` badge; the work canvas shows a `DriftBanner`
  naming both verdicts (in words + glyph, never hue-only) with an **"Adopt server truth"** affordance.
  A `content` drift is phrased as such — claiming a verdict contradiction that does not exist would
  hide the real news.
- Adopting calls `adoptServer(entityId, step, artifact, opts)` — it overwrites the local step with the
  server artifact so the derived status matches server truth, but **preserves the local candidate
  history (`data.genHistory`) by default**; replacing it requires an explicit checkbox confirmation.
  A re-roll archive is never silently destroyed.

### Refresh from server — the explicit reconciliation

Add-only hydration can only ever ADD, and `invalidateArtifacts` fires only as a side effect of a
produce, a drain or a reset. So a catalog changed by another session, by the MCP submit path or by a
headless judge run stayed stale until you happened to do one of those, or hard-reloaded. The lab now
offers an unconditional **"⟳ Refresh from server"** (`RefreshFromServer.tsx`, in the pipeline column
for every catalog — not buried behind a banner that needs a pass-vs-fail contradiction to appear).

There is deliberately **no poll**: lab modules are LRU-suspended, so a background timer would fight
`useSuspendableEffect`. Freshness is asked for, never scheduled.

```
refreshArtifacts(catalogId, entityId)     force a refetch through the shared cache, RETURN the rows
  → labPipelineStore.refreshEntity(...)   reconcile the local store against exactly that response
  → RefreshOutcome { adopted, removed, kept, unchanged }   reported on screen, never silent
```

`refreshEntity` is the only path that may adopt server CONTENT wholesale or DROP a step, so its rules
are explicit (and pinned by `labPipelineStore.refresh.test.ts`):

| local | server | result |
|-------|--------|--------|
| absent, or a failure marker (no content) | present | adopt (a marker's `error`/`errorAt` kept) |
| present, identical | present | `unchanged` (only the provenance stamp refreshes) |
| present, holds work the server has not got (`syncError`, or a produce strictly newer than the row) | present | **kept** — a refresh never overwrites unsaved produce output |
| present, otherwise different | present | adopt (local `data.genHistory` preserved, as `adoptServer`) |
| present, provably server-derived | absent | **removed** — a step deleted server-side stops reading green forever |
| present, local-only work | absent | kept + stamped `SERVER_MISSING_REASON`, so the existing sync-error banner/badge/**Retry** (which re-POSTs it) becomes the recovery path |
| failure marker only (no content) | absent | left as is, counted `unchanged` — an empty failure is not unsaved work |

"Provably server-derived" is `LabStepArtifact.serverSeen` — the `at` of the newest server row the step
has been reconciled against, written by `hydrateEntity`/`adoptServer`/`refreshEntity`. No timestamp
alone can tell "came from the server and was then deleted there" from "never reached the server", and
guessing either way is destructive; an artifact that predates the stamp is never removed.

Adopting content changes the artifact's content hash, so any standing judge verdict bound to the old
content correctly stops applying (see `judgeBridge`'s `VERDICT: STALE`).

**One status code path.** `CatalogMatrix` derives its cells through the *same* `deriveEntityArtifacts`
path as the rail (`buildMatrixRows` — the add-only merge of local store OVER server artifacts, then
the shared recompute + overlay), so the matrix and the rail can never disagree about a step's status.

### Items pipeline is the reference implementation

`STEP_REGISTRY` in `steps/index.ts` registers all 13 Items steps as bespoke components. All other
catalogs currently fall through to `ArchetypeStep` (when a `StepSpec` is registered) or the
placeholder. When building a new step, register a bespoke component in `STEP_REGISTRY` or author a
`StepSpec` in the catalog pipeline registry — the shell handles the rest.

The Items step **labels are declared once** — `ITEM_STEP_NAMES` (the keys of `ITEM_STEP_SPECS` in
`steps/itemsSteps.ts`). Both the rendered timeline (`labPipelineSteps('items')` in `labPipelines.ts`)
and `STEP_REGISTRY.items` (which zips `ITEM_STEP_NAMES` to an ordered component array) derive from it,
so a renamed step can never silently route a real step to the generic placeholder.

### One catalog manifest (`catalogManifest.ts`)

Making a catalog functional touches four decentralized sources — the **section**
(`@/lib/catalog/sections`), the **step list** (bespoke fine steps vs a registered `StepSpec`
pipeline), the acceptance **grader** (`labAcceptance.resolveAccept`), and the **bespoke step-UI**
registry (`steps/index.ts`). `catalogManifest(catalogId)` is the single resolver over those sources.
It returns `{ section, bespoke, stepSource, hasPipeline, steps }`, where `stepSource` is one of
`bespoke` (curated fine steps + bespoke UIs — Items, which overrides its same-id registry pipeline),
`registry` (a `StepSpec` pipeline drives `ArchetypeStep`), or `fallback` (generic track labels,
ungraded). `useBaseline`, `CatalogMatrix`, and `useLabCatalogData` all resolve their step list through
`resolveCatalogSteps` / this manifest, so the rail and the matrix can never render different columns.
The `bespoke` flag replaces the `catalogId === 'items'` special-cases that were scattered across those
hooks (`isBespokeCatalog`). The guard `src/__tests__/catalog/catalog-manifest-coverage.test.ts`
(in `npm run validate`) fails when a graded catalog has steps but no section or no grader.

### One per-entity step list (`entityPipeline.ts`)

A step may be scoped to canon profiles (`StepSpec.profiles`, /diablo D18), so a catalog-wide step
position means a DIFFERENT step per entity (a diablo1 dialog has no `Skill Checks` / `Camera`; a PoF
bestiary entity has no `Sprite Render`). The rule: **a lab jump names a step by label; its index is
resolved against the TARGET entity's own list** (`entityStepList`), never a position in another list.
The rail (`useBaseline`), the matrix (`buildMatrixRows`), the cross-catalog coach (each entity is
derived and ladder-picked against its own list, under its own `canonProfile` via `toLabEntity`, so
`candidate.stepIndex` is what the rail opens), lab search (`resolveStepJump`) and the `LayoutLab`
out-of-range clamp (bounded by the OPEN entity's own list) all read it, so the coach, the rail, the
matrix and search agree about an entity's steps by construction. Pinned by
`entityPipeline.test.ts`, `globalCoach.profile.test.ts`, `LabSearch.profileStep.test.tsx` and
`LayoutLab.entityStepClamp.test.tsx`.

### Matrix triage + work queue (`matrixTriage.ts`, `workQueue.ts`)

The Matrix ranks its rows by the ONE coach ladder: `buildMatrixRows` carries `row.issue` =
`pickLadderIssue(own steps, displayStatus, driftByStep)` — the same pick both coaches make — and
`rankMatrixRows` sorts by `COACH_PRIORITY_RANK`, then entity id (an immutable unique tiebreaker, so
store order never leaks through and a refetch cannot reshuffle the board). `MatrixTriageBar` filters
to one rung (`{kind:'rung'}`, `none` = every own step passes) with per-rung counts over the UNFILTERED
board; a column header applies `{kind:'column', step, status}` (most urgent status present, click
again for the next) and never matches a row whose own pipeline lacks the step. The filtered board is
captioned with its predicate (`2 of 5 · deferred`). `Work these N` builds a `WorkQueue` of stops
(entity, step by label, that row's OWN index) and `LayoutLab` opens each through `openFromMatrix`.
`useLabWorkQueue` re-anchors the queue on the lab location during render (`reconcileQueue`): on a
queued entity the cursor follows it; a tree / search / coach jump anywhere else ends the queue.
Next/Prev never wrap (Next on the last stop reads Finish). Pinned by `matrixTriage.test.ts`,
`workQueue.test.ts`, `CatalogMatrix.triage.test.tsx` and `LayoutLab.workQueue.test.tsx`.

### Concurrency

The `layout-lab` tree is edited by many parallel sessions. Re-read `labPipelineStore.ts` and
`Baseline/` before editing them and use targeted `git add` — the store is module-level
singleton state (`setLabSync`), so a careless overwrite breaks the produce→persist loop for
every open entity.

---

## §8 One-Shot Authoring (Autonomous Catalog Row)

The lab's normal authoring flow requires opening an entity, selecting each step in the pipeline timeline, typing a direction, clicking Produce, and reviewing the output — thirteen manual driving cycles for an items row. One-Shot mode compresses this into a single click: it gap-analyses the catalog's existing content, asks the LLM to propose a new entity that fills the most under-represented bucket, and then runs every autonomously-achievable step in sequence. The manual step pipeline still exists and is the right choice when you need to curate a specific concept-gallery selection or drive a 3D mesh step; one-shot is the "skip the per-step manual driving" shortcut.

### Architecture

```
[+ One-shot button] → createOrchestrator()
        │
        ├─ POST /api/one-shot/analyze   → gap analysis (underrepresented buckets)
        ├─ POST /api/one-shot/propose   → LLM proposal via cli-service
        │         ↕  (refine loop, max 3 turns)
        ├─ POST /api/one-shot/refine    → LLM refinement via cli-service
        │
        └─ approveAndRun():
             for each step in the pipeline:
               ├─ POST /api/one-shot/step  (cli or deterministic mode)
               ├─ skip-needs-art          (gallery → skip)
               └─ defer-runtime           (L3/L4 → deferred)
```

**Stores:**
- `oneShotJobStore` (`src/stores/oneShotJobStore.ts`) — the state machine: phases `idle → analyzing → proposing → refining → running → completed/failed`, per-step results, summary, refinement turn counter, and the draft entity id.
- `oneShotLabStore` (`src/stores/oneShotLabStore.ts`) — UI layer: `pendingNavigation` (the `catalogId + entityId` to navigate to after completion) and `panelOpen` (the right-rail panel open/closed flag).

### Skip policy

`src/lib/one-shot/skip-policy.ts` maps each step's `(archetype, tier, view)` triple to an action:

| Step archetype / tier | Action | Outcome |
|-----------------------|--------|---------|
| `gallery` (any tier) | skip-needs-art | `skipped` — needs human L1 selection |
| any archetype, tier `L3` or `L4` | defer-runtime | `deferred` — pending the test-gate runner |
| `brief`, `graph`, `rules`+prose view | run-cli | POST `/api/one-shot/step` with `mode: 'cli'` |
| everything else | run-deterministic | POST `/api/one-shot/step` with `mode: 'deterministic'` |

### UI surfaces

- **`+ One-shot` button** — rendered in the `Baseline` header; visible when no job is in flight (`canStart()` true).
- **`LabJobsChip`** (`src/components/layout-lab/LabJobsChip.tsx`) — header chip showing live phase + step progress during a run; click opens the panel.
- **`OneShotPanel`** (`src/components/layout-lab/one-shot/OneShotPanel.tsx`) — right-rail slide-over with the proposal form, refinement input, approve/cancel buttons, and the per-step results list after the run.
- **Completion toast** — fires on `oneshot.completed`; click navigates to the new draft entity in the catalog tree via `pendingNavigation`.

### Failure policy

If a step's `/api/one-shot/step` call returns `outcome: 'fail'` or throws, the orchestrator records a `fail` outcome for that step and **continues** to the next one. The run ends with `phase: 'completed'` regardless of per-step failures; the `lastSummary` breakdown (`passed/failed/skipped/deferred`) reflects all outcomes. This is the locked continue-and-summarize policy — partial failures are surfaced in the panel rather than aborting the run.

### Concurrency

A single `_cancelled` flag per `createOrchestrator()` closure guards the run loop. `cancel()` sets `_cancelled = true` and immediately transitions the store to `phase: 'failed'`. The loop checks the flag at the top of each iteration and at the post-loop completion check, so the next step does not start and `markCompleted` is not called. `canStart()` (store-side) blocks a second orchestrator from starting while any run is in-flight.

### Recovery (no phase is a dead end)

`src/lib/one-shot/next-actions.ts` `nextActions(state)` is the pure map from job state to forward actions, rendered by `RunActions.tsx` under every non-idle, non-analyzed phase:

- **In flight** (`analyzing`/`proposing`/`refining`/`awaitingRun`/`running`) → **Cancel**. `cancel()` returns a proposal-half request to its resting phase (analyzing → `idle`, proposing → `analyzed`, refining → `proposing`) and invalidates its ticket in `proposalPhases.ts`, so a late answer rejects with `cancelled` and writes nothing; a running pipeline goes to `failed`/`cancelled` as before.
- **`failed` with a draft and unrecorded steps** → **Resume**: `resume()` runs only the steps whose label is not yet in `stepResults`, on the SAME `draftEntityId` (no second `addDraft`, no `/api/catalog-entities` POST); `/api/one-shot/step` upserts per (catalog, entity, step), so re-entry is idempotent.
- **Any recorded `fail`** → **Retry N failed**: `retryFailed()` re-runs just those steps and replaces each outcome in place (`upsertStep`), then recomputes `lastSummary`. An interrupted run stays `failed` (still resumable) while steps remain unrecorded.
- **`completed`/`failed`** → **Start over**: `reset()` back to the idle picker.

All three run paths share one loop (`runPlan` in `orchestrator.ts`) and emit the unchanged `oneshot.*` payloads. On reload no in-flight phase survives (`restingAfterReload` in the store merge): an unanswered propose/refine rests at the proposal or distribution it had, a `running` or `analyzing` job becomes `failed`/`reload-interrupted` (a run keeps its draft + recorded steps for Resume).

---

## §9 Player Movement — Tier-2 Animation Pipeline

A worked example of a catalog row whose Produce calls a Python module on the UE
editor thread instead of (or in addition to) writing app-side data. Lives at
`catalog: player-movement` / entity `v1-default-player`. Ten `StepSpec` rows
drive WASD + Shift sprint + Space roll from no animation to a PIE-and-feel
playable.

**Bridge surface added:** `POST :30040/pof/python/run` (route registered in
`PofHttpServer.cpp::Start()`). Body `{module, function, args}`. The runtime-side
`UPofPythonRunner` (`PillarsOfFortuneBridge` module) dispatches the call via
`IPythonScriptPlugin` on the editor thread, wrapping it to capture stdout/stderr +
return the standard `{ok, data|error, logs}` envelope through a
`__POF_BRIDGE_RESULT__` marker line. App-side client is `src/lib/bridge/run-python.ts`.

**Acceptance shape:** the python modules return `{created, skipped, failed, ...}`.
The new acceptance helpers in `src/lib/catalog/acceptance/pythonStepCheckers.ts`
(`pythonStepSuccess`, `pythonStepOk`, `humanConfirmed`) derive L1/L2 statuses from
that envelope. Step 10 uses `visualDeferred` (L4) until the PIE+capture loop is wired.

**Procedural AnimBP authoring:** Step 8 builds `ABP_VSPlayer` entirely from
Python by calling `unreal.PoFAnimBPAuthoringLibrary` — a `UBlueprintFunctionLibrary`
in the `PoFEditor` C++ module that exposes 6 graph-mutation primitives
(`CreateAnimBlueprint`, `AddStateMachine`, `AddBlendSpaceState`, `AddDefaultSlot`,
`ConnectStateMachineToOutputPose`, `CompileAndSave`). No binary AnimBP template
in source control; every future AnimBP becomes a ~30-line Python script.

**Mixamo source convention:** users drop FBX downloads into
`Content/Source/Mixamo/Raw/` (gitignored). Step 02 lists the 10 expected
filenames + flags missing; step 03 batch-imports + the rest of the pipeline
takes over.

See:
- Spec: `docs/superpowers/specs/2026-05-27-player-movement-design.md`
- Plan: `docs/superpowers/plans/2026-05-27-player-movement.md`
- Python modules: `Content/Python/player_movement/` (UE pof-exp repo)
- AnimBP library: `Source/PoFEditor/{Public,Private}/PoFAnimBPAuthoringLibrary.{h,cpp}`
- Acceptance gate: `Source/PoF/Test/Character/VSPlayerMovementTest.cpp` (Wiring + Playable)

## §10 Lab Shell v2 Design System

The lab-shell-v2 branch (`feature/lab-shell-v2`) introduced a first-class design system that sits
beneath the catalog pipeline UI. All new lab UI is built on this layer; the Items pipeline bespoke
steps are its reference implementation.

### Token layer — `lab-tokens.css`

A single CSS file (`src/components/layout-lab/lab-tokens.css`) defines all `--lab-*` custom
properties. Tokens are organised into six scales:

| Scale | Examples |
|-------|---------|
| **Color** | `--lab-bg`, `--lab-panel`, `--lab-ink`, `--lab-muted`, `--lab-accent`, `--lab-on-accent`, `--lab-line`, `--lab-glass-blur` |
| **Space** | `--lab-s1` … `--lab-s6` (4 px base, powers of 1.5) |
| **Radius** | `--lab-r-sm`, `--lab-r-md`, `--lab-r-lg` |
| **Elevation** | `--lab-elev-1` … `--lab-elev-3` (box-shadow ramps) |
| **Motion** | `--lab-dur`, `--lab-dur-fast`, `--lab-ease` |
| **Typography** | `--lab-font-body`, `--lab-font-mono`, `--lab-fs-xs`, `--lab-fs-sm`, `--lab-fs-base` |

The Blueprint and Studio blocks also re-declare the cross-app `--text-subtle` token (the
AA-compliant de-emphasized text tier, default in globals.css `:root`) with a per-theme value
so it clears WCAG AA 4.5:1 on each theme's floor. The shared `ui/MicroLabel` primitive renders
in this tier at the 12px size floor — use it for muted micro-text instead of
`text-text-muted/40–/70` opacity hacks, which fall below AA.

The theme is set via a data-attribute on the root `[data-lab-root]` div:

- `[data-theme="blueprint"]` — Light: blueprint-grid canvas, IBM Plex Mono, neutral ink.
- `[data-theme="studio"]` — Studio Dark: dark panel, JetBrains Mono, glass blur enabled.

There is **no density switch** — the space scale (`--lab-s1`…`--lab-s8`) is baked into `:root` as a
single, space-efficient (compact) baseline, so the shell is uniformly dense without per-user tuning.

### `LabTheme` compat shim — `theme.ts`

`LabTheme` (`src/components/layout-lab/theme.ts`) is a typed struct of named color fields.
Since the shift to CSS custom properties the color fields (`bg`, `panel`, `ink`, `muted`, `line`,
`accent`, `inkDeep`) are `var(--lab-*)` references rather than raw hex values. This means all
bespoke step-content components that thread `t: LabTheme` through to inline styles automatically
inherit the active theme with zero rewrites when a new theme is added.

Fields that are not color references remain as concrete values: `glass: boolean` (whether to apply
`backdrop-filter`), `id` (theme name), `gridLine` (the blueprint-grid image string), and the two
font-class strings `fontBody`/`fontMono`. The `LIGHT` and `DARK` constants are the two shipped
themes; `LAB_THEMES` is the authoritative array.

### Primitive kit — `ui/`

All generic controls live in `src/components/layout-lab/ui/` and consume the token layer directly:

| Primitive | Notes |
|-----------|-------|
| `Panel` | Bordered container; `glass` prop adds `backdrop-filter` |
| `Button` | Ghost / solid / accent variants; `active` → `aria-pressed`; `mono` switches to mono font; `ariaLabel` prop and HTML `aria-label` attribute both work (prop wins) |
| `IconButton` | Square variant of Button for icon-only actions (wraps `VisuallyHidden` label) |
| `Chip` | Inline status badge; color via token name |
| `Stat` | Label+value pair used in the composition-screen header strip |
| `Field` / `Input` / `Textarea` | Labeled form controls; min font-size `var(--lab-fs-sm)` (≥ 14 px) |
| `Rail` | Titled scrollable column shell used by the catalog tree and pipeline timeline |
| `VisuallyHidden` | SR-only text for icon buttons and decorative elements |

Every primitive carries the `.focus-ring` class so keyboard focus is styled by the unified global
token (`var(--focus-accent)` → `var(--lab-accent)` inside `[data-lab-root]`).

### Hooks

**`useLabPrefs`** (`src/components/layout-lab/hooks/useLabPrefs.ts`):
Persists user preferences across sessions: `themeId` (Blueprint/Studio Dark) and
`lastCatalogId`/`lastEntityId` (restore the user's last location on return). SSR-safe: the hook
returns `hydrated: false` during SSR / first paint, and `LayoutLab`
defers the last-location restore until `hydrated` flips true (React adjust-state-during-render,
StrictMode-safe, no `useEffect` state mutation).

**`useRovingFocus`** (`src/components/layout-lab/hooks/useRovingFocus.ts`):
Implements roving tabindex for ordered lists of interactive elements (the nav rail and pipeline
rail). Manages a single `tabIndex={0}` among siblings; Arrow Down/Up (and j/k vim keys), Home/End
move focus; Enter activates. Used by `PipelineRail` (step timeline) and `CatalogTree` (catalog
rows).

### Chrome

The top `<header>` in `LayoutLab` applies Blueprint (title-block) or Studio (glass command bar)
chrome based on `theme.glass`. The right-corner icon `ThemeToggle` flips `themeId` via `useLabPrefs`,
which persists the selection immediately so a page reload restores the exact theme.

### Motion

View swaps between Catalogs / Matrix / Canon use framer-motion `<AnimatePresence mode="wait">`
with a 180 ms opacity + 6 px y-shift. List-entrance stagger in panel grids uses
`motion.div` with `transition.delay = index * 0.04`. Both paths gate on `useReducedMotion()` —
when `prefers-reduced-motion: reduce` is set the variants collapse to an immediate opacity-only
fade (or are disabled entirely for the y-axis), satisfying WCAG SC 2.3.3.

The same preference is honored via a **layered policy**. **Layer 0 is `AppMotionProvider`**
(`src/components/providers/AppMotionProvider.tsx`), mounted in `src/app/layout.tsx`, which supplies the
app's only `MotionConfig` with `reducedMotion="user"` — framer-motion defaults to `"never"` and **never
reads the CSS media query**, so without it every `motion.*` element ignores the OS preference. It
neutralises all *positional* animation (transform props, `width/height/top/left/right/bottom`, and
`layout`/`layoutId`). Non-positional loops — `opacity`, `borderColor`, `boxShadow`, `strokeDashoffset`,
SVG `r` — **keep animating by framer's design** and must gate themselves with
`motionSafe(t, prefersReduced)`; `src/__tests__/a11y/motion-loop-guard.test.ts` enforces that every
`repeat: Infinity` site does. The remaining layers cover non-framer motion (see the header comment on the
`@media (prefers-reduced-motion: reduce)` block in `globals.css`): (1) that block
zeroes every CSS animation/transition *duration* app-wide (progress fills like the shared `MeterBar`
grow-in `.meter-fill-grow`, grid-row expand/collapse, chip tweens, `animate-pulse` skeletons snap
instantly); (2) JS entrance motion collapses via
`useReducedMotion()` in `components/ui/Stagger.tsx`; (3) instant scale *transforms* a zeroed duration
can't remove (hover/active `scale`) are gated behind Tailwind's `motion-safe:` variant at each site
(e.g. `FeatureCard`, `FeatureMatrix` row actions), leaving only opacity/brightness feedback;
(4) SMIL `<animate>` elements are **not** affected by the CSS duration rule, so looping SVG
animations gate on `useReducedMotion()` in JS — only rendering the `<animate>` when motion is
allowed and otherwise falling back to a static stroke/dash highlight (e.g. the marching-ants and
modified-edge blink in `AnimationStateMachine`).

### Accessibility

- **Roving keyboard nav**: `PipelineRail` and `CatalogTree` use `useRovingFocus` so Arrow keys,
  j/k, Home/End, and Enter navigate and activate without Tab-stop flooding.
- **Skip-to-canvas link**: a visually-hidden skip link is the first child inside
  `[data-testid="harness-lab-ready"]`. It becomes visible on focus (`transform: translateY(0)`)
  and targets `#lab-canvas` (`<main id="lab-canvas" tabIndex={-1}>`), letting keyboard users
  bypass the header and side columns in one keystroke.
- **Focus rings**: every interactive element in the lab uses the unified `.focus-ring` global
  class (defined in `globals.css`). Inside `[data-lab-root]` the `--focus-accent` CSS variable
  resolves to `--lab-accent`, so focus rings inherit the active theme automatically.
- **Aria roles**: `PipelineRail` renders a `role="list"` with an accessible name; each step
  button carries the aria label returned by the `ariaFor` callback (step name + status + tier).
- **Disclosures**: icon-only expand/collapse toggles use the shared `useDisclosure` hook
  (`src/hooks/useDisclosure.ts`) — it owns the open state and returns matched `buttonProps`
  (`aria-expanded` + `aria-controls`) and `panelProps` (`id` via `useId`) so screen-reader and
  keyboard users know whether a region is open and which one the button controls. For
  parent-owned open state (a card driven by a prop), use the `disclosureA11y(open, panelId)`
  helper. Applied across the GDD compliance + design-doc views (gap rows, section cards,
  subsections, suggestions panel, module cards); decorative chevrons are `aria-hidden`. Score
  rings and Mermaid diagram blocks carry `role="img"` + an `aria-label` (e.g. "Compliance score
  82 out of 100", "<section> diagram") so the headline number / diagram isn't lost to AT.
- **Accessible dialogs**: the shared `Modal` shell (`src/components/ui/Modal.tsx`) owns every
  cross-cutting dialog concern so individual modals only supply content — an `AnimatePresence`
  fade backdrop + scale-0.96→1 / opacity spring panel (gated on `useReducedMotion()`),
  `role="dialog"` + `aria-modal` + `aria-labelledby` (from the rendered title) / `aria-label`
  fallback, a Tab/Shift+Tab focus trap, initial focus into the dialog (`initialFocusRef` or the
  first focusable), Escape-to-close, backdrop-click-to-close, and focus restored to the trigger on
  close. First adopter: the evaluator's Author-Pattern modal (`PatternLibraryView`).
- **Confirm dialogs own the outcome**: `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`) takes
  the confirmed operation itself - `onConfirm: () => void | Promise<unknown>`. The confirm disarms
  synchronously on click (a ref, so a same-tick double click runs it once); while the promise runs the
  button is busy (`aria-busy`, disabled, `busyLabel`) and Cancel / Escape / backdrop / header X are
  inert; it closes (`onClose`) only when the operation resolves; a rejection or a resolved `Result` err
  keeps it open with the reason in a `role="alert"` and turns Confirm into `retryLabel`, which re-runs
  the SAME operation. Outcome rules are pure in `confirmOutcome.ts` (anything that is not a throw or a
  `Result` err is success). A sync callback returning nothing closes in the same click, as before.
  Consumers return their promise (never `void op()`) and do not keep a parallel delete-error/retry state;
  a success-with-warning (e.g. audio rows deleted but files left on disk) stays a page banner.

---

## See also

- [Overview](overview.md) — top-level architecture
- [Catalog pipeline chassis](../catalog/index.md) — `StepSpec`, `getCatalogPipeline`, per-catalog
  pipeline registry, `resolveAccept`, acceptance tiers
- [L3/L4 live-UE runner](../catalog/L3-L4-RUNNER.md) — what `drainGates` triggers server-side
- [Runtime patterns](runtime-patterns.md) — `Lifecycle<T>`, `useSuspendableEffect`, LRU suspend,
  event bus
- [Catalog authoring](../catalog/AUTHORING.md) — manual-authoring recipe + the one-shot alternative path
- [Lab Shell v2 design spec](../superpowers/specs/2026-05-28-lab-shell-v2-design.md) — original
  Ring-by-Ring spec for the token system, primitive kit, hooks, chrome, and a11y work
