# Bestiary & Enemy Design — zen-perf scan
> Context: Progression, World & Bestiary / Bestiary & Enemy Design
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. All archetype filter state lives in the parent, re-rendering every tab on each keystroke
- **Severity**: high
- **Lens**: both
- **Category**: state-placement / wasted-render
- **File**: src/components/modules/core-engine/sub_bestiary/index.tsx:48-66
- **Scenario**: User opens the Bestiary, is on the Archetypes tab, and types in the search box. Every keystroke updates `searchTerm` (line 52) held in `EnemyBestiary`, which re-renders the entire component — including the `AILogicTab`/`EncountersTab` branches, the `NarrativeBreadcrumb`, the `AnimatePresence` wrapper, and re-evaluates `getActiveSubtitle`.
- **Root cause**: Seven pieces of state used *only* by the Archetypes subtab (`searchTerm`, `roleFilter`, `categoryFilter`, `tierFilter`, `areaFilter`, `groupBy`, plus the `filteredArchetypes` memo over 94 archetypes at line 58-66) are hoisted into the top-level module component and threaded down as ~15 props (lines 145-150). The filtering memo recomputes a 5-stage `.filter` chain across `ARCHETYPES` (94 entries, from `data.ts:243` + `data-expanded.ts`) on every keystroke, and lower-case-izes `searchTerm` once per archetype per pass (line 60).
- **Impact**: Per-keystroke re-render of the whole Bestiary tree plus a 94-element multi-pass filter. The non-active tabs are short-circuited by `&&` so they don't render DOM, but the parent reconciliation, the framer-motion `motion.div` keyed on `activeTab`, and the prop fan-out all still run. Couples three unrelated subtabs to archetype-search churn.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Move `searchTerm`/role/category/tier/area/`groupBy` state and the `filteredArchetypes` memo down into `ArchetypesTab` (it already receives all the setters and even owns `page`/`prevFilterLen` locally — see ArchetypesTab.tsx:55-60). Only `compareIds`, `radarOverlays`, `cardModifiers`, `codegenMod` and `activeTab` need to stay lifted. This deletes ~12 props from the `index.tsx` ↔ `ArchetypesTab` boundary and confines search-churn to the one tab that uses it.

## 2. Two parallel behavior-tree data models for the same tree
- **Severity**: high
- **Lens**: architecture
- **Category**: duplicated model / divergent source of truth
- **File**: src/components/modules/core-engine/sub_bestiary/_shared/data.ts:494-529
- **Scenario**: A designer edits the BT (adds a node, flips an `active` flag). The flowchart (`BTFlowchart`) reads the new hierarchical `BT_TREE` from `data-expanded.ts`, but the "behavior tree" metric tile reads the old flat `BT_NODES`/`BT_EDGES` here — so the metric (node count, root detection) silently disagrees with the diagram.
- **Root cause**: Two incompatible representations of one concept coexist. The legacy positional graph — `BtNode` with hard-coded `x`/`y` pixel coords + a separate `BtEdge[]` adjacency list (`BT_NODES` 8 nodes, `BT_EDGES` 7 edges, data.ts:510-529) — is still consumed only by `metrics/BehaviorTreeMetric.tsx:3` (node count, edge walk, root filter). The actual flowchart switched to the richer hierarchical `BtTreeNode`/`BT_TREE` (50 nodes, `children[]` adjacency, data-expanded.ts:469-545). The two are never reconciled; `BtNode`/`BtEdge` types and the x/y coords are dead weight kept alive by one metric.
- **Impact**: Drift risk (metric vs. diagram), ~40 lines of stale data + two type definitions to maintain, and confusion for the next editor about which BT is canonical. The x/y fields on `BtNode` are pure dead data (no SVG graph renders them anymore — the flowchart is an indented list).
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Point `BehaviorTreeMetric` at `BT_TREE` (node count = `BT_TREE.length`; edge count = sum of `children.length`; root = the `'root'` node), then delete `BtNode`, `BtEdge`, `BT_NODES`, `BT_EDGES` from data.ts. One canonical tree.

