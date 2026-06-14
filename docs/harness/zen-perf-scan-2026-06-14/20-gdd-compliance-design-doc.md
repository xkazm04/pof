# GDD Compliance & Design Doc — zen-perf scan
> Context: Quality Evaluator & Health / GDD Compliance & Design Doc
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. `resolve-gap` mutates a shared server-side singleton — cross-project / cross-client corruption
- **Severity**: high
- **Lens**: architecture
- **Category**: shared mutable state / correctness
- **File**: src/app/api/gdd-compliance/route.ts:6
- **Scenario**: `let cachedReport` is module-level state on the server. Any client's `audit` overwrites it; then a *different* client (or the same user after switching projects) clicks "Resolve" and mutates whichever report happens to be cached — not the one shown on their screen. In dev with HMR the singleton also resets unpredictably, so `resolve-gap` returns "No audit report available" even right after an audit.
- **Root cause**: Resolve is implemented as a server round-trip against an in-memory cache instead of a pure client-side transform. The report already lives fully in the Zustand store (`gddComplianceStore.report`), and `resolveGap()` in `src/lib/gdd-compliance.ts:291` is a pure function — the server adds nothing but a shared-state hazard.
- **Impact**: Wrong gap resolved, lost resolutions, spurious 400s, and a serialization point that does not scale beyond one user. The store's optimistic `resolveGap` (gddComplianceStore.ts:95) also drops `reportProjectPath`/`reportChecklistHash`, so the next `ensureAudit` may not detect staleness.
- **Effort**: 3 · **Value**: 8
- **Fix sketch**: Delete the `resolve-gap` route branch and the `cachedReport` singleton. Have the store call the pure `resolveGap(get().report, gapId)` locally and `set` the result (preserving the project/hash fields). Resolution is per-session UI state anyway — it should never have been server-persisted.

## 2. `runComplianceAudit` issues 2×N redundant SQL queries and double-reads `feature_matrix`
- **Severity**: high
- **Lens**: performance
- **Category**: N+1 query / repeated work
- **File**: src/lib/gdd-compliance.ts:235
- **Scenario**: The loop over `SUB_MODULES` (~30+ game modules) calls `getFeaturesByModule(mod.id)` *and* `getFeatureSummary(mod.id)` per module — two separate `feature_matrix` queries (feature-matrix-db.ts:75 and :83) that scan the same rows. The full-row fetch already contains every `status`, so the summary is recomputable in JS for free.
- **Root cause**: Two single-module DB helpers reused inside a per-module loop instead of one table-wide `GROUP BY module_id` (the synthesizer already does exactly this at gdd-synthesizer.ts:111). Audit runs on every project switch and every checklist edit (via `ensureAudit`), so this is hot.
- **Impact**: ~60+ prepared-statement executions per audit where ~1–2 would do; redundant row materialization and aggregation. Latency grows linearly with module count and feature count, on a path that fires on routine UI interaction.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Add a `getAllFeatures()` / `getFeatureSummaryByModule()` that runs one `SELECT … GROUP BY module_id, status` and one `SELECT * ORDER BY module_id`, bucket both into `Map<moduleId, …>` once, then iterate `SUB_MODULES` against the maps. Derive `summary` from the already-fetched feature rows instead of re-querying.

## 3. `MarkdownBlock` re-parses every section on each unrelated parent re-render
- **Severity**: medium
- **Lens**: performance
- **Category**: missing memoization / unnecessary re-render
- **File**: src/components/modules/evaluator/GameDesignDocView.tsx:398
- **Scenario**: `GameDesignDocView` holds transient UI state (`copied`, `exporting`, `exportingPitch`, `exportingPdf`, `activeSectionId`, `expandedSections`). Any of these toggling — e.g. clicking Copy, or hovering the TOC — re-renders the whole tree. Every `GDDSectionCard` → `MarkdownBlock` then re-runs the full line-by-line parser (`split('\n')`, table scanning, regex `InlineMarkdown` per cell) for *all* sections, including collapsed ones, on a doc that can be many KB.
- **Root cause**: No `React.memo` on `GDDSectionCard`/`MarkdownBlock` and no `useMemo` around the parse. The parsed output depends only on `section.content`, which is immutable between regenerations.
- **Impact**: Visible jank on large GDDs; CPU burned re-tokenizing markdown for purely cosmetic state changes (the copy-feedback `setTimeout` alone forces two full re-parses per copy).
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: `useMemo(() => parse(content), [content])` inside `MarkdownBlock` (extract the while-loop into a pure function), and wrap `GDDSectionCard` in `React.memo`. Optionally lift the export-button state into a small child so toolbar churn doesn't re-render the section list at all.

## 4. Deployment "Avg Duration" uses a pairwise running mean — wrong number reported
- **Severity**: medium
- **Lens**: both
- **Category**: incorrect aggregation
- **File**: src/lib/gdd-synthesizer.ts:521
- **Scenario**: `p.avgDuration = (p.avgDuration + b.duration_ms) / 2` is computed per build. For 3+ builds this is not the arithmetic mean — it's an exponential blend that weights the most recent build ~50%, the previous ~25%, etc. With builds ordered `created_at DESC` (line 154), the displayed "Avg Duration" is dominated by the *oldest* build in the window, the opposite of intuition.
- **Root cause**: Classic incremental-average bug — dividing by 2 each step instead of accumulating `sum`/`count`. Same shape would mislead anyone reading the GDD's build table.
- **Impact**: The Build & Deployment section publishes a materially wrong average duration in an auto-generated, shareable/exported design doc (also flows into the markdown/pitch/PDF exports).
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Track `{ durationSum, durationCount }` on the per-platform accumulator and divide once when emitting the row. The `lastSize` "first non-null in DESC order" logic is fine; only the duration mean is broken.

## 5. `useDesignDocument` is unrelated to the GDD and the scope hint about hook overlap is a false lead — but it carries its own refetch waste
- **Severity**: low
- **Lens**: architecture
- **Category**: misnamed scope / over-fetching
- **File**: src/hooks/useDesignDocument.ts:48
- **Scenario**: Despite the similar name, `useDesignDocument` manages **level-design** documents against `/api/level-design` (level-design.ts types), and shares no code, types, or endpoint with `useGameDesignDoc` (the GDD synthesizer). There is no duplication to consolidate between them — they only collide by name. Separately, every `create`/`update`/`delete` here calls `fetchAll()` (lines 75, 91, 107), refetching the entire doc list + summary after each mutation even though the API already returns the affected `doc`.
- **Root cause**: Name collision invites a "merge these hooks" instinct that would be wrong. The real cost is the read-after-write pattern: a mutation that already returns the new row still triggers a full list reload.
- **Impact**: Mainly clarity (two same-sounding hooks in one context) plus a redundant `GET /api/level-design` per mutation. Low blast radius; flagged so a future refactor does not erroneously fold the two hooks together.
- **Effort**: 3 · **Value**: 3
- **Fix sketch**: Leave the two hooks separate (consider renaming `useDesignDocument` → `useLevelDesignDocs` to kill the confusion). Update local `docs`/`summary` state from the returned `doc` instead of `fetchAll()` on the create/update happy paths; keep the refetch only for delete or error recovery.
