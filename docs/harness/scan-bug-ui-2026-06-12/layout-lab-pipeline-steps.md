# Layout Lab & Pipeline Steps — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. ArchetypeStep's gallery `generate`/`reselect` still has the stale-closure batch-drop that 3d50330 fixed only in ItemArt
- **Severity**: High
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/layout-lab/steps/ArchetypeStep.tsx:91`
- **Scenario**: On any non-items gallery-archetype step (registry StepSpecs with `view.kind === 'gallery'`), the user double-clicks "⚡ Generate … (CLI)" (or fires two dispatches before a re-render lands). Both handlers read `history` from the render closure, both compute `seq: history.batches.length === N`, both mint batch `bN` with colliding candidate ids (`bN-c0`…), and the second `produce()` overwrites the first's append — a whole kept batch silently vanishes from the "kept across re-rolls" gallery.
- **Root cause**: Commit 3d50330 added `produceFrom(entityId, step, build)` (build runs against LIVE store state inside `set`) and migrated `useGenerativeStep` in `ItemArt.tsx` — but `ArchetypeStep.tsx` has its own verbatim copies of `generate` (lines 91–102) and `reselect` (103–106) that still call plain `produce` with closure-read `readHistory(art?.data)`. The fix was applied to the bespoke Items renderer only; the canonical generic renderer kept the bug. Note: `CliProduce` is invoked here without `minDispatchMs`, so its `dispatching` double-click guard is inactive — store-level serialization was the only protection, and this path doesn't have it. (I verified `produceFrom` itself is sound: the updater runs once, `_labSync` fires after `set`; the regression is the unmigrated twin, not the new method.)
- **Impact**: Data loss (a generated batch + its direction/prompt provenance is dropped) and id collisions that make `selectedCandidate` resolution ambiguous for the surviving history; `reselect` can also resurrect a stale `selectedId` over a just-appended batch.
- **Fix sketch**: Mirror 3d50330: subscribe `produceFrom` in `ArchetypeStep`, move `readHistory`/`makeBatch`/`appendBatch` (and `selectCandidate` for `reselect`) into the `build(prevData)` callback, keeping the `spec.produce(entity)` baseline as `historyData`'s `extra`. Better: extract `useGenerativeStep` from `ItemArt.tsx` into `shared/` and use it in both renderers so the two copies can't drift again.

## 2. Items step lists diverge between Baseline and the registry — matrix jumps open the wrong step and matrix statuses lie for `items`
- **Severity**: High
- **Lens**: bug
- **Category**: state-corruption (cross-view contract mismatch)
- **File**: `src/components/layout-lab/Baseline.tsx:78`
- **Scenario**: A registered `items` StepSpec pipeline now exists (`src/lib/catalog/pipelines/items.ts:34`, 11 labels: Concept Brief, Base Type & Rarity, Affixes, Damage / Implicit, Economy, Material, Icon 2D Art, 3D Mesh, Tooltip / Compare, Test Gate, UE Packaging). `CatalogMatrix` (CatalogMatrix.tsx:45–48) prefers the registry for ALL catalogs, but Baseline special-cases `items` to the bespoke 13-name list (ITEM_STEP_NAMES). User opens Matrix for items and clicks the "Economy" cell (registry index 4) → `openFromMatrix('items', eid, 4)` → Baseline remounts with `initialStepIdx=4` against ITEM_STEP_NAMES → "3D Generation" opens. Clicking registry "Test Gate" (index 9) opens "Inventory UI Integration".
- **Root cause**: The step index is passed across views as a bare integer with no shared step-list contract; Baseline's hybrid rule (`catalogId !== 'items' && pipeline ? registry : detail.steps`) and the matrix's rule (`pipeline ? registry : detail.steps`) disagree exactly for `items`. The same divergence makes the matrix compute `row?.has(s)` with registry labels against artifacts produced under ITEM_STEP_NAMES — so a fully produced item (13/13 pass in Baseline) shows only the ~6 overlapping labels as done in the matrix, and columns like "Affixes"/"3D Mesh" can never leave pending.
- **Impact**: Wrong results + misnavigation on the flagship catalog: the matrix under-reports items completion (config-complete items look blocked/incomplete), and cell jumps land the operator on a different step than the one they clicked, inviting produces against the wrong step.
- **Fix sketch**: Single-source the step list: either pass the step *label* through `onOpenStep` and have Baseline resolve the index against its own list (graceful no-match → step 0), or make `CatalogMatrix` use the same hybrid rule as Baseline (special-case `items` to `detail.steps`). Long-term, reconcile the registered items pipeline labels with ITEM_STEP_NAMES so there is one items step list.

## 3. One-shot toast "Open" navigation is silently swallowed unless the Catalogs view is active
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/layout-lab/LayoutLab.tsx:62`
- **Scenario**: A one-shot job completes while the user is on the Canon or Matrix view. They click "Open" on the completion toast (`toastHandler.ts` → `setPendingNavigation({catalogId, entityId})`). LayoutLab's subscription sets `catalogId`/`entityId` and immediately clears `pendingNavigation` — but never calls `setView('catalogs')`. On Canon, nothing visible happens at all; on Matrix, only the catalog dropdown retargets. The navigation intent is consumed and gone. Even on the Catalogs view, Baseline keeps its current `stepIdx` (the reset only happens via `handleSelectCatalog`), so the user lands mid-pipeline of the new entity — or in the "Select a pipeline step" empty state if the old index exceeds the new catalog's step count.
- **Root cause**: The pendingNavigation consumer assumes the Baseline view is mounted and that catalog/entity state changes are sufficient navigation; it neither switches the view nor resets step/persisted prefs (`setPrefs` is also skipped, so a reload restores the pre-navigation location).
- **Impact**: A primary post-job affordance (jump to the produced entity) silently no-ops or lands on the wrong step; the one-shot result the user wanted to inspect never appears, with no error.
- **Fix sketch**: In the subscription handler, also `setView('catalogs')`, reset the step (e.g. `setFocusStepIdx(0)` + remount or lift a step-reset callback), and call `setPrefs({ lastCatalogId, lastEntityId })` so the navigation is real, durable, and view-independent.