## 3. Perception-cone runs N+1 infinite framer-motion loops continuously while mounted
- **Severity**: medium
- **Lens**: performance
- **Category**: always-on animation / no idle gating
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/PerceptionConeViz.tsx:53-91
- **Scenario**: User opens the AI-Logic tab and then reads the aggro table / decision debugger lower on the page. The cone sweep (`repeat: Infinity`, line 58) plus one pulse animation per detected entity (`repeat: Infinity`, line 82) keep ticking the rAF/compositor loop for as long as the tab stays mounted, even when the SVG is scrolled out of view, because nothing gates them on visibility.
- **Root cause**: All animations are unconditionally `repeat: Infinity`. Reduced-motion is honored (via `motionSafe`, line 57/81) but there is no IntersectionObserver/`whileInView` pause and no "freeze when off-screen" — the AI-Logic tab is a long scroll (pipeline, spawner, cone, BT flowchart, debugger, ability picker, AILogicTab.tsx:34-115), so the cone is frequently animating off-screen.
- **Impact**: 1 sweep + up to 3 entity pulses (DETECTED_ENTITIES has 3, two detected, data.ts:542-546) = ~3 perpetual compositor animations burning a small but constant amount of main-thread/GPU time and battery whenever the tab is open. Low data volume keeps it from being severe, but it never rests.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Wrap the animated `<motion.g>`/`<motion.circle>` in framer-motion's `whileInView` with `viewport={{ once: false }}`, or gate the whole SVG behind an IntersectionObserver and switch `animate` to a static state when not intersecting. Stops the loop the moment the cone scrolls away.

## 4. BTFlowchart keyboard navigation is coupled to DOM child ordering by positional index
- **Severity**: medium
- **Lens**: architecture
- **Category**: fragile coupling / leaky abstraction
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart.tsx:84-91
- **Scenario**: Arrow-key navigation on the tree assumes `listRef.current.children[idx]` lines up 1:1 with `visibleRows[idx]`. If any non-row element ever lands inside the `role="tree"` container (a divider, a "no matches" placeholder, an animated wrapper, a portal), focus jumps to the wrong node or silently no-ops.
- **Root cause**: Focus management bypasses React and reaches into raw DOM children by integer index (`listRef.current?.children[idx + 1] as HTMLElement`), re-deriving structure the component already knows from `visibleRows`. The model (`visibleRows`) and the view (DOM children) are kept in sync only by the invariant "every child is exactly one row in order" — an invariant nothing enforces.
- **Impact**: Brittle a11y/keyboard path; one layout tweak inside the tree container breaks arrow navigation with no type error. Also re-queries the DOM on every keypress instead of using refs the rows could register.
- **Effort**: 4 · **Value**: 4
- **Fix sketch**: Drive focus through a ref array (each `BTFlowchartRow` registers its element by `node.id`) or a roving-`tabIndex` controlled-focus index in state, and move focus by computing the next row id from `visibleRows`, not by DOM child index.

## 5. Staggered aggro-event list keyed by array index
- **Severity**: low
- **Lens**: performance
- **Category**: react-key / unnecessary remount
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/AggroTable.tsx:40
- **Scenario**: `AGGRO_EVENTS.map((evt, i) => <motion.div key={i} ... transition={{ delay: i * 0.1 }}>`. If the event log ever becomes dynamic (prepending newest-first, the natural shape for a "switch log"), index keys cause every row to be treated as changed, re-running the entrance animation for the whole list and losing element identity.
- **Root cause**: Index used as React key on an animated list (line 40) instead of a stable identity. The data is currently static (`AGGRO_EVENTS`, data.ts:663-667) so it is latent, but the same anti-pattern in `AGGRO_EVENTS` rows is the one place a future "live log" feature would bite.
- **Impact**: Today: none functional. Future: full-list re-animation and DOM thrash on any insert/reorder. Cheap to fix now while static.
- **Effort**: 1 · **Value**: 3
- **Fix sketch**: Key on a stable field — e.g. `key={`${evt.time}-${evt.to}`}` or add an `id` to `AggroEvent`. (The threat-bar list above already keys correctly on `entry.target`, line 18.)
