# Project Health & Insights — zen-perf scan
> Context: Quality Evaluator & Health / Project Health & Insights
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Overall-completion denominator disagrees with the weekly digest and the digest's own client count
- **Severity**: high
- **Lens**: both
- **Category**: correctness / data integrity
- **File**: src/lib/health-engine.ts:27 (and :406-408), src/lib/weekly-digest.ts:132, src/components/modules/evaluator/WeeklyDigestView.tsx:21-53
- **Scenario**: A user completes checklist items in non–core-engine modules (anything outside `ARPG_SUB_MODULES`). The Holistic Health dashboard's "Overall Completion" and burndown/milestones silently ignore those items, while the Weekly Digest's "Checklist X/Y" counts them. The two dashboards in the same Quality area show contradictory progress for the same project.
- **Root cause**: `health-engine.ts` uses `CORE_CHECKLIST_TOTAL` (module-registry.ts:1271 — sum over `ARPG_SUB_MODULES` only, the `core-engine` category) as both the denominator (`TOTAL_CHECKLIST_ITEMS`, line 27) and the module set it iterates (`CORE_MODULE_DEFS`, line 25). The weekly digest instead uses `ALL_CHECKLIST_TOTAL` (module-registry.ts:1278 — every `SUB_MODULES` checklist), and `WeeklyDigestView` computes `checklistCompleted` over `MODULE_ITEM_IDS` built from *all* `SUB_MODULES` with a checklist (lines 21-25, 43-53). So `completedChecklistItems` (numerator) and `TOTAL_CHECKLIST_ITEMS` (denominator) in the digest can disagree, and the health view's numerator is a strict subset of the digest's.
- **Impact**: Two headline percentages that should match never do once the user touches a non-core module; milestone predictions and the burndown chart (built from the same `TOTAL_CHECKLIST_ITEMS`) are biased high. Erodes trust in the whole health area.
- **Effort**: 2 · **Value**: 7
- **Fix sketch**: Decide one canonical scope. Either point both at `ALL_CHECKLIST_TOTAL`/all `SUB_MODULES`, or scope the digest client count to `CORE_MODULE_DEFS`. Whichever is chosen, have `computeModuleHealth`, `completedChecklistItems`, and the digest's `checklistTotal` derive from the *same* module list constant so they cannot drift.

## 2. HolisticHealthView re-POSTs `/api/project-health` on every store touch via an unstable effect
- **Severity**: high
- **Lens**: performance
- **Category**: re-render / redundant network + recompute
- **File**: src/components/modules/evaluator/HolisticHealthView.tsx:115-121
- **Scenario**: While the dashboard is mounted, any change to `checklistProgress`, `scanHistory`, or `lastScan` (e.g. the user ticks a checklist item, or a scan lands) re-runs `handleRefresh`, which fires a fresh POST that re-runs the entire `computeProjectHealth` aggregation (module health, simulated velocity, milestones, burndown, signals) and replaces all six store slices.
- **Root cause**: `handleRefresh` is a `useCallback` keyed on `[fetchHealth, checklistProgress, scanHistory, lastScan, perfInput, crashInput]` (lines 116-117). `checklistProgress`/`scanHistory`/`lastScan` are object/array references straight from their stores, so any update gives `handleRefresh` a new identity; the `useEffect(() => { handleRefresh(); }, [handleRefresh])` (lines 119-121) then re-fires. The values are also passed wholesale into the POST body, so the recompute is unconditional even when the derived numbers are unchanged.
- **Impact**: N redundant round-trips + full server recompute during normal checklist editing; each replaces store arrays, re-rendering every heatmap cell, milestone row, signal card, and chart. The `mulberry32`-seeded "velocity" is deterministic, so the extra work produces identical output — pure waste.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Fetch once on mount + on explicit Refresh click only: drop `handleRefresh` from the effect deps (run on `[]`, or gate with a manual "stale" flag). If live updates are desired, debounce and short-circuit when a cheap hash of the inputs is unchanged. Consider computing the deterministic parts client-side instead of a POST per keystroke.