## 4. `runDrain` discards the drain outcome — a failed/offline drain ends with zero feedback
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/layout-lab/Baseline.tsx:137`
- **Scenario**: The operator clicks "Run deferred gates". The dev server is offline, the drain route 500s, or the runner skips every gate. `drainGates` converts all of that to a non-throwing `null` / `{skipped: n}` (`labArtifactClient.ts:38-45`), and `runDrain` ignores the return value entirely: the button shows "Running…", then reverts; chips stay deferred; no error, no summary. The code then refetches and overwrites `serverArts` anyway, as if the drain ran.
- **Root cause**: `DrainSummaryLite { ran, passed, failed, skipped }` exists precisely to report the outcome, but the only consumer drops it on the floor, and the `null` failure signal is never branched on. (Distinct from the 2026-06-09 findings: #1 covered the stale-entity race in this handler and #3 covered the produce-POST write-through; the drain *result/error* channel is a separate gap.)
- **Impact**: Success theater on an operator-triggered action: an operator can believe deferred L3/L4 gates were exercised when nothing ran, and has no signal to retry or check the bridge — false confidence in untested gates.
- **Fix sketch**: Capture `const summary = await drainGates(...)`; on `null`, surface an error state (toast or inline text next to the button) and skip the refetch; on success, show a transient "ran X · passed Y · failed Z · skipped W" line (PipelineRollup already has the layout for it).

## UI findings

## 5. The canonical Produce form is invisible to keyboard and screen-reader users at three points
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/layout-lab/steps/controls.tsx:22`
- **Scenario**: Every pipeline step's Produce panel (CliProduce is the mandated shared component) renders a direction `LabTextarea` with inline `outline: 'none'` — which overrides the app's global `:focus-visible` ring (globals.css:178), so tabbing into the textarea (and `LabInput`, controls.tsx:29) shows no focus indicator at all. The "Direction (your input)" `Lbl` is a styled `<span>`, not a `<label htmlFor>`, so the textarea's only name is its vanishing placeholder. And the dispatch result ("✓ Dispatched…" / "✗ <error>") renders with no `aria-live`, so SR users never hear whether their produce succeeded or failed; the "view prompt" disclosure also lacks `aria-expanded`.
- **Root cause**: Hand-rolled inline-styled primitives predate the `.focus-ring` utility convention; status feedback was built as a purely visual AnimatePresence swap.
- **Impact**: App-wide (every step in every catalog uses this panel): keyboard users lose their place in the form, SR users can't name the main input and miss the core success/failure feedback of the lab's central action.
- **Fix sketch**: Drop `outline: 'none'` (or replace with the `.focus-ring` class) on LabTextarea/LabInput; give Lbl an `htmlFor`/`id` pairing (or wrap control in `<label>`); wrap the result span in a `role="status"` (aria-live polite) container and add `aria-expanded={showPrompt}` to the prompt toggle.

