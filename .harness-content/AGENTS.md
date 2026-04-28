# Harness Learnings

Patterns and gotchas discovered during autonomous game development.

- [2026-04-06] getTabGroups() is fully data-driven from SECTIONS map — no separate registration step needed
- [2026-04-06] Content module SubModuleIds use plain names (animations, audio, etc.) unlike core-engine which uses arpg- prefix

- [2026-04-06] Content modules use two view patterns: ReviewableModuleView (with extraTabs array) for animations/models/materials/ui-hud, and custom tab layouts for audio/level-design — the latter require adding to the TabId union type
- [2026-04-06] FeatureMapTab is a default export from core-engine/unique-tabs/ and accepts moduleId + optional renderMetric

- [2026-04-06] FeatureMapTab was using hardcoded MODULE_COLORS.core accent — when shared across module categories, derive accent from getCategoryForSubModule() to get correct category color

- [2026-04-06] Content feature-map-config implementation was already complete and high quality across all 6 modules — no code changes needed on review pass

- [2026-04-06] Content view files had two main violation patterns: (1) string concatenation for opacity like `${color}15` instead of withOpacity(color, OPACITY_15), and (2) ACCENT_VIOLET used instead of MODULE_COLORS.content for content module accent
- [2026-04-06] Toast notifications in audio/level-design views used Tailwind color classes (border-green-500/30, text-green-400) which should use inline styles with chart-colors constants for design system compliance
- [2026-04-06] Delete buttons used hardcoded hex hover colors (hover:text-[#f87171]) — replaced with Tailwind semantic classes (hover:text-red-400 hover:bg-status-red-subtle) since globals.css defines --status-red-subtle

- [2026-04-06] AnimationStateMachine uses percentage-based x,y positioning for state nodes in an SVG graph — filtering works best by dimming non-matching nodes rather than hiding them to preserve spatial context
- [2026-04-06] AnimationChecklist has only 6 fixed ANIMATION_STEPS defined inline — search/pagination infrastructure is in place but the search bar auto-hides when <=6 steps to avoid UI clutter
- [2026-04-06] AIComboChoreographer presets were untyped objects — adding a discriminant field (weaponType) enabled filter UI without changing the generation engine

- [2026-04-06] AudioEventCatalog uses CategoryGroup sub-component — pagination state is per-category via useState inside CategoryGroup
- [2026-04-06] AudioView zone lists use separate page states (zoneTablePage, soundscapesPage) with safe clamping via Math.min(page, totalPages-1) to handle doc switching without effects
- [2026-04-06] Sorting zones by reverbPreset in settings table provides natural area grouping without needing a separate groupBy UI toggle

- [2026-04-06] LevelFlowEditor SVG coordinate transform needs zoom divisor in getSVGPoint for accurate drag positioning
- [2026-04-06] StreamingZonePlanner had unused imports (Plus, motion, AnimatePresence, getAdjacentZoneIds) and unnecessary zones dep in handleCellClick callback
- [2026-04-06] LevelDesignView ctx object caused exhaustive-deps warnings - wrapping in useMemo fixed 4 warnings at once
- [2026-04-06] Pre-existing hardcoded hex colors in SVG fills (#050510, #0a0a1e, #3a3a6a, #d8b4fe) replaced with CSS vars and chart-colors constants

- [2026-04-06] ReviewableModuleView now supports renderFlowBar prop — a render prop that receives (activeTab, setActiveTab) for custom navigation overlays between tab bar and content
- [2026-04-06] AnimFlowBar groups multiple tabs into logical flow steps (e.g., Configure covers both features + setup tabs) — clicking a flow step navigates to the first tab in that group

- [2026-04-06] Audio module had 17 lint warnings from unused imports (SurfaceCard, MODULE_COLORS, STATUS_ERROR, Download, STATUS_SUCCESS, OPACITY_10, OPACITY_30), unused variables (accentColor, selectedLevel), hardcoded hex (#3e3e6a), and ctx object not memoized — all resolved to 0 warnings
- [2026-04-06] SpatialAudioGeneratorPanel accepted accentColor prop but never used it — removed from both interface and caller for clean API surface
- [2026-04-06] AudioView ctx object caused react-hooks/exhaustive-deps warnings on 3 useCallbacks — wrapping in useMemo fixes the dependency chain

- [2026-04-06] Virtual scroll in mixed-layout containers (header+search+list) is cleanest when the list gets its own scroll container via flex-col + flex-1 + overflow-y-auto + min-h-0
- [2026-04-06] For zoom/pan on React components, mouse events (mousedown/move/up) are simpler than pointer events and avoid setPointerCapture complexity. isPanning ref + panStart ref avoids stale closure issues
- [2026-04-06] MaterialLayerGraph node click handlers need e.stopPropagation() to prevent the parent pan container from intercepting button clicks as drag starts

- [2026-04-06] Level design tab consolidation used sub-tab state (layoutSub, featuresSub) rather than nested routing — keeps URL simple while organizing 9 views into 5 logical groups
- [2026-04-06] DifficultyArcChart onSelectRoom callback needs to set both activeTab and layoutSub when navigating to the flow editor from consolidated tabs

- [2026-04-06] AnimFlowBar correctly returns null when activeTab is overview/roadmap (non-flow tabs) — the flow bar only appears for pipeline-relevant tabs

- [2026-04-06] Audio module flow bar groups 9 tabs into 5 logical steps: Features(overview+features), Pipeline(roadmap), Scene Painter(painter+soundscapes+settings), Events(events), Code Gen(codegen+autogen)
- [2026-04-06] AudioFlowBar needs Fragment import for chevron separators and px-5 padding to align with the tab bar below it
- [2026-04-06] Default tab changed from painter to overview to match the flow narrative starting point

- [2026-04-06] React Compiler lint rule react-hooks/refs forbids assigning ref.current during render — must use useEffect to sync state→ref
- [2026-04-06] React Compiler memoization preservation warning fires when useCallback depends on a non-memoized value — memoize the dependency to fix

- [2026-04-06] LevelDesignSpatialDiagram had 6 hardcoded hex colors (#22c55e, #3a3e5a, #0a0a1e, #22c55e80) and string-concatenated opacity — replaced with withOpacity(), STATUS_SUCCESS, and semantic Tailwind classes
- [2026-04-06] Callbacks that construct context objects inline ({projectName, projectPath, ueVersion}) should use the already-memoized ctx object to avoid redundant dependencies

- [2026-04-06] allTabIds in ReviewableModuleView needed useMemo wrap to prevent exhaustive-deps lint warning — extraTabs is stable across renders so the memo is effective

- [2026-04-06] AudioView had 3 relative imports (../../shared/) violating @/ alias convention, 3 hardcoded timeouts (3000, 2000, 500) that should use UI_TIMEOUTS constants, and a hardcoded z-50 class that should use Z_INDEX.toast — all fixed for design system compliance

- [2026-04-06] StreamingZonePlanner ZoneEditor had 5 hardcoded Tailwind hex colors (#fbbf24, #f87171, #f59e0b, #d0d4e8, #2a2a4a) — replaced with chart-colors constants (STATUS_WARNING, STATUS_ERROR) and semantic Tailwind classes (accent-amber-500, text-text-muted-hover, text-border)
- [2026-04-06] SyncStatusPanel SYNC_CONFIG bg values used string concatenation for opacity — replaced with withOpacity() using OPACITY_8 for subtle backgrounds, OPACITY_15/OPACITY_22 for button bg/borders

- [2026-04-06] handleGenerateEvents was using inline {projectName, projectPath, ueVersion} instead of the already-memoized ctx object — fixed for dependency optimization consistency

- [2026-04-06] MaterialFlowBar returns null when activeTab is overview/roadmap/custom (non-flow tabs) — consistent with AnimFlowBar pattern
- [2026-04-06] MaterialStyleTransfer SURFACE_COLORS had stone typed as hardcoded hex #78716c — STATUS_NEUTRAL (#6b7280) is the closest semantic match
- [2026-04-06] Pre-existing AnimationChecklist build error (missing ACCENT_VIOLET import) blocks full build but is unrelated to materials module

- [2026-04-06] AnimationChecklist StepCard had an unused Icon variable (step.icon was destructured but never rendered) — lint caught it only after other cleanup
- [2026-04-06] AnimationStateMachine had an unused fps=30 variable in the Blender NLA export handler that was never referenced
- [2026-04-06] ring-offset-[#03030a] is a hardcoded hex via Tailwind arbitrary value — replaced with ring-offset-surface-deep semantic class
- [2026-04-06] SVG filter url(#node-glow) applied to HTML elements positioned over SVG works because the filter is defined in a sibling SVG element within the same stacking context

- [2026-04-06] DifficultyArcChart was missing the shaded target zone feature entirely — added interactive min/max controls with visual zone band, out-of-zone indicators, and hover tooltips
- [2026-04-06] LevelFlowEditor room nodes used simple circles for type icons — replaced with distinctive SVG icon paths per room type in a 12x12 viewBox with tinted backgrounds
- [2026-04-06] String opacity concatenation (e.g. `${color}15`) was the most widespread design system violation across all 4 level design files — systematically replaced with withOpacity(color, OPACITY_XX)
- [2026-04-06] DifficultyLevel type is defined in types/level-design.ts as union 1|2|3|4|5 — can be used directly for target zone select options

- [2026-04-06] AudioScenePainter SVG uses zoneColor/emColor variables from zone.color or ZONE_COLORS/EMITTER_COLORS maps — all 15 string-concatenation opacity patterns needed withOpacity() conversion
- [2026-04-06] AudioPropertyPanel had ACCENT_VIOLET hardcoded for the soundscape generate button instead of using the accentColor prop passed from AudioView — the prop was already threaded through but ignored
- [2026-04-06] AudioCodeGenPanel had text-[#4ade80] for success checkmarks and text-[#f87171] for errors — both replaced with semantic Tailwind class (text-status-success) and inline style (STATUS_ERROR) respectively
- [2026-04-06] AudioEventCatalog had 20+ string-concatenation opacity patterns across filter buttons, category headers, event cards, priority selectors, spatial mode toggles, tag chips, and the editor panel

- [2026-04-06] SVG fillOpacity attribute is cleaner than withOpacity() for CSS variable-based fills — separates color from opacity without needing hex values
- [2026-04-06] Tailwind shadow-[...] arbitrary values with rgba are acceptable when used for ambient glow effects — replacing with design tokens would require moving to inline styles
- [2026-04-06] bg-[#03030a] throughout level design components should use bg-surface-deep semantic class (--surface-deep: #0d0d22)

- [2026-04-06] InventoryGridDesigner uses CSS grid with virtual row windowing — spacer div for startRow offset preserves grid layout while only rendering visible rows
- [2026-04-06] MenuFlowDiagram search uses node dimming (opacity 0.2) rather than hiding to preserve spatial context — transitions dim when both connected nodes are filtered out
- [2026-04-06] HudThemeEditor already had good section tabs — scaling was about making element colors list scrollable and supporting add/remove for custom elements
- [2026-04-06] DamageNumberPalette index-based ELEMENT_COLORS references (ELEMENT_COLORS[1].rgba) broke when expanding the array — replaced with named lookups (FIRE_COLOR, HEAL_COLOR)
- [2026-04-06] Pre-existing #4f46e5 (indigo-600) in SVG silhouette strokes replaced with CSS var fallback pattern: var(--accent-indigo, #4f46e5)
- [2026-04-06] #6ee7b7 and #6366f1 hardcoded hex colors replaced with ACCENT_EMERALD and STATUS_INFO design system tokens
- [2026-04-06] Unused imports (SurfaceCard, MODULE_COLORS, EquipmentSlotConfig, ACCENT_EMERALD, STATUS_ERROR, OPACITY_30) cleaned across all 4 files

- [2026-04-06] ModelsFlowBar returns null when activeTab is overview/roadmap (non-flow tabs) — consistent with AnimFlowBar/AudioFlowBar pattern
- [2026-04-06] AssetInventory had toggleSort/SortIcon defined but never rendered in UI — sort state (sortKey/sortDir) is still used by displayAssets memo but setters became unused after removing toggleSort
- [2026-04-06] AssetPipelineDiagram had extensive hardcoded violet Tailwind classes — converted key ones to inline styles with design system tokens while keeping bg-surface/40 semantic classes
- [2026-04-06] Models module relative import ../../shared/ReviewableModuleView was the only @/ alias violation — same-directory imports (./AssetInventory) are acceptable

- [2026-04-06] AudioPipelineDiagram had no MODULE_COLORS.content usage — all interactive elements were hardcoded blue (STATUS_INFO). Content module pipeline should use amber accent for unlocked states, keeping blue only for locked/neutral and emerald for completed.
- [2026-04-06] bg-[#03030a] was used across all 4 audio panel containers as ultra-dark background — replaced with bg-surface-deep semantic class for design system compliance
- [2026-04-06] withOpacity() accepts raw hex suffixes like '50', '80', '05' for non-standard opacity values not in the OPACITY_XX constants

- [2026-04-06] UIHudFlowBar returns null when activeTab is overview/roadmap (non-flow tabs) — consistent with AnimFlowBar/MaterialFlowBar pattern
- [2026-04-06] HUD composite tab groups HudThemeEditor + LowHealthPulse + EnemyHealthBarFSM with responsive grid for the two smaller components
- [2026-04-06] Polish composite tab merges DamageNumberPhysicsSimulator (interactive) above DamageNumberPalette (reference) for logical top-down workflow
- [2026-04-06] Original UIHudView had relative import for ReviewableModuleView — fixed to use @/ alias convention

- [2026-04-06] AssetInventory had sortKey/sortDir useState but no setters or UI exposed — adding toggleSort callback and sort button row completes the feature
- [2026-04-06] Bridge manifest summary was duplicated between pre-scan and post-scan states — extracted to BridgeSummary sub-component
- [2026-04-06] Virtual scroll in CSS grid uses absolute positioning with startRow*rowH top offset inside a container with totalHeight — simpler than flexbox spacer approach
- [2026-04-06] rgba(255,255,255,...) in Tailwind arbitrary values can be replaced with white/[0.05] syntax which avoids the hex color lint rule
- [2026-04-06] For dark shadow colors without a design system BLACK constant, var(--surface-deep) provides a semantic equivalent that adapts to theme

- [2026-04-06] LowHealthPulse had a broken CSS pattern: `${currentCSS}10` where currentCSS is rgb() format — appending hex opacity to rgb() produces invalid CSS. Fixed with inline rgba() using the color components directly
- [2026-04-06] EnemyHealthBarFSM mixed withOpacity constant import (OPACITY_10) with string concatenation (`${t.color}${OPACITY_10}`) which produces hex+hex-suffix double-encoding — must use withOpacity() function call
- [2026-04-06] DamageNumberPhysicsSimulator had 10+ string-concatenation patterns across ClutterBadge, preset buttons, play/reset controls, mob markers, physics mode selectors, and stack mode selectors

- [2026-04-06] HudThemeEditor section tab buttons used `${s.color}${OPACITY_10}` template literal instead of withOpacity() — the constant OPACITY_10 is a hex suffix string, so concatenating it with a hex color works by accident but is inconsistent with the design system pattern
- [2026-04-06] focus:ring-offset-[#03030a] appeared in both MenuFlowDiagram and InventoryGridDesigner generate buttons — replaced with focus:ring-offset-surface-deep semantic class

- [2026-04-06] MenuFlowDiagram SCREEN_TYPES icon field was single characters — replaced with SCREEN_ICON_PATHS map using SVG path data in 12×12 viewBox, rendered as nested <svg> within the node <g> transform
- [2026-04-06] InventoryGridDesigner drag preview uses HTML5 drag API (draggable, onDragStart/Over/Leave/End/Drop) with visual states: source opacity 0.35, target green highlight with STATUS_SUCCESS border and pulse animation
- [2026-04-06] HudThemeEditor and DamageNumberPhysicsSimulator were already feature-complete with live preview, physics simulation, presets, readability metrics, and UE5 export — no improvements needed
- [2026-04-06] Sci-fi/cyberpunk configurator panels (MenuFlowDiagram, InventoryGridDesigner) use consistent rgba() values for ambient glows and glassmorphism effects — these are decorative styling that doesn't map to design tokens

- [2026-04-06] Content modules use ReviewableModuleView+FlowBar, not BlueprintPanel/SectionHeader — these are core-engine-specific design system components
- [2026-04-06] Violet Tailwind classes (197 occurrences in 9 files) are intentional sci-fi/cyberpunk panel theming in materials and level-design configurators — not violations
- [2026-04-06] All 6 content modules have feature-map-config entries with 6-8 sections each and render FeatureMapTab correctly
- [2026-04-06] Three violation categories systematically eliminated: bg-[#hex] backgrounds (8 files), text/border-[#hex] arbitrary values (4 files), and ${color}XX string concat opacity (8 files)
