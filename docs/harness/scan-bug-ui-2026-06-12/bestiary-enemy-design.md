# Bestiary & Enemy Design — Bug + UI scan (2026-06-12)

> Total: 8 findings (3 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Balance linter crashes on the exact malformed archetype it exists to flag (half-applied stats guard)
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/balance/bestiary-guardrails.ts:79-84`
- **Scenario**: Call `lintArchetypeBalance` with an archetype whose `stats` is `undefined`/`null` (the linter's own presence check at line 73 anticipates exactly this — untrusted structural input from future user-authored/remixed archetypes). Worse: lint a perfectly *valid* archetype while any same-tier **peer** in the roster has missing `stats`.
- **Root cause**: The guard `if (!entity.stats || entity.stats.length === 0)` pushes an error finding but does **not** return early. Execution continues to `findStat(entity.stats, ['health','hp'])` (line 82) → `stats.find` on `undefined` → TypeError. The peer path `peers.map((a) => findStat(a.stats, …))` (lines 79-80) has no guard at all, so one malformed roster entry poisons linting of every healthy peer in its tier. The design assumption "TS type says stats is always an array" is contradicted by the code's own defensive check.
- **Impact**: Crash instead of the intended `'has-core-stats'` error finding — the guardrail facet (BestiaryBalanceFacet) would throw on the precise data-quality problem it was built to report, and a single bad archetype breaks balance linting for the whole tier.
- **Fix sketch**: Early-return the presence-check findings when `!entity.stats?.length` (no point band-checking an entity without stats). Harden `findStat` to `(stats ?? []).find(...)` so malformed *peers* are skipped instead of throwing.

## 2. Perception cone visualizer draws the 800cm hearing ring at ~1180cm scale, overstating hearing range by ~47%
- **Severity**: Low
- **Lens**: bug
- **Category**: wrong-results
- **File**: `src/components/modules/core-engine/sub_bestiary/ai-logic/PerceptionConeViz.tsx:17,44`
- **Scenario**: A designer opens AI Logic → Perception Cone Visualizer to reason about sense ranges. The sight cone (labelled 1500cm) is drawn at `CONE_R = 56.9` units; the hearing circle (labelled 800cm in both the on-canvas label and `PerceptionLegend`) is drawn at `r = 44.7`. At the sight scale (1500cm / 56.9u ≈ 26.4cm per unit), 44.7u ≈ 1178cm — not 800cm, which would be ≈ 30.3u.
- **Root cause**: The two radii were picked visually, not derived from one cm→unit scale. `DETECTED_ENTITIES` was then placed against the *drawn* ring (the "NPC" at distance ≈ 32.7u is marked `inHearing: true`, which would be false under a true-scale 30.3u ring), so the diagram is internally consistent but quantitatively lies about the 800/1500 ratio it labels.
- **Impact**: Wrong results in a design-reference tool — designers tuning UE5 `AIPerception` hearing vs. sight configs against this diagram see hearing covering ~78% of sight radius when the real configured ratio is 53%.
- **Fix sketch**: Derive both radii from one scale: `const CM_PER_UNIT = 1500 / CONE_R; const HEARING_R = 800 / CM_PER_UNIT;` (≈30.3). Re-place `DETECTED_ENTITIES` (or compute `inHearing` from distance) so flags match the corrected geometry.

## 3. BT flowchart collapse toggles silently corrupt base collapse state while a search is active
- **Severity**: Low
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart.tsx:42-53,95-110`
- **Scenario**: User collapses "AttackSel", then searches "attack". The search auto-expands AttackSel (it's removed from `effectiveCollapsed` because a descendant matches) and the row shows a down-chevron / `aria-expanded=true`. The user clicks the chevron (or presses ArrowLeft) to collapse it: nothing visibly happens — but each press flips the hidden `collapsed` set. After clearing the search, nodes end up expanded/collapsed in whatever parity the invisible toggles left them, not the state the user last saw.
- **Root cause**: Rendering and the keyboard handlers read the derived `effectiveCollapsed` (search override), while `toggleCollapse` mutates the underlying `collapsed` set. During search the two diverge for auto-expanded ancestors, so a toggle is applied to state the UI isn't displaying — controls appear dead and intent is inverted (pressing "collapse" on an auto-expanded node actually deletes its base collapsed entry).
- **Impact**: Unresponsive-feeling chevrons/arrow keys during search plus surprise tree state after clearing it; `aria-expanded` also announces no change to screen readers despite the press registering.
- **Fix sketch**: In `toggleCollapse`, branch on `effectiveCollapsed` (collapse = add even if absent from base; expand = delete), or simpler: while `matchIds` is non-null, disable collapse affordances (hide chevrons, ignore ArrowLeft/Right) since search mode pins expansion anyway.

## UI findings

## 4. Behavior-tree widget puts every node in the tab order and hides hierarchy from assistive tech
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchartRow.tsx:31-36`
- **Scenario**: A keyboard user tabbing through the AI Logic tab must press Tab ~50 times (one per `BT_TREE` node) to get past the flowchart to the Decision Debugger; a screen-reader user hears 50 flat `treeitem`s with no level/position info, so the carefully-authored hierarchy (Root → Combat → MeleeSeq → …) is inaudible.
- **Root cause**: Every row hardcodes `tabIndex={0}` instead of the roving-tabindex pattern required for `role="tree"` (one tab stop, arrows move focus — the arrow handlers already exist in `BTFlowchart.tsx:78-117`). The flattened rows also omit `aria-level`, `aria-posinset`, and `aria-setsize`, which are mandatory when tree depth is conveyed only by `paddingLeft`.
- **Impact**: Keyboard navigation across the page is painful, and the component's substantial existing a11y investment (treeitem roles, aria-expanded, arrow nav) fails to deliver a usable tree to AT users.
- **Fix sketch**: Track a `focusedId` in `BTFlowchart`; render `tabIndex={row.node.id === focusedId ? 0 : -1}` and move `focusedId` in the arrow handlers. Pass `depth` through to `aria-level={depth + 1}` (FlatRow already carries depth) plus posinset/setsize computed during the flatten walk.

## 5. Hand-rolled eyebrow-label string duplicated 32 times across the bestiary instead of the MicroLabel primitive
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeBuilder.tsx:34` (also AggroTable.tsx:16,37; AILogicSidePanels.tsx:14,27; +9 more files)
- **Scenario**: Every section/field eyebrow in the bestiary ("Threat Values", "Sense Legend", "Name", "Stats", …) repeats the literal class string `text-xs font-mono uppercase tracking-[0.15em] text-text-muted` — 32 occurrences in 13 sub_bestiary files, 8 in ArchetypeBuilder alone.
- **Root cause**: `MicroLabel` (src/components/ui/MicroLabel.tsx) was introduced as *the* shared de-emphasized micro-text primitive (12px floor + AA tone tokens) and BTFlowchartRow/NarrativeBreadcrumb/index.tsx already migrated, but the rest of the module still hand-rolls the pattern, so tracking (0.15em vs MicroLabel's `tracking-wide`) and tone have already drifted between siblings.
- **Impact**: Inconsistent label typography within one module and a 13-file blast radius for any future label/tone/contrast adjustment (exactly what MicroLabel was built to prevent).
- **Fix sketch**: Replace the hand-rolled spans/divs with `<MicroLabel mono uppercase tone="muted" as="div">…</MicroLabel>` (add a tracking variant prop or accept `tracking-wide`); a quick codemod over the 32 occurrences keeps the visual diff to letter-spacing only.

## 6. Perception cone panel doesn't stack on narrow viewports, crushing the legend
- **Severity**: Medium
- **Lens**: ui
- **Category**: responsiveness
- **File**: `src/components/modules/core-engine/sub_bestiary/ai-logic/AILogicTab.tsx:94`
- **Scenario**: On a narrow window (or the module rendered in a half-width split), the Perception Cone row keeps the fixed 200px `flex-shrink-0` SVG beside the legend in a non-wrapping `flex items-center gap-4`; the legend (`flex-1 min-w-0`) is squeezed to ~100px and "Hearing Range / 800cm radius" plus the Detected list wrap into a ragged column or truncate.
- **Root cause**: Missing responsive stacking — the sibling Behavior Tree panel two lines below uses `flex flex-col md:flex-row gap-4` (line 104), but the perception row never got the same treatment.
- **Impact**: Unreadable legend on small widths and an inconsistency between two adjacent panels in the same tab that handle the identical layout problem differently.
- **Fix sketch**: Change line 94 to `mt-3 flex flex-col sm:flex-row sm:items-center gap-4 min-h-[200px]`, matching the BT panel's pattern.

## 7. Builder preview's effective stat value renders at 10px, below the module's documented 12px floor
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeBuilder.tsx:152`
- **Scenario**: In the Archetype Builder preview, the single most load-bearing number — the effective stat value after elite modifiers — is `text-2xs` (10px per globals.css:115), while the less important diff badge beside it and every other number in the card are `text-xs` (12px).
- **Root cause**: Leftover from before the MicroLabel/12px-floor cleanup; MicroLabel's own doc (src/components/ui/MicroLabel.tsx:36-38) states micro text must "never drop to text-[9px]/text-[10px]/text-2xs", and the rest of this module (BTFlowchartRow, breadcrumb) was migrated with explicit WCAG comments.
- **Impact**: The hardest-to-read text in the card is its primary readout; also visibly smaller than the sibling diff value on the same row, which reads as a glitch.
- **Fix sketch**: Change `text-2xs` to `text-xs` and widen the container from `w-6` to `w-7` so a 3-digit value at 12px mono still fits right-aligned.

## 8. BT node search has no empty state — zero matches renders a blank tree pane
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart.tsx:152-167`
- **Scenario**: Typing a non-matching query (e.g. "stun") empties `visibleRows`, so the tree list collapses to nothing; the only feedback is a tiny "0" overlaid inside the input and "0 / 50 nodes" in the toolbar. Users scanning the main pane see an unexplained void and there's no one-click way to recover.
- **Root cause**: The list renders `visibleRows.map(...)` with no zero-length branch, and the search input has no clear ("×") affordance — the count badge occupies the spot where a clear button would normally sit.
- **Impact**: Momentary "where did my tree go" confusion and extra keystrokes (manual select-all + delete) to restore the view; inconsistent with the app's other filterable lists that show empty-state copy.
- **Fix sketch**: After the map, render `visibleRows.length === 0 && <p className="text-xs text-text-muted italic px-1.5 py-2">No nodes match "{search}".</p>`; replace the count span with a clear button (`onClick={() => setSearch('')}`, aria-label="Clear search") and move the match count next to the node counter.
