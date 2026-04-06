# Harness Learnings

Patterns and gotchas discovered during autonomous game development.

- [2026-04-06] Button elements default to cursor:default — always add cursor-pointer for clickable cards
- [2026-04-06] setAll and setMany should both check for no-op to avoid unnecessary re-renders and localStorage writes
- [2026-04-06] Tailwind scale transforms with hover/active give tactile feedback without needing framer-motion

- [2026-04-06] Existing implementation was high quality — only needed minor cleanup (redundant array copy, missing keyboard hint). Binary search + overscan virtual scroll pattern handles 100+ items well.

- [2026-04-06] ZoneMap ZONES array already has rich data (id, name, type, levelMin/Max, status) making EntityMetadata derivation straightforward
- [2026-04-06] ItemCatalog DUMMY_ITEMS.map() pattern is cleanest for deriving metadata from existing domain objects
- [2026-04-06] All 14 enemy IDs in ARCHETYPES already had area mappings — no coverage gap existed
- [2026-04-06] groupEntities handles numeric fields by String() coercion — works for display but Phase 2 may need range-based grouping for level fields

- [2026-04-06] Redundant data structures (navigableSet vs navigableIndexMap) add allocation cost for zero benefit — Map.has() serves both index lookup and membership testing. Building auxiliary index maps alongside existing offset computation loops adds O(1) lookups at zero extra pass cost.

- [2026-04-06] ITEM_METADATA affix category tags needed Set deduplication — items with multiple affixes of the same category (e.g. two 'offensive') produced duplicate tags
- [2026-04-06] LOOT_ENTRY_METADATA had category=rarity and tier=rarity — redundant fields. Added lootCategory() helper to infer Weapon/Consumable/Armor/Accessory from item name patterns

- [2026-04-06] React 19 ESLint plugin flags setState-in-useEffect (react-hooks/set-state-in-effect) and ref access during render (react-hooks/refs) — use the state-based previous value comparison pattern instead
- [2026-04-06] MiniBtn (button elements in general) need explicit cursor-pointer class even when they have onClick handlers

- [2026-04-06] Home/End/Ctrl+A keyboard handlers on modal wrappers must check if event target is an INPUT — otherwise they steal cursor-movement and text-selection keys from the search field. Same pattern as the existing Space key guard.

- [2026-04-06] CharacterBlueprint metrics were already fully implemented with all 13 section IDs mapped — no gaps found
- [2026-04-06] DODGE_TRAJECTORIES contains SVG path data not numeric distances — hardcoded dodge distance is the correct approach

- [2026-04-06] LOOT_GROUPINGS preset was missing despite LOOT_ENTRY_METADATA existing — every metadata domain should have a corresponding grouping preset for ScalableSelector integration
- [2026-04-06] CHARACTER_METADATA needed tier field (Hero/Elite/Standard) to match the field coverage pattern of other metadata domains
- [2026-04-06] lootSubcategory() regex helper mirrors lootCategory() pattern — infers weapon subtype (Sword/Bow/Staff) and consumable type (Healing/Buff/Utility) from entry names

- [2026-04-06] Existing AnimationStateGraph metrics implementation was already high quality — all 10 metrics correctly derive data from data.ts, use consistent styling patterns, and compute constants at module scope to avoid re-renders. PlayrateMetric has a smart fallback that shows blend-in time range when all montages share the same fps.

- [2026-04-06] CharacterBlueprint metrics were already fully implemented with all 13 section IDs mapped — no gaps found

- [2026-04-06] Existing AnimationStateGraph metrics implementation was already high quality — all 10 metrics correctly derive data from data.ts, use consistent styling patterns, and compute constants at module scope to avoid re-renders. PlayrateMetric has a smart fallback that shows blend-in time range when all montages share the same fps.

- [2026-04-06] rgba(255,255,255,...) was the dominant hardcoded pattern (216 occurrences) — 8-digit hex values were already cleaned up in a prior pass
- [2026-04-06] New OPACITY_2/3/4/6/40 constants needed for exact mapping of common rgba sub-10% and 40% values
- [2026-04-06] rgba(0,0,0,...) dark shadows and specific accent colors (168,85,247 purple, 6,182,212 cyan) have no semantic token — correctly left as-is
- [2026-04-06] SVG stroke/fill attributes accept both rgba() and #RRGGBBAA formats — withOpacity() works for both
- [2026-04-06] Tailwind arbitrary values like fill-[rgba(...)] must use hex+alpha format since they can't call JS functions

