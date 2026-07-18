# Bestiary & Enemy Design — Bug + UI Scan

> Total: 8

## Bug findings

### 1. Elite modifier exclusion is one-directional and references a nonexistent modifier
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_bestiary/_shared/data.ts:278
- **Scenario**: `enraged` declares `excludes: ['pacified']`, but no modifier with id `pacified` exists anywhere in `ELITE_MODIFIERS`. Meanwhile `toggleCardModifier` (index.tsx:71-82) and `toggleBuilderModifier` (ArchetypeBuilder.tsx:18-25) only consult the *newly toggled* modifier's own `excludes` list — they never check whether an already-active modifier excludes the one being added.
- **Root cause**: The exclusion model is implicitly assumed to be symmetric/bidirectional by the toggle logic, but the data only encodes it one-way, and the one existing reference points at a modifier that was apparently removed or renamed without updating the reference.
- **Impact**: Today this is silently inert (the dangling reference never fires because `pacified` can't be selected), but it means the exclusivity guarantee shown to users ("mutually exclusive elite modifiers") is not actually enforced except for pairs where both sides remembered to declare `excludes`. Any future modifier that should be mutually exclusive with `enraged` (e.g. a calm/pacified-style buff) can silently coexist with it if only one side lists the exclusion — corrupting the preview stat math (`applyModifiers` will happily stack contradictory multipliers).
- **Fix sketch**: Either compute exclusion symmetrically (`isExcluded = mod.excludes?.includes(other.id) || other.excludes?.includes(mod.id)`) at both toggle sites, or add a build-time/test assertion that every `excludes` id resolves to a real modifier and that exclusion pairs are declared on both sides.

### 2. Radar-overlay toggle state is never pruned when an archetype leaves the comparison set
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_bestiary/index.tsx:52-86
- **Scenario**: User compares 4 archetypes (`toggleCompare` adds ids to `compareIds`), enables radar overlays for a couple of them via `toggleOverlay`, then removes one from comparison (`toggleCompare` again, which only filters `compareIds`). `radarOverlays[thatId]` is left at `true` in state forever — `toggleOverlay`/`setRadarOverlays` never has a code path that deletes keys for ids no longer in `compareIds`.
- **Root cause**: Two pieces of state (`compareIds` and `radarOverlays`) that are supposed to stay in lockstep ("compared enemies auto-added" per the inline comment) are updated by two independent callbacks with no reconciliation step.
- **Impact**: Stale overlay flags accumulate across a session. If `ArchetypesTab`/the radar chart derives "which overlays to render" from the keys of `radarOverlays` rather than intersecting with current `compareIds`, a removed archetype's overlay can keep rendering (ghost series on the chart) until the whole panel remounts. Even if the chart guards against it, the state object grows unbounded over a long session.
- **Fix sketch**: In `toggleCompare`, when removing an id, also strip it from `radarOverlays` (e.g. `setRadarOverlays(prev => { const {[id]: _, ...rest} = prev; return rest; })`), or derive the effective overlay set as `Object.keys(radarOverlays).filter(k => k === 'player' || compareIds.includes(k))` wherever it's consumed.

### 3. Spawn-system status badge keyed off a bare string, degrading silently to "unknown"
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/AILogicTab.tsx:32
- **Scenario**: `const spawnSc = STATUS_COLORS[featureMap.get('Spawn system')?.status ?? 'unknown']` looks up the feature row by the literal string `'Spawn system'`. If the underlying feature-matrix entry is ever renamed (e.g. to "Enemy Spawner" or a typo is introduced upstream in the feature catalog), the lookup returns `undefined` and the badge quietly falls back to the "unknown"/neutral status color.
- **Root cause**: No compile-time or runtime link between this string literal and the feature catalog's canonical row name — same brittle pattern as the `AI_PIPELINE.map(n => n.featureName)` lookups just above it, but this one is a single hardcoded literal instead of a shared constant.
- **Impact**: The Wave Spawner Configurator's status pill silently reports "unknown" forever after an unrelated rename elsewhere in the codebase, misleading anyone reading feature-completion status for the AI pipeline — success/failure theater with no error, no warning.
- **Fix sketch**: Pull the feature name from a shared constant (e.g. add it into `AI_PIPELINE` or a dedicated `SPAWN_SYSTEM_FEATURE_NAME` constant colocated with the feature-matrix source) so a rename is a single edit point, or assert in a test that `featureMap` always contains that key.

### 4. Decision-log entries use non-unique `tick` as both React key and the sole expand/collapse identity
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/DecisionDebugger.tsx:44-47, 53
- **Scenario**: `debugExpanded` state stores a single `entry.tick`, and each row's expand toggle compares `debugExpanded === entry.tick`; the `.map` also uses `key={entry.tick}`. Today's mock data happens to have unique ticks, but nothing enforces that (two AI decisions logged in the same simulation tick — e.g. an `evaluation` and a `selection` firing on the same frame — is a legitimate real scenario for a decision debugger).
- **Root cause**: `tick` is treated as a primary key with no uniqueness guarantee in the type (`DecisionEntry['tick']: number`), and it's reused for two unrelated purposes (list identity + toggle state) without deduplication.
- **Impact**: If two log rows ever share a tick, clicking to expand one silently expands both (since the equality check matches on the shared value), and React will warn about/collide on duplicate keys, potentially causing entries to swap DOM nodes and lose their exit animation.
- **Fix sketch**: Track expansion by array index or a synthesized unique id (e.g. `${tick}-${i}`) instead of the raw `tick` value, and use that same composite as the React `key`.

## UI findings

### 5. Perception Cone section has no responsive stacking, unlike every sibling section on the page
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/AILogicTab.tsx:94
- **Scenario**: `<div className="mt-3 flex items-center gap-4 min-h-[200px]">` lays the fixed 200×200px `PerceptionConeViz` SVG side-by-side with `PerceptionLegend`'s text column, with no `flex-wrap` and no `flex-col md:flex-row` breakpoint. Every other multi-column region in this same file (the Wave Spawner stat row, the BT Flowchart + details panel) explicitly uses `flex-col md:flex-row` or a responsive grid.
- **Root cause**: This one section was written with a plain `flex items-center` instead of following the responsive pattern used elsewhere in the same component.
- **Impact**: On narrow/mobile viewports the fixed-width SVG plus the legend's text content will overflow the panel horizontally (or crush the legend into an unreadably narrow column) instead of stacking vertically like the rest of the tab, breaking the mobile-first consistency of an otherwise responsive page.
- **Fix sketch**: Change the wrapper to `flex flex-col md:flex-row items-start md:items-center gap-4`, matching the BT Flowchart section's pattern directly below it.

### 6. BT search results discard tree hierarchy, leaving orphaned indentation with no parent context
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart.tsx:79-82
- **Scenario**: Typing a search term computes `matchIds` (nodes whose label/details match) and `visibleRows = flatRows.filter(r => matchIds.has(r.node.id))`. A deeply-nested match (e.g. depth 4) is rendered alone at its original `depth * INDENT` padding, but its ancestor rows (Selector/Sequence nodes that give the indentation meaning) are filtered out entirely since they don't match the search text themselves.
- **Root cause**: `effectiveCollapsed` correctly auto-expands ancestors so matches aren't hidden, but the final `visibleRows` filter only keeps matching nodes — it never also includes their ancestor chain for display.
- **Impact**: A search for e.g. "attack" can show a single indented leaf row floating at 60-80px of left padding with no visual sequence/selector node above it to explain why, making the tree structure unreadable during search — the opposite of what a search-and-highlight-in-context feature should do.
- **Fix sketch**: When `matchIds` is set, build the visible set as matched nodes plus all of their ancestors (walk up via a parent-lookup map), and visually de-emphasize (non-matching) ancestor rows rather than dropping them.

### 7. Active breadcrumb step communicated by color alone, no `aria-current` or non-color affordance
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_bestiary/NarrativeBreadcrumb.tsx:26-38
- **Scenario**: The active step differs from past/future steps only via `color`, `backgroundColor`, and `fontWeight` — there's no `aria-current="step"` (or similar) attribute on the button, and no non-color marker (underline, icon, border).
- **Root cause**: The breadcrumb was styled purely with inline color/weight logic; no semantic state attribute was added for assistive tech, and no icon/shape differentiator was added for low-vision/color-blind users.
- **Impact**: Screen-reader users get no indication of which step is current in the process breadcrumb (it reads as a flat list of buttons), and color-blind users relying only on the orange accent vs. muted text may struggle to distinguish "active" from "past" (both are bolded, differing mainly by opacity/hue).
- **Fix sketch**: Add `aria-current={isActive ? 'step' : undefined}` to the button, and add a persistent non-color cue for the active step (e.g. a bottom border or small dot) so state doesn't rely on hue alone.

### 8. No empty/zero-result state for filtered or empty data lists
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_bestiary/ai-logic/DecisionDebugger.tsx:42-86; src/components/modules/core-engine/sub_bestiary/ai-logic/AggroTable.tsx:36-54
- **Scenario**: `DecisionDebugger`'s filter buttons (`all/evaluation/selection/unexpected`) render `filteredDecisions.map(...)` directly with no guard for `filteredDecisions.length === 0`; likewise `AggroTable` maps over `AGGRO_TABLE`/`AGGRO_EVENTS` with no fallback if either collection is empty (e.g. a fresh encounter setup with no logged events yet).
- **Root cause**: Both components were built against the always-populated mock dataset, so the zero-item path was never exercised or designed for.
- **Impact**: If a filter yields no matches, or once this panel is wired to live data for an encounter that hasn't produced any decisions/aggro events yet, the panel silently renders an empty gap with only its header — no "No decisions logged yet" / "No aggro switches recorded" message, which reads as a broken or loading-forever panel rather than an intentional empty state.
- **Fix sketch**: Add a short empty-state message (reusing the existing italic `text-text-muted` style already used elsewhere, e.g. `BtDetailsPanel`'s "Click or press Enter..." placeholder) when the rendered list is empty.
