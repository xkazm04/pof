# Module Registry & Feature Matrix — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Auto-Verify's batch write can never persist (partial payload vs. full-upsert binding), so after commit 2dd1e06 the whole feature is silently dead while the UI claims "N statuses updated"
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/pof-bridge/verification-engine.ts:88-113` (write path: `src/app/api/feature-matrix/route.ts:27` → `src/lib/feature-matrix-db.ts:132-147`)
- **Scenario**: User with the UE5 bridge connected clicks "Auto-Verify". `autoUpdateFeatureMatrix` POSTs `{ featureName, status, reviewNotes }` per changed feature to `/api/feature-matrix`. The route does no shape validation and calls `upsertFeatures`, whose `stmt.run` binds `f.category`, `f.description`, and `JSON.stringify(f.filePaths)` — all `undefined` for this payload. better-sqlite3 throws `TypeError: SQLite3 can only bind numbers, strings, bigints, buffers, and null`, `withRoute` turns it into a 500, and `writeResult.ok` is false — every time, deterministically.
- **Root cause**: Caller/endpoint contract mismatch: `UpsertFeature` requires `category`/`description`/`filePaths`, but verification-engine sends a partial update to the full-upsert endpoint (only `/api/feature-matrix/import` has Zod defaults). Commit 2dd1e06 correctly gated `checklist.item.changed` emission on `writeResult.ok` — but for this caller that condition is unsatisfiable, so the fix didn't just stop the event storm, it made the emit loop dead code. Before the fix, events at least fired (against an unpersisted DB); now nothing persists AND nothing fires. The failure is swallowed: `autoUpdateFeatureMatrix` returns `results` regardless, so `VerificationSummaryBanner` renders "{changed.length} statuses updated" and per-row badges show `previous -> new`, while the refetched rows still show the old statuses.
- **Impact**: Auto-Verify is fully non-functional with confident success theater — verified statuses never reach the DB, downstream checklist auto-completion listeners never run, and the contradiction between the "verified" badge and the unchanged status column erodes trust.
- **Fix sketch**: Have verification-engine send complete upsert rows (merge from the `featureMap` it already fetched: keep existing category/description/filePaths) or use the PATCH-per-feature endpoint that only updates status. Add Zod validation (or defaults) to the `/api/feature-matrix` POST so partial rows 400 loudly instead of 500ing in the bind layer, and surface `writeResult.error` in the returned results so the banner can show a write failure.

## 2. One transient GET failure on mount triggers auto-seed, which overwrites a module's entire review data with `unknown`/empty
- **Severity**: High
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/hooks/useFeatureMatrix.ts:107-112` (destructive write: `src/lib/feature-matrix-db.ts:120-129`)
- **Scenario**: A module's matrix has been reviewed (statuses, quality scores, notes, file paths in the DB). The user opens that module while the GET `/api/feature-matrix?moduleId=…` transiently fails (dev-server restart mid-request, SQLITE_BUSY, network blip). The hook sets `error`, leaves `features` at its initial `[]`, and the auto-seed effect checks only `!isLoading && features.length === 0 && !seededRef.current.has(moduleId)` — it never checks `error` — so it POSTs the static definitions with `status: 'unknown'`, `reviewNotes: ''`, `filePaths: []`. `upsertFeatures`' `ON CONFLICT DO UPDATE` clobbers every column: statuses → unknown, quality_score → null, review_notes/next_steps → '', last_reviewed_at → null.
- **Root cause**: "Empty result" and "fetch failed" are conflated — both leave `features.length === 0` — and the seed path reuses the full-overwrite upsert instead of insert-if-missing semantics. The `cancelled` flag in the fetch effect is vestigial (checked after `fetchData` has already set state), so there is no guard anywhere between a failed read and a destructive write. Bonus silence: the seed payload is all-unknown, so `hasReviewData` is false and no review snapshot is captured — the wipe leaves no trace in history.
- **Impact**: Silent loss of a whole module's review data (statuses, scores, notes, file paths). NBA urgency/blocker scoring, cross-module dependency blockers, and the dashboard aggregates all regress to "unknown"; the user must re-run a full Claude review to recover.
- **Fix sketch**: Gate the seed on `!error` (seed only after a *successful* empty fetch). Make seeding non-destructive: either a dedicated `INSERT ... ON CONFLICT DO NOTHING` path or have `upsertFeatures` accept a `seedOnly` flag that skips the UPDATE clause. Both changes are one-liners and independently sufficient.

