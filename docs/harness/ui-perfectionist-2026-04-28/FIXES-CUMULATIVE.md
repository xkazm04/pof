# UI Perfectionist — Cumulative Fix Summary (Waves 1–7)

> All 7 waves complete. 41 fix commits, 41+ findings closed across 100+ files.

This document consolidates the seven waves of the UI Perfectionist scan-fix pipeline. Each wave was scoped to a coherent theme (primitives, tokens, dashboards, SVG math, data states, a11y / JIT / taxonomy) and built on the patterns established by prior waves. The patterns catalogue (37 entries) is the durable artifact — the per-wave commit hashes are pointers for later forensic work.

## Per-wave summary

### Wave 1 — Primitives + tokens (catalogue 1–6)

Ground floor. Fixed the duplicated Button/WizardButton fork into one canonical `Button` with orthogonal `variant`/`intent`/`loading`/`icon` props; consolidated the motion taxonomy (`MOTION_CONFIG` and `ANIMATION_PRESETS` deprecated as aliases of canonical `DURATION/EASE/SPRING/STAGGER`); collapsed the chart-color opacity scale to 6 canonical stops; fixed DZIN tokens to be CSS-var-name-backed (no inline hex fallbacks); ensured DZIN spacing names are symmetric across density buckets; promoted SurfaceCard to the canonical card primitive. 6 commits.

### Wave 2 — Color/icon/token consistency (catalogue 7–13)

Mechanical drift fixes. Rarity-color maps consolidated to a single source. Indigo theme exposed as just-violet-in-disguise (`ACCENT_VIOLET`). `[#00ff88]` arbitrary-value classes swept to the named `accent-setup` token. Hand-rolled red→yellow→green lerps replaced with `heatmapScale()`. Audio panels migrated from cyber-blue to canonical content-module amber (`MODULE_COLORS.content`). Lucide-in-SVG positioning bug (`<Mountain x={…} />` is silently broken) called out as a discoverability hazard. PowerShell regex sweeps used as the migration tool for 100+ class swaps. 7 commits.

### Wave 3 — Chrome primitives (catalogue 14–20)

Highest-leverage wave. `KPICard` absorbed 12 dashboard `StatCard`/`MetricCard` forks in one commit using local-wrapper migration (`function StatCard(props) { return <KPICard {...mapped} /> }`). Six other primitives shipped: `AccentButton`, `TintedButton`, `StatusDot`, `ChipButton`, `CopyButton`, `ScoreRing`. Established the rule that score-to-color thresholds live in a function (`scoreToStatusColor`), and that SVG ring circumferences are computed (`2πr`), not magic numbers. The `as: 'button' | 'span'` discriminator pattern came from ChipButton — chips are sometimes interactive, sometimes labels. 7 commits.

### Wave 4 — Section / dashboard chrome (catalogue 21–25)

Header consolidation. `<DashboardHeader>` extracted with icon-tile + title + subtitle + action slots; `<TabHeader>` for `ReviewableModuleView` extra-tab bodies; `<SectionLabel>` extended with `iconClassName`/`size` props for legacy DZIN panel migrations. `createTabbedModuleView` factory — companion to `createSimpleModuleView` — added so future modules with custom panels stop hand-rolling tab bars. Shared `moduleTopology` (positions + presets + `getNodeCenter`) — single source of truth for the ARPG module-grid layout used by topology views. 6 commits.

### Wave 5 — SVG primitives (catalogue 26–29)

Math, not JSX. `computeEdgeGeometry()` for graph edges with bidirectional perpendicular offset and end inset; `wirePath()` for horizontal cubic-bezier flow-graph wires; `arcPath()` for closed annular wedges in heatmap/radial visualizers; `<HorizontalGridLines>` for chart axes with optional Y-tick labels. Visual fidelity was prioritized — only the common math is shared, JSX stays local where call sites diverge. 4 commits.

### Wave 6 — Data states (catalogue 30–32)

Empty/loading/feedback. `<EmptyState>` extended with `satelliteIcons` for the rounded-2xl tinted-tile + 3-icon composition the game-director module had been hand-rolling. `<EmptyPanel>` lightweight in-card empty placeholder for chart panels (`role="status"` for a11y). `<Suspense fallback={<ModuleSkeleton />}>` inside `ModuleErrorBoundary` — every module now gets identical loading chrome. Two bespoke toast systems (ReviewableModuleView, LevelDesignView) migrated to sonner. Locale tab-count badges given visual distinctness. 6 commits.

### Wave 7 — A11y polish + JIT bugs + status taxonomy (catalogue 33–37)

