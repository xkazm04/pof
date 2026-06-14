# Module Registry & Feature Matrix — zen-perf scan
> Context: CLI Terminal & Module Shell / Module Registry & Feature Matrix
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. NBA dependent-count is an O(features) scan nested inside O(items) × O(modules)
- **Severity**: high
- **Lens**: performance
- **Category**: algorithmic-complexity
- **File**: src/lib/nba-engine.ts:147
- **Scenario**: Project-wide "what to do next" card (`computeProjectNBA`) and the per-module NBA card. Fires on mount and again on every checklist toggle (`useNBA` re-runs `computeNBA` when `progress` changes — useNBA.ts:59-65).
- **Root cause**: For each uncompleted checklist item that matches a feature, the code rescans the *entire* `depMap` (190 features, feature-definitions.ts has 190 `featureName:` entries) to count how many features depend on it:
  ```ts
  let dependentCount = 0;
  for (const [, info] of depMap) {
    if (info.deps.some((d) => d.key === featureKey)) dependentCount++;
  }
  ```
  This is computed at urgency (line 148) and reused for impact (line 176). The fan-out count is a *static property of the dependency graph* — it never varies with status or progress — yet `computeProjectNBA` (line 283-292) recomputes it for every item of every one of ~40 modules: roughly `modules × itemsPerModule × 190` `.some()` passes per call, every render.
- **Impact**: Hundreds-to-thousands of array scans per NBA computation, redone on each checklist tick. Pure waste — the answer is invariant across the whole session.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Build a one-time `dependentCount: Map<string, number>` inside `buildDependencyMap()` (it already does a full pass over every feature's `deps` at lines 458-464 — increment a counter per `dep.key` there). Memoize it alongside `_cachedDepMap`. In `computeNBA`, replace the inner loop with `dependentCountMap.get(featureKey) ?? 0`.

## 2. `DependencyInfo.chain` (transitive BFS) is dead computation kept alive only by a test
- **Severity**: high
- **Lens**: both
- **Category**: dead-code
- **File**: src/lib/feature-definitions.ts:466
- **Scenario**: Every call to `buildDependencyMap()` (first NBA compute, first FeatureMatrix render) runs a full breadth-first transitive-closure pass over all 190 features.
- **Root cause**: The second pass (lines 466-486) does BFS per feature to fill `info.chain` (the full transitive dependency chain). A repo-wide search shows `.chain` is read in exactly one place — `feature-definitions.test.ts:82` (`expect(info!.chain.length).toBeGreaterThanOrEqual(info!.deps.length)`). No production consumer exists: `computeBlockers`, `nba-engine`, and `FeatureMatrix.tsx` all read only `.deps` and `.blockers`. The most expensive part of the function exists solely to satisfy a test that asserts it is non-empty.
- **Impact**: An entire O(V·E) BFS over the graph runs for no product behavior. It also misleads readers into thinking transitive chains are surfaced somewhere. The result is cached so the cost is once-per-process, but it is 100% removable code + struct field.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Delete the BFS pass (lines 466-486) and the `chain` field from `DependencyInfo` (line 427), or move the transitive walk into a lazily-called helper if a future feature actually needs it. Update the orphaned test to assert on `.deps`/`.blockers` instead. Net: smaller struct, no startup BFS.

## 3. Feature grouping + category sort recomputed on every keystroke / expand (not memoized)
- **Severity**: medium
- **Lens**: performance
- **Category**: missing-memoization
- **File**: src/components/modules/shared/FeatureMatrix.tsx:391
- **Scenario**: Typing in the search box, toggling a row expand, toggling a filter chip, or the 5s `isFixing` refetch — any state change re-renders `FeatureMatrix`.
- **Root cause**: `filtered` is correctly wrapped in `useMemo` (line 341), but the very next lines are not:
  ```ts
  const grouped = filtered.reduce<Record<string, FeatureRow[]>>(...);   // line 391
  const categories = Object.keys(grouped).sort();                        // line 397
  const lastReviewed = features.find((f) => f.lastReviewedAt)?.lastReviewedAt; // 399
  const neverReviewed = features.length > 0 && features.every(...);      // 400
  ```
  These run on every render even when `filtered`/`features` are unchanged (e.g. expanding one row, which only changes `expandedRows`). The grouped view then maps over `categories` → `grouped[cat]` rebuilding the whole tree.
- **Impact**: Redundant reduce + sort + two full array scans over up to ~30 rows on each interaction. Minor per-frame cost but trivially avoidable and on the hot path of every list interaction.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: Wrap `grouped`/`categories` in one `useMemo([filtered])` and `lastReviewed`/`neverReviewed` in a `useMemo([features])`.

## 4. `all-statuses` full-table scan fetched twice when NBA card and Feature Matrix share a module view
- **Severity**: medium
- **Lens**: both
- **Category**: duplicate-fetch
- **File**: src/hooks/useNBA.ts:38
- **Scenario**: A module page that shows both the NBA "next best action" card and the Feature Matrix (the common module-shell layout). Both mount for the same `moduleId`.
- **Root cause**: `useNBA` fetches `/api/feature-matrix/all-statuses` (useNBA.ts:38) and `FeatureMatrix.tsx` independently fetches the same endpoint (`fetchAllStatuses`, lines 277/287). The route runs `getAllFeatureStatuses()` = `SELECT module_id, feature_name, status FROM feature_matrix` with no WHERE (feature-matrix-db.ts:325-329) — a full-table scan returning all 190+ rows, executed twice, with two separate in-memory `Map` builds. There is no shared cache/store; each consumer keeps its own copy.
- **Impact**: Two identical unfiltered table scans + payload transfers + Map constructions per module view. Grows linearly as the matrix table fills with review history across modules.
- **Effort**: 4 · **Value**: 4
- **Fix sketch**: Hoist the status map into a tiny shared store (or a `useFeatureStatuses()` hook with a module-level cache / SWR-style dedupe keyed by the endpoint) so both consumers share one fetch and one `Map`. The data is read-only between reviews, so a short TTL cache is safe.

## 5. `firstWordMatch` single-substring heuristic silently drives all four NBA match sites
- **Severity**: low
- **Lens**: architecture
- **Category**: fragile-abstraction
- **File**: src/lib/nba-engine.ts:81
- **Scenario**: Mapping a checklist item to its feature / evaluator-rec / pattern / failure-history. e.g. item "Implement combo system" vs feature "Combat feedback" — both first-word-overlap on unrelated tokens once labels share a leading word.
- **Root cause**: `firstWordMatch(label, candidate)` returns true if `label` merely *contains* the first whitespace token of `candidate` (`label.toLowerCase().includes(candidate.split(' ')[0])`). Short or common first words ("Create", "Implement", "Add", "Set") match across unrelated items. It is applied bidirectionally (line 138-139) and at four call sites (feature, evaluator rec line 183, pattern line 199, failure history line 227), so a single weak heuristic decides urgency/impact/success scoring with no key/id linkage — even though `ChecklistItem` already has an optional `features?: string[]` field (types/modules.ts:72) designed for exactly this mapping.
- **Impact**: Mis-attributed urgency/impact and pitfalls; recommendations can be confidently wrong. It is a correctness-quality smell more than a crash risk, hence low.
- **Effort**: 5 · **Value**: 3
- **Fix sketch**: Prefer the explicit `item.features` id linkage when present; fall back to `firstWordMatch` only for unmapped items. Optionally require the matched first token to exceed a length/stop-word threshold. Single change point since all sites already funnel through this one function.