## 3. `/api/checklist/complete` accepts arbitrary moduleId/itemId, so a single mistyped CLI curl pushes module progress past 100% and falsely unlocks prerequisite gates
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/app/api/checklist/complete/route.ts:20-52` (consumed by `src/lib/feature-definitions.ts:88-94, 110-114`)
- **Scenario**: The CLI marks items complete via curl using IDs embedded in generated prompts. If Claude emits a wrong/typo'd id (`"ac-1 "` with trailing space, `"ac1"`, an id from another module) or a wrong moduleId, the route records it verbatim — there is no validation against `ARPG_CHECKLISTS`/`SUB_MODULE_MAP`. `moduleProgress()` then computes `done` by counting *all* truthy keys in the progress map but takes `total` from the registry checklist size, so `done > total` is possible: progress reads 117%, `currentProgress >= 50` / `moduleProgress(p) >= 50` gates in `getRecommendedNextModules`/`getUnmetPrerequisites` pass on phantom work, and "Ready — all prerequisites met" recommendations appear for modules whose real prerequisites are untouched.
- **Root cause**: The trust boundary between LLM-generated curl calls and the progress store has no schema: any string pair becomes a permanent `true` in `checklist_json`, and every consumer assumes progress keys are a subset of registry item ids.
- **Impact**: Wrong progress percentages (including >100%), prerequisite gating and next-module recommendations firing prematurely, and phantom keys that survive forever because the merge-on-save in `/api/project-progress` preserves keys the client never sends.
- **Fix sketch**: In the route, validate `moduleId` against `SUB_MODULE_MAP` and `itemId` against that module's checklist (`ARPG_CHECKLISTS`/registry); 400 on unknown ids. Defensively, make `moduleProgress` count only ids present in the module's checklist definition.

## 4. NBA reports 50% success probability for modules whose every attempt failed (`moduleSuccessRate || 0.5` falsy-zero)
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/nba-engine.ts:239-241`
- **Scenario**: A module's task history contains only failures (`successCount === 0`, `failCount > 0`), so `moduleSuccessRate` is exactly `0`. With no matching pattern, `successProbability = moduleSuccessRate || 0.5` evaluates `0 || 0.5` → `0.5`, and the recommendation card shows an estimated 50% success for an item in a module with a 0% track record. The score breakdown is internally inconsistent: `breakdown.successProb` correctly uses the raw `0`.
- **Root cause**: `||` used as a null-guard on a numeric value where `0` is a legitimate, maximally-meaningful rate. The "neutral default 0.5" was already applied upstream (line 122-124) for the no-history case, so the fallback here only ever activates on the all-failures case it misrepresents.
- **Impact**: Misleading success-probability display exactly when the warning matters most (a module where everything has failed), undermining the engine's "transparency" breakdown.
- **Fix sketch**: `const successProbability = matchedPattern ? matchedPattern.successRate : moduleSuccessRate;` — the upstream neutral default already handles empty history, so drop the `|| 0.5` entirely.

## UI findings

## 5. Row action buttons (Review / Copy / View files) are keyboard- and screen-reader-hostile: interactive spans nested inside the row button, hover-only reveal, no visible focus
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/shared/FeatureMatrix.tsx:1143-1218`
- **Scenario**: Each feature row is one big `<button>` that *contains* three `role="button" tabIndex={0}` spans. A keyboard user tabbing through rows lands on controls rendered at `opacity-30` (the reveal is `group-hover/row:opacity-100` only — focus does not trigger it) with no `focus-visible` ring, so they cannot tell what is focused. Space does not activate them (only Enter is handled), violating the `role="button"` contract. Screen readers encounter interactive content nested inside a button — invalid HTML that many AT flatten or announce unpredictably.
- **Root cause**: The whole row was made a `<button>` for expand/collapse, forcing the per-row actions to be faux-button spans inside it; the reveal affordance was designed for mouse hover only.
- **Impact**: WCAG failures (2.4.7 visible focus, 4.1.2 nested interactive roles, Space-key activation); the row actions are effectively mouse-only.
- **Fix sketch**: Make the row a `div` with a dedicated expand `<button>` (name + chevron) and render the actions as real sibling `<button>`s with `aria-label`s. Add `group-focus-within/row:opacity-100` alongside the hover rule and a `focus-visible:ring` style; handle Space via native buttons for free.

## 6. The "Grouped" view toggle is a dead button whenever a non-default sort is active — the auto-switch effect instantly reverts it
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/shared/FeatureMatrix.tsx:194-199` (toggle at 606-621)
- **Scenario**: User sorts by Status (view auto-switches to flat — fine), then clicks the LayoutGrid "Grouped by category" button. `setViewMode('grouped')` runs, the effect (deps include `viewMode`) sees `isNonDefaultSort && viewMode === 'grouped'` and immediately sets it back to `'flat'`. The button appears broken: it highlights for a frame and nothing changes, with no explanation.
- **Root cause**: The "auto-switch on sort" rule was written as a continuous invariant (effect on `[sortKey, sortDir, viewMode]`) instead of a one-shot transition on sort *change*, so it also vetoes explicit user intent.
- **Impact**: Users cannot return to grouped view without first discovering they must reset sort to Name/asc; a silently-ignored click is one of the most trust-damaging micro-interactions.
- **Fix sketch**: Move the auto-switch into `toggleSort` (set `viewMode('flat')` only when the user changes sort), delete the effect. If grouped+sorted is truly unsupported, instead disable the Grouped button with a tooltip ("Reset sort to group by category").