## 3. `linkEntityToModule` scans all ~194 feature definitions per extracted entity (O(entities × features))
- **Severity**: medium
- **Lens**: performance
- **Category**: O(n·m) aggregation / missing index
- **File**: src/lib/structured-insights.ts:178-192 (called at :215 and :241)
- **Scenario**: Each `extractStructuredEntities` call (POST /api/structured-insights, run after CLI sessions) links every `class` and `concept` entity to a module. For a response yielding ~20 classes + ~10 concepts, that is 30 calls, each looping all 13 modules × ~194 total features and doing up to three lowercased `.includes()` substring tests per feature — thousands of string scans per insight, with `.toLowerCase()` recomputed on the same feature strings every time.
- **Root cause**: No precomputed index. `linkEntityToModule` rebuilds the same iteration and re-lowercases `feat.featureName`/`feat.description` on every invocation; the entity value is also re-lowercased once per call rather than once.
- **Impact**: Wasted CPU on a hot extraction path; scales linearly with both feature-definition growth and response size. Latency on session-completion writes.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Build a module-keyword index once at module load (lowercased feature names mapped to moduleId) and look entities up against it; or at minimum hoist the lowercased feature corpus to a memoized structure so it isn't recomputed per entity. Lowercase the entity value once at the top of the function (already done) and break on first match (already done).

## 4. Weekly-digest streak only inspects the last 200 sessions, silently truncating longest-streak
- **Severity**: medium
- **Lens**: both
- **Category**: correctness / hidden cap
- **File**: src/lib/weekly-digest.ts:107-128
- **Scenario**: `longestStreak` is computed over `SELECT success ... ORDER BY completed_at DESC LIMIT 200`. Once a project has >200 sessions, the all-time best streak is computed only over the most recent 200, so a genuine longest streak that ended earlier is lost, and the "Best streak" stat can *decrease* over time as older successes scroll out of the window.
- **Root cause**: The 200-row cap is a reasonable bound for `currentStreak` (which only needs the recent tail until the first failure) but is reused for `longestStreak`, conflating two different needs. The query also pulls all 200 rows back into JS to scan, rather than letting SQLite do the work.
- **Impact**: A "best streak" stat that regresses is a visible bug in a gamified digest; undermines the achievements derived from it (`streak-10`, `streak-5`). Low data volume today, but the failure mode is silent.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Compute `currentStreak` from a small recent-tail query (stop at first failure) and maintain `longestStreak` either as a persisted high-water mark updated on each session insert, or via a full-history aggregate query, decoupled from the 200-row cap.

## 5. `[...scanHistory].reverse()` rebuilt twice per row in the scan-history list render
- **Severity**: low
- **Lens**: performance
- **Category**: redundant allocation in render
- **File**: src/components/modules/evaluator/ProjectHealthDashboard.tsx:645-647
- **Scenario**: The "Scan History" list maps over `[...scanHistory].reverse().slice(0, 5)`, and *inside* the map callback computes `prev` with another `[...scanHistory].reverse()[idx + 1]` for each of the 5 rows. So the full array is copied and reversed 6 times on every render of the dashboard (which, given finding #2's re-render pressure, is frequent).
- **Root cause**: The reversed array is recreated inline instead of computed once; the per-row `prev` lookup re-derives it rather than indexing the already-reversed slice.
- **Impact**: 6 array copies/reversals per render for a small list — negligible in isolation, but it is pure, easily-removed waste on a hot component and obscures the delta logic.
- **Effort**: 1 · **Value**: 2
- **Fix sketch**: `const reversed = useMemo(() => [...scanHistory].reverse(), [scanHistory]);` then map `reversed.slice(0, 5)` and read `prev = reversed[idx + 1]`. One allocation, clearer intent.