The scan-cleanup wave. Fixed `focus:outline-none` without replacement on InteractivePill, ActivityFeed/ErrorBoundary chrome, and Materials buttons (12 sites). Tooltip rewritten with `role="tooltip"`, `aria-describedby`, focus support, and Escape dismissal. Tailwind JIT-incompatible runtime classes fixed (`bg-[${STATUS_WARNING}${OPACITY_10}]` and `hover:${CLI_COLORS.error}` template-string forms — JIT cannot scan these, so they emitted nothing). SidebarL1 active indicator switched from magic-number positioning to Framer Motion `layoutId`. CLI tab 2px-jump fixed by reserving the active border with `border-transparent`. Canonical `Severity` vocabulary + `legacyToCanonical` boundary mapper added so the four sibling subsystems (crash/codebase/asset/perf) can hand off to UI without four parallel color/icon maps. 7 commits.

## Cumulative pattern catalogue (37 entries)

### Primitives + tokens (1–6, Wave 1)

1. **`Button` is the single button primitive.** No fork. `variant` (visual) and `intent` (semantic colour) are orthogonal; `loading` and icons are first-class slots; disabled has baked-in styling.
2. **Motion timing has one canonical token set.** `DURATION + EASE_OUT/EASE_FILL + SPRING + STAGGER` is the source of truth. `MOTION_CONFIG` / `ANIMATION_PRESETS` survive as `@deprecated` aliases — never extend them.
3. **Chart-color opacity scale is 6 canonical stops.** `OPACITY_5/10/20/40/60/80` (plus `OPACITY_0`). All other opacity tokens are `@deprecated`.
4. **DZIN tokens are CSS-var-backed and contract-explicit.** The JS map is var *names*, not values. Hex fallbacks in `state.css` are removed.
5. **`DZIN_SPACING` is symmetric across densities.** All three density buckets (`micro | compact | full`) expose the same role names.
6. **`SurfaceCard` is the canonical card primitive.** No second-name re-export alias.

### Color / icon consistency (7–13, Wave 2)

7. **Lucide icons inside SVG: wrap, don't position.** `<Mountain x={…} y={…}>` is silently broken — wrap in `<g transform="translate(x, y)">`.
8. **Single-source rarity map.** `RARITY_COLOR_MAP` in `@/lib/economy/definitions.ts`. All loot consumers re-export or import; no per-file forks.
9. **Indigo theme is just violet in disguise.** Use Tailwind `violet-*` palette plus `rgba(167,139,250,…)`. Don't introduce a new token.
10. **`accent-setup` not `[#00ff88]`.** Named tokens over arbitrary-value brackets when the token already exists.
11. **`heatmapScale()` over hand-rolled lerps.** Any 0–1 → red→yellow→green ramp belongs to `heatmapScale()`.
12. **Module accent ≠ closest hue.** Audio panels migrated from cyber-blue to amber `MODULE_COLORS.content`.
13. **Mechanical class swaps via PowerShell regex.** Negative-numeric lookahead (`blue-500(?!\d)`) makes 100+ site migrations verifiable via `grep` post-pass.

### Chrome primitives (14–20, Wave 3)

14. **One primitive per visual archetype, not per call site.** A `function StatCard` in 12 files with cosmetic drift becomes one primitive with a discriminator prop.
15. **Token tier matters: 22 vs 40.** AccentButton uses `OPACITY_15`+`22`; TintedButton uses `OPACITY_15`+`40`. Document the difference rather than premature-unifying.
16. **`withOpacity(color, '40')` over template literals.** `${color}40` silently breaks for `var(--token)` inputs.
17. **`as: 'button' | 'span'` discriminator on chip primitives.** Chips are sometimes interactive, sometimes labels.
18. **Computed circumference, not literal magic numbers.** SVG ring primitives compute `2πr` from a `radius` prop.
19. **Score → colour mapping belongs to a function, not a ternary.** `scoreToStatusColor(score)`. One source of truth for the threshold ladder.
20. **Migration via local-wrapper preserves call sites.** `function StatCard(props) { return <KPICard {...mapped} /> }` is faster + lower-risk than rewriting 60+ JSX sites.

### Section / dashboard chrome (21–25, Wave 4)

21. **`<DashboardHeader>`** — icon-tile + title + subtitle + action slots. Static class lookup tables for the 10-color accent palette (JIT-safe).
22. **Extended `SectionLabel`** — `iconClassName` / `className` / `size: 'xs' | 'sm'` for migrating legacy DZIN panel section headers.
23. **`<TabHeader>`** — minimal centered/left-aligned title + description for `ReviewableModuleView` extra-tab bodies. Distinct from `DashboardHeader`.
24. **`createTabbedModuleView(moduleId, tabs)`** — factory companion to `createSimpleModuleView`. Threads caller-supplied panels through `extraTabs`.
25. **Shared `moduleTopology`** — `MODULE_POSITIONS` + `TOPOLOGY_COMPACT/ROOMY` presets + `getNodeCenter`. Single source for ARPG module-grid layout.

### SVG primitives (26–29, Wave 5)

