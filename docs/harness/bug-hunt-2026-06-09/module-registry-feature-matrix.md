# Bug Hunt — Module Registry & Feature Matrix
> Total: 4
> Severity: 1 critical, 2 high, 1 medium

## 1. CLI-completed checklist items are silently overwritten by the store's full-state save (last-writer-wins on `project_progress`)
- **Severity**: critical
- **Category**: data-loss
- **File**: src/app/api/checklist/complete/route.ts:44-50 (vs src/app/api/project-progress/route.ts:70-85 and src/stores/moduleStore.ts:178-196)
- **Scenario**: A long-running CLI task finishes a checklist item and `POST /api/checklist/complete` does a read-modify-write that sets `progress[moduleId][itemId] = true` in the DB. Meanwhile the user toggles any *unrelated* checklist item in the UI. `toggleChecklistItem` calls `scheduleAutoSave()`, which fires `saveProgress()` → `POST /api/project-progress` and writes `checklistProgress` from the in-memory (localStorage) snapshot — which never saw the CLI's completion. The store's blind `ON CONFLICT DO UPDATE SET checklist_json = excluded.checklist_json` clobbers the entire blob, dropping the CLI-completed item.
- **Root cause**: Two writers mutate the same `checklist_json` column with two different strategies — one does a row-level read-modify-write of a single key, the other does a whole-document overwrite from stale client state. There is no per-field merge, no row version / `updated_at` compare-and-swap, and the client cache is treated as the source of truth even though the CLI writes server-side out of band. Whichever request lands second wins, and the store autosaves on every toggle, so the window is effectively always open.
- **Impact**: data loss — completed work disappears from the checklist; progress %, NBA recommendations, health scores, and "ready to start next module" gating all silently regress to a wrong state. Users redo finished tasks.
- **Fix sketch**: Make the column a merge target, not an overwrite target. Either (a) have `saveProgress` send only the keys it actually changed and merge server-side (read-modify-write like the complete route), or (b) add an `updated_at`/version guard so a stale full-document write is rejected (optimistic concurrency), or (c) split per-CLI completions into a separate append-only table and union it at read time. Any of these makes "two writers, one blob" structurally impossible.

## 2. `getReviewHistory` returns the OLDEST snapshots, so the quality sparkline freezes after 20 reviews
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/feature-matrix-db.ts:270-283
- **Scenario**: After a module accumulates more than `limit` (default 20) review snapshots, `SELECT ... ORDER BY reviewed_at ASC LIMIT ?` returns the *first* 20 snapshots ever recorded. The `QualitySparkline` and the "outdated" trend indicator in `FeatureMatrix.tsx` therefore render the same ancient history forever and never reflect recent reviews — the trend arrow can point "down" while quality is actually climbing.
- **Root cause**: The intent is "recent history," but `ASC LIMIT` selects the head of the table instead of the tail. The sibling `getAllReviewHistory` (lines 285-305) gets this right with `ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY reviewed_at DESC)`, proving the inconsistency. Ordering and "take N" were conflated — you cannot both order ascending for display *and* limit to the newest in a single clause.
- **Impact**: UX degradation / success theater — the trend visualization is stale and can be actively misleading once a module is reviewed regularly, which is exactly when the trend matters most.
- **Fix sketch**: Select the newest N in a subquery (`ORDER BY reviewed_at DESC LIMIT ?`) then re-sort ASC for charting, mirroring `getAllReviewHistory`. Centralize the "latest N snapshots" query so display order and recency selection can never be the same clause again.

## 3. `firstWordMatch('', …)` / empty candidate matches every checklist item, poisoning NBA scores from DB-sourced titles
- **Severity**: high
- **Category**: edge-case
- **File**: src/lib/nba-engine.ts:81-83 (consumed at 138-139, 183-185, 198-203, 226-228)
- **Scenario**: An evaluator recommendation or pattern row arrives from the DB with an empty or whitespace-only `title` (or a feature with a blank name). `firstWordMatch(item.label, '')` computes `''.split(' ')[0]` === `''`, and `label.toLowerCase().includes('')` is `true` for *every* label. That single empty-titled record then "matches" every uncompleted checklist item, applying its evaluator-priority urgency boost / pattern success-rate / pitfalls to all of them indiscriminately.
- **Root cause**: The matcher never guards against an empty token. `String.includes('')` is unconditionally true, so the central fuzzy heuristic degrades to "match-all" on empty input — a classic empty-set/adversarial-input landmine at a trust boundary (evaluator + pattern data are user/CLI-generated, not static).
- **Impact**: corruption of the recommendation ranking — wrong "next best action" surfaced project-wide (it flows into `computeProjectNBA` / Mission Control), bogus pitfalls attached to unrelated items, and inflated/deflated scores that look authoritative.
- **Fix sketch**: Make the match guard the empty case: `const token = candidate.toLowerCase().split(' ')[0]; return token.length > 0 && label.toLowerCase().includes(token);` Better, validate/skip records with blank titles at ingestion so the engine never scores against empty strings.

## 4. Feature-matrix progress poller divides by a stale/zero total and mis-counts on partial JSON, reporting bogus percentages
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/app/api/feature-matrix/progress/route.ts:38-54 (rendered by src/components/modules/shared/FeatureMatrix.tsx:225-240, 1355-1385)
- **Scenario**: During a CLI review the route reads `.pof/matrix/<moduleId>.json` while the CLI is mid-write. If `JSON.parse` succeeds on a *truncated-but-valid* prefix (e.g. an array the CLI hasn't finished appending to), `scanned` is undercounted; if parse fails, the fallback counts `"featureName":` substrings — which also matches the string `"featureName"` appearing inside any `reviewNotes`/`description` value, overcounting. Either way `scanned` can exceed or lag `total`, and `total` comes from the static `MODULE_FEATURE_DEFINITIONS` count, not from what the CLI is actually writing — so the two are unrelated denominators.
- **Root cause**: Progress is inferred by scraping a file that is being concurrently written, with no atomic-write/temp-rename contract and no agreement that the CLI emits exactly `total` features. The "count featureName keys" heuristic trusts that the marker never appears in free-text fields. Reading a partially-written file as a progress source is inherently racy.
- **Impact**: UX degradation — the progress bar (`ReviewProgressBar`) can stick, jump past 100% (capped, hiding the symptom), or show a percentage that never reaches done, eroding trust in whether a scan is actually progressing.
- **Fix sketch**: Have the CLI write to a temp file and atomically rename on completion so the route only ever reads complete JSON; emit an explicit `{ scanned, total }` progress field instead of inferring it; and derive `total` from the CLI's own declared plan rather than the static feature list so the two sides share one denominator.