- [2026-04-06] ABILITY_METADATA was producing a meaningless 'none' tag when damageType was 'None' — always filter sentinel values before lowercasing into tags
- [2026-04-06] LOOT_ENTRY_METADATA tags were too sparse (rarity only) — category and subcategory should always appear as tags for consistent filterability across domains
- [2026-04-06] ZONE_METADATA had area=z.name duplicating the name field — zones ARE areas, so area field is redundant; added z.group tag instead for topology grouping
- [2026-04-06] groupEntities must check for 'Ungrouped' key BEFORE consulting the order index, otherwise 'Ungrouped' gets Infinity and sorts alphabetically among other overflow groups instead of always being last

- [2026-04-06] CharacterBlueprint metrics were already fully implemented with all 13 section IDs mapped — no gaps found

- [2026-04-06] Existing GAS Feature Metrics implementation was already complete and high quality — all 9 section IDs mapped with correct formats, proper chart-colors usage, and optimized single-pass useMemo computation

- [2026-04-06] All 9 Combat Action Map metrics were already fully implemented with correct data derivation, module-scope computation, and consistent styling — no modifications needed

- [2026-04-06] All 9 Enemy Bestiary feature metrics were already implemented and high quality — only ModifiersMetric had a bug counting modifiers-with-excludes instead of total exclusion entries

- [2026-04-06] All 9 Combat Action Map metrics were already fully implemented with correct data derivation, module-scope computation, and consistent styling — no modifications needed

- [2026-04-06] Existing GAS Feature Metrics implementation was already complete and high quality — all 9 section IDs mapped with correct formats, proper chart-colors usage, and optimized single-pass useMemo computation

- [2026-04-06] All 9 Enemy Bestiary feature metrics were already fully implemented with correct data derivation, module-scope computation, chart-colors usage, and consistent styling — no modifications needed in Part 2

- [2026-04-06] StatsMetric BAR_W formula Math.max(W/n - 1, 2) overflows when n*3 > W — use (W - n + 1)/n to ensure bars fit within SVG viewBox regardless of item count

- [2026-04-06] Existing GAS Feature Metrics implementation was already complete and high quality — all 9 section IDs mapped with correct formats, proper chart-colors usage, and optimized single-pass useMemo computation