## 7. Sticky category headers hide under the filter bar when it wraps — hardcoded `top-[40px]` breaks at narrow widths
- **Severity**: Medium
- **Lens**: ui
- **Category**: responsiveness
- **File**: `src/components/modules/shared/FeatureMatrix.tsx:581, 669`
- **Scenario**: The search/quality/sort/view controls bar is `sticky top-0 z-10 ... flex-wrap`; category headers are `sticky top-[40px] z-[5]`. On a narrow panel (or long search placeholder + four sort buttons), the bar wraps to two or three lines (~70-100px tall), but headers still pin at 40px — they slide underneath the bar (lower z-index) and become unreadable, and rows scroll behind a sticky stack that covers more than it reserves.
- **Root cause**: The header offset is a magic number assuming a single-line controls bar; flex-wrap makes the bar's height content-dependent.
- **Impact**: At common split-pane widths the category navigation aid actively obscures content instead of helping orient, which is when sticky headers matter most.
- **Fix sketch**: Measure the controls bar with a ref/ResizeObserver and set the header `top` from a CSS variable (`top-[var(--filter-bar-h)]`), or prevent wrap (`overflow-x-auto` on the bar) so the 40px assumption holds.

## 8. Filter feedback is inconsistent: status-chip filtering shows no "Showing X of Y" count, and the no-match empty state offers no one-click reset
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/shared/FeatureMatrix.tsx:625-629, 714-718`
- **Scenario**: The "Showing {filtered} of {total} features" line renders only when `searchQuery || qualityMin > 1 || qualityMax < 5` — deselecting status chips (the most-used filter) hides rows with no count feedback. When filters combine to zero matches, the user gets "No features match your filters." and must manually undo search, re-enable up to four chips, and reset the quality range; since the state also persists into the URL, even a reload keeps the dead end.
- **Root cause**: The result-count condition wasn't updated when chip filters were added, and the empty state was written as text-only without an escape hatch.
- **Impact**: Users think features disappeared (chips silently exclude rows) and dig out of zero-result states by trial and error.
- **Fix sketch**: Include `activeFilters.size < FEATURE_STATUSES.length` in the result-count condition. Add a "Clear filters" button to the empty state (and next to the count) that resets search, chips, quality range, and URL params in one click.

## 9. Quality range min/max selects have no accessible labels and icon-only controls rely on `title` alone
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/shared/FeatureMatrix.tsx:811-837` (also sync button at 497-518, view toggles at 606-621)
- **Scenario**: A screen-reader user reaching the quality filter hears "1, combobox" twice with no indication of what the numbers mean or which is min vs. max. The sync (Download icon) and view-mode buttons expose only `title` as their name — functional but fragile (titles are skipped by some AT configs and never shown on touch).
- **Root cause**: Visual adjacency (star icon + "-" separator) carries the meaning; no `aria-label` was added when the control was composed from bare native selects and icon buttons.
- **Impact**: The quality filter is unusable non-visually; icon buttons are inconsistently named versus the labeled Auto-Verify/Review buttons beside them.
- **Fix sketch**: Add `aria-label="Minimum quality score"` / `"Maximum quality score"` to the selects and `aria-label`s (mirroring the titles) to the sync and view-mode buttons; add `aria-pressed` to the view-mode pair.