## 6. CatalogTree's `role="tree"` is structurally invalid and entities are outside the keyboard model
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/layout-lab/CatalogTree.tsx:88`
- **Scenario**: The container is `role="tree"` (line 166), but its children are bare `<button>`s: category headers (with `aria-expanded`, valid only on treeitems here) and entity rows with no `role="treeitem"`/`aria-selected` at all. The roving-focus arrow-key navigation covers only catalog rows — arrow keys skip straight past the entity rows nested under the selected catalog, so the tree's own keyboard model can't reach the things you actually open. The draft-discard "×" is a ~14px-font hit target well under the 24px minimum.
- **Root cause**: The roving-focus hook was added at the catalog level only, and the entity/category rows were never given tree semantics — AT sees a tree whose item count and hierarchy don't match what's on screen.
- **Impact**: Screen readers announce a malformed tree (wrong setsize/level, non-item children); keyboard users get an inconsistent hybrid (arrows for catalogs, Tab-only for entities); the discard target is hard to hit.
- **Fix sketch**: Give category headers `role="treeitem"` + `aria-expanded` with a `role="group"` for their catalogs, mark entity rows `role="treeitem"` `aria-selected`, and extend the roving index to the flattened visible node list (categories + catalogs + entities). Pad the "×" button to a 24px target.

## 7. The lab header never adapts below desktop widths while the body collapses at 1100px
- **Severity**: Medium
- **Lens**: ui
- **Category**: responsiveness
- **File**: `src/components/layout-lab/LayoutLab.tsx:121`
- **Scenario**: Baseline carefully collapses its 580px of columns into drawers below 1100px, but the header above it keeps a fixed center group of five buttons (Catalogs / Matrix / Canon / + One-shot / Legacy shell) plus the jobs chip, the bridge strip (whose label can be `UE 5.x · <project> · N assets`), and the theme toggle in a no-wrap flex row. Below ~1000px the center group and right cluster collide and overflow/clip — exactly the viewport range the drawer work was built for.
- **Root cause**: The header row has no `flexWrap`, no priority/overflow rule, and no narrow-shell variant; only the brand span is allowed to truncate (`minWidth: 0` + ellipsis), while every other child has fixed intrinsic width.
- **Impact**: On tablet-width windows (and the side-by-side layouts game devs actually use next to UE), primary navigation buttons become partially or fully unreachable.
- **Fix sketch**: Reuse the existing `useViewportWidth` breakpoint: below ~1100px collapse the view switcher into a compact segmented control or overflow menu, shorten the bridge strip to its status dot (full detail in the Bridge Doctor popover), or allow `flexWrap` with a second row.

## 8. Category headers' bottom separator is silently erased by a shorthand override
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/layout-lab/CatalogTree.tsx:186`
- **Scenario**: The category header button's style object sets `borderBottom: '1px solid var(--lab-line)'` and then, four keys later, `border: 'none'`. React applies style keys in insertion order, so the `border` shorthand resets all four sides — the intended hairline rule under each category never renders, in either theme.
- **Root cause**: Longhand-then-shorthand ordering inside one inline style object; the dead `borderBottom` declaration makes the omission invisible in code review.
- **Impact**: Tree sections blur together without their dividing rules — the visual hierarchy the blueprint aesthetic relies on (every other rail/panel in the lab uses `--lab-line` separators) is missing exactly here.
- **Fix sketch**: Replace `border: 'none'` with the longhands it actually intends (`borderTop/Left/Right: 'none'`), or order the shorthand before `borderBottom`.

## 9. Draft entities are listed under a catalog whose count excludes them
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/layout-lab/CatalogTree.tsx:66`
- **Scenario**: The catalog row badge renders `verified/total` from `useLabCatalogData` (useLabCatalogData.ts:33–40), which counts only seeded `entitiesByCatalog`. The entity rows expanded directly beneath it come from `useLabDetail`, which merges `draftEntitiesByCatalog`. Stage a one-shot draft and the row says "2/4" while five entities are visibly listed under it.
- **Root cause**: Two hooks derive "the catalog's entities" from different store slices; the tree mixes one's count with the other's list.
- **Impact**: The count is the tree's at-a-glance progress signal; when it disagrees with the visible rows users distrust it (or miss that a draft is pending promotion).
- **Fix sketch**: Include drafts in `useLabCatalogData`'s `total` (mirroring `useLabDetail`), or render drafts with a separate `+N draft` suffix on the badge so both numbers are honest.