- [2026-04-06] Tailwind arbitrary fill-[#RRGGBBAA] on SVG elements converts cleanly to inline fill={withOpacity()} attr — preserves className for font/size utilities while using design tokens for color
- [2026-04-06] Tailwind gradient hex classes (from-[#hex]/via-[#hex]) must convert to inline style={{ background: 'linear-gradient(...)' }} since they can't call JS functions — remove the gradient utility classes entirely
- [2026-04-06] 0 0 4px and 0 0 8px were the two most common inline glow radii (~25 combined occurrences) — 0 0 6px (20+ occurrences) has no exact GLOW constant and was correctly left untouched to preserve visual appearance

- [2026-04-06] All 11 Loot Table Visualizer feature metrics were already fully implemented with correct data derivation, module-scope computation, pre-computed IIFEs for mutable accumulation, and consistent styling — only HistogramMetric had an inconsistent color using RARITY_TIERS[0].color instead of ACCENT for its count text

- [2026-04-06] All 7 Item Catalog metrics were already fully implemented with correct data derivation, module-scope computation, chart-colors usage, overflow-safe bar chart, and consistent styling — no modifications needed in Part 2

- [2026-04-06] All 11 Loot Table Visualizer feature metrics were already fully implemented with correct data derivation, module-scope computation, pre-computed IIFEs for mutable accumulation, and consistent styling — no modifications needed

- [2026-04-06] Existing GAS Feature Metrics implementation was already complete and high quality — all 9 section IDs mapped with correct formats, proper chart-colors usage, and optimized single-pass useMemo computation

- [2026-04-06] All 11 Loot Table Visualizer feature metrics were already fully implemented with correct data derivation, module-scope computation, pre-computed IIFEs for mutable accumulation, and consistent styling — no modifications needed

- [2026-04-06] All 11 Loot Table Visualizer feature metrics were already fully implemented with correct data derivation, module-scope computation, pre-computed IIFEs for mutable accumulation, and consistent styling — no modifications needed

- [2026-04-06] All 11 Loot Table Visualizer feature metrics were already fully implemented with correct data derivation, module-scope computation, pre-computed IIFEs for mutable accumulation, and consistent styling — no modifications needed

- [2026-04-06] ScalableSelector SelectorItem requires index signature — use intersection type (SelectorItem & { ...fields }) rather than interface extends to satisfy the constraint
- [2026-04-06] STATE_NODES and AnimStateName are separate concerns — STATE_NODES defines the full state graph for browsing, AnimStateName covers only combat-critical states for responsiveness analysis
- [2026-04-06] Virtual scroll with absolute positioning + flat row list (headers + items) is simpler than nested virtual lists — single scrollTop drives all row positions
- [2026-04-06] Pre-computing category aggregates (MONTAGE_CATEGORY_COUNTS, MONTAGE_CATEGORY_MEMORY) at module scope avoids redundant computation in React renders

- [2026-04-06] ComboChainPanel nodes had hardcoded x positions (500, 600, 700) that overflowed the 400px SVG viewBox — dynamic layout with sequential positioning and computed viewBox width is needed when node count can grow
- [2026-04-06] SVG marker IDs should be shared (single <defs>) rather than duplicated per-edge to avoid ID collision and redundant DOM nodes
- [2026-04-06] React 19 flags setScrubberPlaying inside setScrubberFrame updater — use a ref to signal the stop condition and call the second setState outside the updater
- [2026-04-06] BudgetTab categoryColor had Emote and HitReact sharing STATUS_WARNING — every category needs a unique color for the stacked memory bar to be readable

- [2026-04-06] SpellbookAbility needs [key: string]: unknown index signature to satisfy SelectorItem constraint for ScalableSelector generic
- [2026-04-06] ScalableSelector groupBy works with single field — for category→element hierarchy, group by category and show element as badge in renderItem
- [2026-04-06] EXPANDED_EFFECTS grouped rendering uses Map<EffectDurationType, entries[]> for clean swim-lane display within pages
- [2026-04-06] Tag tree search uses recursive filterTree() that preserves parent nodes when children match — forceOpen prop bypasses local collapse state

- [2026-04-06] data.ts re-exports data-metrics.ts via `export * from './data-metrics'` — avoid importing the same symbol from both files
- [2026-04-06] HeatmapGrid lowColor/highColor props use raw hex which triggers lint warnings — these pre-existed and have no chart-colors semantic token
- [2026-04-06] WEAPONS array with 44 entries and COMBO_SEQUENCES with 32 entries provide sufficient scale for 100+ item testing when combined with ScalableSelector grouping

- [2026-04-06] SelectableCharacter with [key: string]: unknown index signature satisfies SelectorItem constraint while preserving typed property access — use this pattern for ScalableSelector integration
- [2026-04-06] CHAR_DEFS builder pattern generates both CHARACTER_METADATA and COMPARISON_CHARACTERS from a single source — prevents sync drift between metadata and stat arrays
- [2026-04-06] Original COMPARISON_CHARACTERS had broken 0-100 scale values (Jedi Guardian HP=85 vs maxVal=1500) — always verify stat values against maxVal ranges when expanding data
- [2026-04-06] TIER_LEVELS lookup provides default level/levelMax ranges per tier — avoids repeating level ranges in every character definition
- [2026-04-06] CameraProfileComparison multi-select uses minimum-1 guard pattern (same as character toggle) to prevent empty state

- [2026-04-06] COMBO_ABILITIES had 7 hardcoded hex colors (#60a5fa, #a78bfa, #22c55e, #f59e0b, #06b6d4, #e879f9, #7f1d1d) — mapped to STATUS_INFO, ACCENT_VIOLET, ACCENT_GREEN, STATUS_WARNING, ACCENT_CYAN, ACCENT_PINK, HEATMAP_STEP_1 respectively
- [2026-04-06] Recursive utility functions like countTags should never be called multiple times in JSX — memoize the result once and reuse
- [2026-04-06] When EXPANDED_EFFECTS is static, per-type counts can be precomputed in a useMemo with empty deps to avoid refiltering on each render

- [2026-04-06] SVG viewBox height must account for all dynamically-positioned elements — SEQ_EVENTS.length * spacing + offset determines required height
- [2026-04-06] Legacy type aliases (KotorWeapon/KOTOR_MELEE_WEAPONS) add indirection without benefit — direct references to Weapon/WEAPONS are clearer
- [2026-04-06] optgroup in select dropdowns and category-grouped grids with sticky headers significantly improve weapon browsability at 44+ items

- [2026-04-06] AbilityQuickPicker used hardcoded Tailwind emerald-500 classes — replaced with chart-colors ACCENT_EMERALD tokens via inline style to satisfy lint rules
- [2026-04-06] RMB was displayed as 'Unbound' in KeyboardVisualization mouse widget despite data.ts having Heavy Attack bound to RMB — must keep mouse widget in sync with INPUT_BINDINGS
- [2026-04-06] PropertiesMetric searched c.name==='Player' but actual name is 'AARPGPlayerCharacter' (id:'player') — worked by coincidence since player is COMPARISON_CHARACTERS[0]; fixed to use id lookup

- [2026-04-06] CameraProfileComparison peak computation was duplicated — .reduce() called twice in JSX for axis and value. Extract to local variable before JSX to avoid redundant array traversal.

- [2026-04-06] computeDps returning full breakdown object (effectiveDamage, effectiveSpeed, effectiveCrit, dps) eliminates need for duplicate inline computation — single source of truth for both detail display and comparison list
- [2026-04-06] CON stat slider was wired to state but never consumed by DPS formula — dead state variables add React reconciliation overhead for zero user value
- [2026-04-06] 44-item DPS comparison list needs max-h + overflow-y-auto to prevent unbounded panel growth — scroll containers are essential when data scale exceeds ~15 visible rows

- [2026-04-06] 17 of 51 hardcoded hex colors in CHAR_DEFS had exact chart-colors constant matches — replaced to reduce lint warnings from 51 to 34. Remaining 34 are entity identity colors with no semantic equivalent, correctly left as hardcoded hex per established pattern.

- [2026-04-06] React 19 ESLint immutability rule prevents mutating useMemo results — use state-based previous value comparison pattern (const [prev, setPrev] = useState(val); if (prev !== val) { setPrev(val); setPage(0); })
- [2026-04-06] Compact builder pattern (interface + factory function) dramatically reduces per-entity boilerplate when adding 80+ data entries — 5 lines per enemy vs 15+
- [2026-04-06] BT tree list layout with collapsible nodes scales better than SVG flowchart for 50+ nodes — eliminates coordinate computation and SVG overflow issues
- [2026-04-06] Virtual scroll with absolute positioning for wave editor: WAVE_ROW_H * index gives stable positions, overscan prevents visible gaps during fast scroll
- [2026-04-06] When expanding EnemyRole union type, all useState<narrowType> declarations need widening to match — TypeScript correctly catches the mismatch at prop boundaries

- [2026-04-06] SUBTABS already had the correct tab order — the redesign only needed narrative metadata and UI chrome additions
- [2026-04-06] BlueprintSubtabDef interface export enables other consumers to read narrative/subtitle metadata without coupling to internal state
- [2026-04-06] withOpacity with hex string '99' gives a clean 60% alpha for past-step breadcrumb coloring

- [2026-04-06] Builder pattern with compact tuple definitions [name, subtype, rarity, desc, effect?] + stat generators per type keeps 116 items under 250 lines
- [2026-04-06] import type from circular module works cleanly — TypeScript erases type imports at compile time so no runtime circular dependency
- [2026-04-06] ringColor is not a valid CSS property — use boxShadow: '0 0 0 1px color' for ring-like selection effect in inline styles
- [2026-04-06] ScalableSelector requires SelectorItem with [key: string]: unknown — use intersection type (ItemData & { [key: string]: unknown }) for casting
- [2026-04-06] SLOT_SUBTYPES mapping enables both slot-filtered item picking (loadout) and dynamic subtype filter dropdown (catalog) from a single source of truth

- [2026-04-06] getActiveSubtitle was called twice in JSX render — extract to local variable or IIFE to avoid redundant function call

- [2026-04-06] LootEditorEntryExpanded with [key: string]: unknown index signature causes Omit<> to lose typed property access — use a separate interface for raw entries to preserve type narrowing
- [2026-04-06] CSS ringColor is not a valid React style property — use outline: '1px solid color' instead for selection indicators
- [2026-04-06] RARITY_COLOR_MAP defined after EXPANDED_ENTRIES causes forward reference issues — define a local RARITY_TO_COLOR map before the entries array
- [2026-04-06] ScalableSelector requires SelectorItem with id:string — AffixDef and enemy binding wrapper types both need explicit id fields

- [2026-04-06] Character Blueprint flow redesign was already fully implemented with high quality across all 4 features — no modifications needed

- [2026-04-06] RADAR_DATA only covered 4 of 94 archetypes — stat-based radar derivation with role-specific range/aggression defaults fills the gap for expanded enemies
- [2026-04-06] Initializing radar overlays for all 94 archetypes renders an unreadable mess — default to player-only and let users toggle specific enemies
- [2026-04-06] RadarComparison overlay list needs search + scroll + show-more pattern to scale beyond ~10 items
- [2026-04-06] TacticsMap player marker used hardcoded #3b82f6 which is MODULE_COLORS.core
- [2026-04-06] ArchetypeBuilder preview had rgba(168,85,247,...) inline — maps to ACCENT_PURPLE_BOLD with opacity helpers

- [2026-04-06] All 7 Item Catalog metrics were already fully implemented with correct data derivation, module-scope computation, chart-colors usage, overflow-safe bar chart, and consistent styling — no modifications needed in Part 2
- [2026-04-06] StatsMetric subsampling pattern: when item count exceeds SVG pixel width, subsample sorted array to max W/2 entries using evenly-spaced index picks to preserve distribution shape
- [2026-04-06] optgroup in select dropdowns significantly improves item browsability at 134+ items — group by item type (Weapon/Armor/Accessory/Consumable/Quest/Material)
- [2026-04-06] ITEM_METADATA tags should include rarity and type as lowercase tags alongside subtype for consistent cross-domain filterability

- [2026-04-06] AnimationStateGraph tab order was already correct — only needed narrative metadata and UI chrome additions
- [2026-04-06] AnimSubtabDef interface export enables other consumers to read narrative/subtitle metadata without coupling to internal state

- [2026-04-06] MonteCarloSim.sort() mutated state array directly — always use [...arr].sort() or .toSorted() when working with state-derived arrays
- [2026-04-06] DropSimulator groupBy used 'archetypeId as never' type cast — derive meaningful tier (Minion/Standard/Elite/Boss) from dropChance ranges for proper ScalableSelector grouping
- [2026-04-06] WorldItemPreview had useMemo-wrapped Map that duplicated module-scope constant — static data should be computed at module scope, not inside components
- [2026-04-06] TREEMAP_DATA.find() called 3 times for same treemapDrill value in JSX — extract to local variable via IIFE inside JSX to avoid redundant array traversal

- [2026-04-06] WavesMetric was importing WAVE_TIMELINE (3 legacy waves) instead of EXPANDED_WAVES (24 waves) — metric showed stale counts that didn't match the actual EncountersTab data
- [2026-04-06] SpawnFormationViz accepted no formation prop despite EncountersTab maintaining formation state — dead state variables create user confusion when controls appear to do nothing
- [2026-04-06] Layout computation for Line/Ambush formations uses simple spacing arithmetic — no need for complex physics or force-directed layout for 6 spawn points

- [2026-04-06] SUBTABS already had the correct tab order — the redesign only needed narrative metadata and UI chrome additions
- [2026-04-06] SpellbookSubtabDef interface export enables other consumers to read narrative/subtitle metadata without coupling to internal state
- [2026-04-06] withOpacity with hex string '99' gives a clean 60% alpha for past-step breadcrumb coloring

- [2026-04-06] All 3 Animation State Graph flow features (tab order, subtitles, breadcrumb) were already fully implemented with high quality — only needed minor cleanup
- [2026-04-06] StateGroupBrowser cancel badge and StateDurationPanel outlier label used hardcoded Tailwind amber classes — replaced with STATUS_WARNING chart-colors tokens via inline style
- [2026-04-06] ComboTimelinePanel tab selector buttons and RetargetingTab pipeline step buttons were missing cursor-pointer class
- [2026-04-06] RetargetingTab had unused NeonBar import and ResponsivenessAnalyzer had unused warnings variable

- [2026-04-06] CombatActionMap tab order was already close — only needed metrics↔feedback swap to match Pipeline→Hit Detection→Measure Balance→Polish Feel narrative
- [2026-04-06] CombatSubtabDef interface export enables other consumers to read narrative/subtitle metadata without coupling to internal state

- [2026-04-06] BESTIARY_SUBTABS already had the correct tab order — the redesign only needed narrative metadata and UI chrome additions
- [2026-04-06] BestiarySubtabDef interface export enables other consumers to read narrative/subtitle metadata without coupling to internal state

- [2026-04-06] ringColor is not a valid CSS property — both AbilitiesSection ScalableSelector renderItem and LoadoutSection slot cards had ringColor in inline styles doing nothing; replaced with outline: '1px solid color'

- [2026-04-06] Item Catalog tab order was already correct — the redesign only needed narrative metadata and UI chrome additions
- [2026-04-06] ItemCatalogSubtabDef interface export enables other consumers to read narrative/subtitle metadata without coupling to internal state

- [2026-04-06] LaneSection quality score badge used hardcoded Tailwind emerald-400 classes — replaced with ACCENT_EMERALD chart-colors tokens via inline style
- [2026-04-06] FeedbackTab preset buttons and LaneSection expand buttons were missing cursor-pointer class
- [2026-04-06] StatInfluencePanel weapon selector had flat 44-item list without optgroup — added category grouping to match HitsTab pattern

- [2026-04-06] LOOT_SUBTABS already had the correct tab order — the redesign only needed narrative metadata and UI chrome additions
- [2026-04-06] LootSubtabDef interface export enables other consumers to read narrative/subtitle metadata without coupling to internal state

- [2026-04-06] BTFlowchart selected node had duplicate style attributes (paddingLeft + selection highlight) — must merge into single style object
- [2026-04-06] EncountersTab tierColor returned Tailwind classes but inline style={{ color }} is needed for chart-colors tokens — function must return color values not class names
- [2026-04-06] DecisionDebugger had 6 separate hardcoded amber/blue/emerald Tailwind patterns across filter buttons, entry borders, and type badges — all mapped to STATUS_WARNING/STATUS_INFO/STATUS_SUCCESS
- [2026-04-06] ArchetypeBuilder preview card had border-purple-500/30 and bg-purple-500/10 — replaced with withOpacity(ACCENT_PURPLE_BOLD, ...) tokens

- [2026-04-06] COLORBLIND_MAP hex colors are accessibility-specific with no semantic token equivalent — use eslint-disable block rather than next-line for multi-value object literals
- [2026-04-06] RARITY_OPTIONS const was only used as a type — replaced with direct type expression to eliminate unused variable warning

- [2026-04-06] PropertyInspector collapsible categories need search bypass — when user is searching, collapse state should be ignored to show all matching results
- [2026-04-06] SVG state machine with edgeEndpoints() helper using atan2 for ellipse surface intersection gives clean arrow start/end points without overlap on nodes
- [2026-04-06] Parallel edge offset using normal vector (nx=-dy/len*5, ny=dx/len*5) prevents bidirectional arrows from overlapping
- [2026-04-06] ViewportMockup FOV cone uses camera profile data values directly — distance controls arm length, responsiveness controls lag zone radius inversely
- [2026-04-06] HitboxWireframeViewer hover requires syncing both SVG shapes and toggle buttons via shared hoveredZone state for consistent UX

- [2026-04-06] Tailwind accent-purple-500 and accent-blue-500 classes for form controls should use inline style={{ accentColor: TOKEN }} to satisfy chart-colors lint rules
- [2026-04-06] BTFlowchart had dead props (nodes/edges) in interface that were never consumed — component uses BT_TREE from data module directly
- [2026-04-06] SpawnFormationViz cx variable was declared but only cy was used in Line formation layout — dead variable elimination
- [2026-04-06] Single-item grid wrappers with xl:grid-cols-2 create empty columns — remove grid wrapper when only one child

- [2026-04-06] focus:ring-current/50 is already used in _shared.tsx — valid pattern for replacing hardcoded focus:ring-orange-500/50 across all input elements
- [2026-04-06] accent-cyan-500/accent-blue-500/accent-orange-500 on range inputs are native browser accent utilities, not hex color violations — common pattern across project
- [2026-04-06] LootFilters duplicate enemyMap is necessary to avoid circular dependency with index.tsx which imports LootFilters

- [2026-04-06] Group-level SVG graph (6 nodes) is more readable than full 31-state graph — individual states remain browsable in the collapsible list below
- [2026-04-06] rectEdgePoint() using min(hw/abs(dx), hh/abs(dy)) scaling cleanly computes arrow endpoints on rounded rect edges
- [2026-04-06] SVG animate inside conditional {hl && <animate>} triggers only on hover — no continuous animation cost when idle
- [2026-04-06] repeating-linear-gradient(45deg) at 2px/4px intervals gives clean hatching without SVG pattern defs
- [2026-04-06] BLEND_TRIANGLE precomputed at module scope from sorted distance — avoids useMemo for static data

- [2026-04-06] Character Blueprint visual polish was already fully implemented with high quality across all 6 features — only needed minor cleanup (1 missing cursor-pointer, 5 redundant template literals)

- [2026-04-06] AbilitiesSection had 8 hardcoded Tailwind purple/green/amber classes across 3 glow background divs, 2 icon colors, 1 background color, and 2 status text spans — all mapped to ACCENT_PURPLE_BOLD, ACCENT_GREEN, and STATUS_WARNING
- [2026-04-06] TagAuditSection blocking tags used hardcoded bg-red-500/10 text-red-400 border-red-500/20 — replaced with ACCENT_RED tokens via inline style
- [2026-04-06] Ability pills enhanced from flat text buttons to rich cards: icon circle with first-letter initial, element color dot, cooldown badge, and mini cost bar — uses grid layout instead of flex-wrap for consistent card sizing

- [2026-04-06] setInterval-driven scan line at 30ms causes ~33 React state updates/sec — replace with framer-motion animate prop on a wrapping <g> element to push animation to the compositor thread
- [2026-04-06] Raw opacity string '04' should use OPACITY_4 chart-colors constant for consistency
- [2026-04-06] buildConflicts() called on every render when overrides exist — wrap in useMemo with [overrides] dependency

- [2026-04-06] TIER_GLOW_COLORS map (minion=neutral, standard=info, elite=purple, boss=orange, raid-boss=warning) provides tier-level visual identity without conflicting with per-archetype identity colors
- [2026-04-06] STAT_AVERAGES precomputed at module scope from ARCHETYPES avoids per-render computation — different archetypes use different stat labels (HP/ATK/DEF/SPD/INT vs HP/Damage/Speed/Range) so averages are label-scoped
- [2026-04-06] SpawnPoint role/color fields are optional to maintain backward compatibility — SpawnFormationViz falls back to accent prop when color is undefined
- [2026-04-06] Role legend uses reduce to deduplicate by role before rendering — avoids showing duplicate melee entries from 2 melee spawn points

- [2026-04-06] All 6 Character Blueprint visual features were already fully implemented with high quality — only HitboxWireframeViewer had a raw opacity string '04' that needed replacement with OPACITY_4 constant

- [2026-04-06] SVG node drag uses DOMPoint.matrixTransform(ctm.inverse()) for screen-to-viewBox coordinate conversion — cleaner than deprecated createSVGPoint()
- [2026-04-06] During drag, suppress onMouseEnter on other nodes to prevent hover state flickering — check draggedNode before setting hoveredNode
- [2026-04-06] CORE_ATTRIBUTES.map().includes() per node per render creates O(n*m) allocations — precompute as Set in useMemo for O(1) lookups
- [2026-04-06] Split useMemo into defaultPositions + customPositions merge to support drag while keeping static circular layout as fallback

- [2026-04-06] SankeyNode.color and SankeyLink.color are optional in the type definitions — always provide fallback when mapping to required-color interfaces
- [2026-04-06] Pre-computing Sankey flow band paths at module scope with IIFE avoids impure computation during React render while keeping static data efficient
- [2026-04-06] Activation box computation from UML sequence events: track active state per lane, close when lane sends to another, open when lane receives
- [2026-04-06] FeedbackParam category grouping with FEEDBACK_CATEGORIES const enables clean filter-based rendering without restructuring the flat array

- [2026-04-06] SVG donut chart segments use strokeDasharray/strokeDashoffset on circles — each segment is a separate circle with its own dash length and offset, rotated -90° to start at top
- [2026-04-06] 270° arc gauge uses GCIRC * (270/360) for track length and START_ANGLE=135° to center the gap at bottom — threshold marker computed via arcPoint trig function
- [2026-04-06] Monte Carlo histogram bins computed with Math.min(10, Math.ceil(sqrt(N))) for reasonable bin count — distribution curve is a polyline through bin centers
- [2026-04-06] Stddev band rendered as a semi-transparent rect behind histogram bars, mean as dashed line with μ= label, median as white dashed line — standard statistical visualization pattern
- [2026-04-06] EconomyImpact LiveMetricGauge inflation risk was replaced by Items/Hour and Rarity Distribution KPIs — more actionable metrics for game designers

- [2026-04-06] ITEM_SET_MAP pre-computed from ITEM_SETS enables O(1) set membership lookup for TradingCard set indicators — avoids per-card array search
- [2026-04-06] Sankey link paths use cubic Bezier with bidirectional thickness (srcH/dstH) for proportional flow visualization — path closes as a polygon not a stroke
- [2026-04-06] Sankey node offset tracking requires separate srcOffsets and dstOffsets maps to stack links vertically within each node's height
- [2026-04-06] allLevels derived from lines[0]?.points triggers React hook dep warnings in useCallback — wrap in useMemo with [lines] dep
- [2026-04-06] computePower formula includes affix count * 10 bonus to reflect that affixed items have more total power than raw stat sums suggest
- [2026-04-06] SVG hover tooltip positioning uses midAngle/midR from arc computation for AffixSunburst — reuses existing geometry calculations

- [2026-04-06] All 5 Combat Action Map visual features were already fully implemented with high quality — only needed cleanup of 6 redundant template literal wrappers around withOpacity() calls and removal of unused arrows prop from LaneSection interface

- [2026-04-06] All 6 Loot Table Visualizer visual features were already fully implemented with correct data derivation, module-scope computation, chart-colors usage, and consistent styling — only PityTimerSection had a hardcoded rgba(255,255,255,0.06) track stroke that needed replacement with withOpacity('#ffffff', OPACITY_6)

- [2026-04-06] All 5 Item Catalog visual features were already fully implemented with high quality — only needed cleanup fixes
- [2026-04-06] AffixSlotPanels had inconsistent opacity pattern using direct hex+opacity concat instead of withOpacity() helper
- [2026-04-06] MechanicsScalingTab had import statement placed between code blocks instead of at top with other imports
- [2026-04-06] describeArc pure function inside AffixSunburst component was recreated every render — module-scope eliminates allocation
- [2026-04-06] GearSections IIFE stat computation in JSX should be a separate memoized component for cleaner rendering

- [2026-04-06] All 6 Loot Table Visualizer visual features were already fully implemented with correct data derivation, module-scope computation, chart-colors usage, and consistent styling — only DropTreemap and WeightDistribution had redundant .find() calls replaceable with pre-computed Map lookups

- [2026-04-06] All 6 Loot Table Visualizer visual features were already fully implemented with correct data derivation, module-scope computation, chart-colors usage, and consistent styling — only needed withOpacity() consistency fixes across 10 files
- [2026-04-06] PityTimerSection gauge track used hardcoded '#ffffff' instead of OVERLAY_WHITE constant — always use semantic chart-colors tokens for white references
- [2026-04-06] LootFilters rarity buttons were missing cursor-pointer class despite being interactive button elements

- [2026-04-06] LootTableEditor had 20+ direct hex concat patterns (${COLOR}${OPACITY}) — most of any file in this module, all converted to withOpacity() for consistency
- [2026-04-06] DropSimulator, EnemyLootBinding, EVCalculator, DroughtCalculator each had 2-5 direct hex concat patterns remaining from prior passes
- [2026-04-06] LootFilters and WorldItemPreview had redundant template literal wrappers around withOpacity() calls that returned strings — removed for cleaner code
- [2026-04-06] EnemyLootBinding copy button had mixed patterns: one withOpacity in template literal, one direct concat — unified to withOpacity()

- [2026-04-06] SaveDataSchema was the worst offender with 50+ hardcoded Tailwind color violations — cyan-300/400/500, amber-400/500, emerald-400 across 12 files
- [2026-04-06] hover:text-red-400 on delete/trash buttons (18 occurrences across 14 files) cannot be converted to inline styles — acceptable as a recognized pattern for destructive action hover
- [2026-04-06] bg-*-500/5 blur-3xl ambient glow decorations (8 occurrences in progression/) have hover variants that prevent inline conversion — acceptable at 5% opacity
- [2026-04-06] STATUS_NEUTRAL (#6b7280) contrast ratio is 3.82:1 against surface — passes AA large text but not normal text. Used only for inactive/disabled state which is acceptable
- [2026-04-06] All 12+ tabbed modules use shared SubTabNavigation with consistent spring animation, gap/padding, and accent-based active state — no structural divergence found
- [2026-04-06] focus:border-blue-500/50 (19 files) vs focus:ring-current/50 (4 files) is a minor inconsistency but serves different purposes (input borders vs button rings)