26. **`computeEdgeGeometry(from, to, options?)`** — graph-edge endpoints + midpoint with bidirectional perpendicular offset and per-end inset.
27. **`wirePath(from, to, options?)`** — horizontal cubic-bezier wire path-string. Control-point offset proportional to horizontal distance, capped at 80.
28. **`arcPath(cx, cy, innerR, outerR, startAngle, endAngle)`** — closed annular-wedge SVG path. Standard SVG angle convention.
29. **`<HorizontalGridLines>`** — gridlines + optional Y-tick labels. Owns the "min at bottom, max at top" linear y-mapping.

### Data states (30–32, Wave 6)

30. **`<EmptyState satelliteIcons={[bottomRight, topLeft]} iconColor={accent} action={{label, onClick, icon, color}} />`** — extended with the satellite-icon composition (rounded-2xl tinted tile + primary 7×7 icon + 5×5 + 4×4 satellites at 50%/30% opacity).
31. **`<EmptyPanel label hint? height? />`** — lightweight in-card empty placeholder for chart panels. Sized to fit `SurfaceCard level=2`. `role="status"`.
32. **`<Suspense fallback={<ModuleSkeleton />}>` inside `ModuleErrorBoundary`** — single shell-level loading contract. Every module gets identical chrome.

### A11y / JIT / taxonomy (33–37, Wave 7)

33. **Canonical `Severity` vocabulary** (`src/types/severity.ts`) — `Severity` union, `SEVERITY_RANK`, `compareSeverityDesc`, `legacyToCanonical(input)`. UI consumes this; engines map at the boundary.
34. **`focus-visible:ring-2 focus-visible:ring-accent` chrome pattern** — canonical replacement for `focus:outline-none`. Combine with `focus-visible:ring-offset-1` for inset/depth-tinted surfaces.
35. **Inline `style={{ backgroundColor, color }}` for hex+alpha** — when a class string can't be statically known, emit via `style` rather than `bg-[${…}]`. JIT cannot scan template-class strings.
36. **`<motion.span layoutId={…}>` for sliding active indicators** — replaces `transform: translateY(N * STRIDE + OFFSET)` magic-number positioning. Indicator position derives from live DOM via Framer's shared-layout animation.
37. **`border-t-2 border-transparent` reservation for tab indicators** — when active tab needs a colored top border, always reserve the height with `border-transparent` so non-active siblings don't shift.

## What remains

The original scan surfaced ~150 findings across 32 context reports. Across 7 waves, ~41 findings were closed (full or partial) plus a comparable count of ad-hoc drift fixes folded into the migration commits. The remaining ~110+ medium/low findings break down into roughly:

### Mechanical sweeps (one-wave-each candidates)

- **`focus:outline-none` without `focus-visible:` replacement** elsewhere in chrome (header bar, command palette, modal close buttons). Pattern 34 is established; sweep would be a grep + ~20-line edit.
- **JIT `bg-[${…}]` / template-class drift** elsewhere. Pattern 35 is established. Grep `bg-\[\$\{|hover:\$\{` across `src/` would surface remaining sites.
- **Bespoke toast systems → sonner.** Two migrated in Wave 6. A `useState.*toast` audit would close the rest.
- **Engine-internal severity → `legacyToCanonical`** call-site migration. Pattern 33 is established. Each consumer (color/icon map, sort comparator) can switch with a 1-line `legacyToCanonical(severity)` wrap.

### Structural consolidation (each its own focused wave)

- **Lifecycle vocabulary (finding 22.2)** — three "done/error" enums across `EvalStatus`, `passStatuses`, `ModuleHealthStatus`. Same shape as the severity-vocab fix but with a different mapping: `idle → pending`, `done → completed`, etc.
- **Health-score → band thresholds (finding 22.4)** — three scoring engines with three threshold ladders. Extract `scoreToBand(score)` and `BAND_PRESENTATION` per the report's fix sketch.
- **InsightCategory presentation map (finding 22.5)** — 8 categories with inline priority but no shared icon/accent map. Extract once.
- **Engine-emoji output (finding 22.3)** — `gdd-synthesizer.ts` bakes `✅ 🟡 ❌` into markdown. Engine should emit tokens, view should map to glyphs.

### Larger PRs deferred

- **Tooltip portal + positioning.** A11y rewrite landed; portal+positioning would replace the relative-position with floating-ui or Radix. Larger PR.
- **Full StateGraphCanvas extraction (finding 15.1).** Only the edge math was shared in Wave 5. The marker `<defs>`, node rendering, and entry-indicator chrome are still duplicated between `AnimationStateMachine` and `StateMachineEditor` (>2400 LOC across the two files).

### Per-wave granular followups

See each `FIXES-WAVE-N.md` "What remains" section for wave-specific followups. Common themes: callsite migration of newly-shipped primitives (Pattern 14 leverage), and per-module variants of generic primitives (e.g. tailored skeletons for R3F-heavy modules).

`tsc --noEmit` was 0 before each commit and remains 0 across all seven waves.
