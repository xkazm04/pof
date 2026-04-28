# UI Perfectionist — Game Data & Debug Tools

> Context: Game Data & Debug Tools (Core Engine (aRPG))
> Files read: 22
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Two parallel radar/gauge implementations diverge in style and capability
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/_shared.tsx:455-515 vs src/components/modules/core-engine/unique-tabs/affix-workbench/PowerBudgetRadar.tsx:39-128 (and DebugDashboard/system/CircularGauge.tsx:17-63 vs _shared.tsx:646-686)
- **Scenario**: `_shared.tsx` already exports a polished `RadarChart` (grid rings, axis lines, ghost overlays, labels, points, glow) and a `LiveMetricGauge`. The affix workbench re-implements the radar inline with hard-coded `width=160 height=140` and `cx=80 cy=65 r=50`, and DebugDashboard ships its own `CircularGauge` with hard-coded `48/60/r=20` plus its own `Sparkline` and `CopyButton` (the latter already exists in `_shared.tsx`).
- **Root cause**: Authors kept building bespoke SVGs because the shared primitives were not noticed or did not yet support a corner case (ghost polygon, status threshold colors). Instead of extending the primitives, copies were forked.
- **Impact**: Inconsistent ring counts (4 in shared vs 4 in affix radar but at hardcoded `r=50` only), inconsistent label fonts (`text-xs` muted vs `font-mono uppercase tracking-wider`), and inconsistent point sizes (`r=3` everywhere but glow filters differ). Any future tweak to the radar/gauge requires hunting copies, and reduced-motion compliance lags in the bespoke ones (`PowerBudgetRadar` has no `useReducedMotion`).
- **Fix sketch**: Promote `RadarChart` to accept `ghostData?` and `isOver?: boolean` (auto-swap stroke/fill to STATUS_ERROR), then delete the inline radar in `PowerBudgetRadar`. Promote `LiveMetricGauge` to accept a `statusLabel` slot and `unit`, then delete `DebugDashboard/system/CircularGauge.tsx`. Move `Sparkline` from CircularGauge.tsx into `_shared.tsx` so other dashboards can reuse it.

## 2. Hard-coded hex colors leak into "polished" data files, bypassing chart-colors tokens
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/ZoneMap/data.ts:59-63; src/components/modules/core-engine/unique-tabs/_shared.tsx:585 (`lowColor = '#1e293b'`); src/components/modules/core-engine/unique-tabs/DebugDashboard/system/SystemHealthSection.tsx:28,34
- **Scenario**: ZoneMap's six "expansion" zones (Tatooine through Malachor V) hard-code `'#f59e0b'`, `'#a78bfa'`, `'#22c55e'`, `'#ef4444'`, `'#7f1d1d'` directly inline, while the original six zones use `STATUS_SUCCESS / STATUS_WARNING / STATUS_LOCKED / STATUS_ERROR` tokens. SystemHealthMatrix passes `lowColor="#0c2d1a"` literally and `HeatmapGrid`'s default is `'#1e293b'`.
- **Root cause**: Tokens for "amber/violet/emerald" exist (`ACCENT_ORANGE`, `ACCENT_VIOLET`, `ACCENT_EMERALD`, `STATUS_ERROR`) but were skipped, presumably because the author wanted a darker red than `STATUS_ERROR` for Malachor V and reached for the literal.
- **Impact**: Theme drift — when `chart-colors.ts` is retuned, half the zones move and half don't, leaving the topology graph visually fragmented. `HeatmapGrid`'s baked `'#1e293b'` also defies dark/light theme parity.
- **Fix sketch**: Replace literals in `ZONES` with token references (`ACCENT_ORANGE`, `ACCENT_VIOLET`, `ACCENT_EMERALD`, `STATUS_ERROR`); add a `STATUS_ERROR_DEEP` token for Malachor V if a darker red is genuinely required. Change `HeatmapGrid` default `lowColor` to a `BG_HEATMAP_LOW` CSS var or a token. Do the same for `'#0c2d1a'` in SystemHealthSection.

## 3. SaveDataSchema/AttributePointOptimizer "design.tsx" files are pure re-exports — a non-feature
- **Severity**: Medium
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/SaveDataSchema/design.tsx:1-5; src/components/modules/core-engine/unique-tabs/AttributePointOptimizer/design.tsx:1-5
- **Scenario**: Both files contain only `export { CornerBrackets, ScanlineOverlay, BlueprintPanel, SectionHeader, GlowStat, NeonBar } from '../_design'` — six lines, identical, no value-add. Internal modules like `AttributePointOptimizer/AttrBar.tsx:5` import `NeonBar` via the local re-export.
- **Root cause**: Likely created early as a per-tab "namespace" for design tokens that never accumulated tab-specific primitives.
- **Impact**: Adds two indirection layers, makes "where does NeonBar live?" non-obvious (grep finds N stub re-exports), and tempts contributors to add tab-specific primitives in the wrong place — fragmenting the design-system surface.
- **Fix sketch**: Either promote them to genuine tab-design files (move the tab-specific accent constants and wrappers from `data.ts` into `design.tsx`), or delete the stubs and import from `'../_design'` directly. Consistency matters more than the choice.

## 4. CircularGauge variants diverge in "status badge" treatment and label casing
- **Severity**: Medium
- **Category**: visual-consistency
- **File**: src/components/modules/core-engine/unique-tabs/DebugDashboard/system/CircularGauge.tsx:46-60 vs src/components/modules/core-engine/unique-tabs/_shared.tsx:660-686
- **Scenario**: DebugDashboard's gauge shows `NOMINAL/WARNING/CRITICAL` as an UPPERCASE pill below the readout, with thresholds `<0.75 / <0.95`. `_shared.tsx`'s `LiveMetricGauge` shows no status pill and renders the label in `font-mono font-bold text-text-muted uppercase tracking-wider`. The same value (e.g. 78%) reads as "WARNING amber pill" in one place and "just an amber percentage" in another.
- **Root cause**: Two different design intents — one assumes an ops-room style with explicit status, the other a quiet KPI tile — were never reconciled.
- **Impact**: User context-switching between the Save Schema "Perf Metrics" gauges and the Debug Dashboard system gauges sees inconsistent severity affordances; the same threshold language ("warning") is sometimes invisible.
- **Fix sketch**: Add a `statusLabel?: 'auto' | 'none' | string[]` prop to the unified gauge and a single threshold table (`THRESHOLDS = { ok: 0.75, warn: 0.95 }`) in `chart-colors.ts` or `_shared.tsx`. Render the pill consistently or drop it consistently per surface — but use one component.

## 5. Missing empty/loading/error states across data panels
- **Severity**: High
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/affix-workbench/SynergyDetector.tsx:108-114; src/components/modules/core-engine/unique-tabs/affix-workbench/PowerBudgetRadar.tsx:39-128; src/components/modules/core-engine/unique-tabs/ProgressionCurve/curves/XpCurveChart.tsx:38-104; src/components/modules/core-engine/unique-tabs/_shared.tsx:526-558 (TimelineStrip)
- **Scenario**: `SynergyDetector` is the only panel that bothers with an empty state ("Add 2+ affixes to detect synergies"). `PowerBudgetRadar` renders polygons over a zero-length array silently (NaN points), `XpCurveChart` assumes ≥2 points but throws no graceful fallback, and `TimelineStrip` returns `<div>` with no events but no message. There is a `LoadingSpinner` in `_shared.tsx:416` but no consistent skeleton scaffold.
- **Root cause**: Static seeded data hides the problem — at runtime the arrays are non-empty, so the empty path was never exercised.
- **Impact**: As soon as filters reduce a dataset to zero (e.g. filter affixes by category), the chart will render a degenerate polygon or a blank rectangle with no cue. Loading is also not skeletonized — async telemetry from `useGenreEvolution` will pop in.
- **Fix sketch**: Add a shared `<EmptyPanel icon label hint? />` primitive in `_shared.tsx`, and have every chart take `data` and short-circuit `if (data.length < 2) return <EmptyPanel ... />`. Wire `LoadingSpinner` into a `<PanelStateBoundary loading? empty? error? />` wrapper used by every domain panel.

## 6. ZoneMap topology lock icon is a literal emoji embedded in SVG `<text>`
- **Severity**: Medium
- **Category**: accessibility-polish
- **File**: src/components/modules/core-engine/unique-tabs/ZoneMap/map/TopologyGraph.tsx:42-51
- **Scenario**: Locked edges render `&#x1F512;` (🔒 emoji) inside an SVG `<text className="text-xs fill-red-400">`. The emoji renders at OS-default size with platform-specific glyph (color emoji on Win/Mac, monochrome on Linux), ignoring `fill-red-400`, and is announced by screen readers as "lock" with no context.
- **Root cause**: Quick way to denote "locked" without importing the lucide `Lock` icon and embedding it in the SVG via a `<foreignObject>` or `<g>` group.
- **Impact**: Inconsistent visual weight across OSes; `fill-red-400` is also a raw Tailwind color (the rest of the file uses tokens). Accessibility: the lock has no `<title>` element, so the affordance is purely visual.
- **Fix sketch**: Replace the emoji with a small `<g>` containing a circle + `Lock` SVG path (or a `<foreignObject>` rendering `<Lock className="w-3 h-3" style={{color: STATUS_ERROR}} />`) and add `<title>Locked: requires {prereq}</title>` for a11y.

## 7. Magic-number radar/topology coordinates and bespoke padding leak into render code
- **Severity**: Medium
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/affix-workbench/PowerBudgetRadar.tsx:41,50-51,113-114; src/components/modules/core-engine/unique-tabs/ZoneMap/map/TopologyGraph.tsx:25,88-92
- **Scenario**: `PowerBudgetRadar` hard-codes `width={160} height={140}`, center `(80, 65)`, radius `50`, label radius `62`. `TopologyGraph` hard-codes `width={460} height={300}`, tooltip `tooltipW=150 tooltipH=68`, clamp `Math.max(4, Math.min(rawX, 460 - tooltipW - 4))` (the `460` is duplicated). `_shared.tsx`'s `RadarChart` already parameterizes these via `size`, proving the pattern.
- **Root cause**: Inline math that grew alongside the design and never got hoisted into `const { SIZE, CX, CY, R, LABEL_R } = LAYOUT`.
- **Impact**: Resizing the panel requires hand-editing five literals; responsive scaling isn't possible (the SVGs use fixed `width`/`height` not `viewBox` only — so on narrow screens they overflow horizontally without `max-w-full`).
- **Fix sketch**: For each bespoke SVG, define a `LAYOUT` const at module top, replace literals with named offsets, and add `className="max-w-full h-auto"` plus `preserveAspectRatio` to the SVG wrappers. Better: collapse into the unified `RadarChart` per finding 1.

## 8. DiffViewer uses raw `border-slate-700/50` while the rest of the file uses tokens
- **Severity**: Low
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/_shared.tsx:735,744
- **Scenario**: The "Show / Hide N unchanged" toggle in `DiffViewer` is wrapped with `border-dashed border-slate-700/50 ... hover:border-slate-600/60`. Every other border in this file goes through `border-border/40`, `withOpacity(accent, ...)`, or `BORDER_DEFAULT`.
- **Root cause**: Stray Tailwind palette literal that escaped the token migration.
- **Impact**: Tiny visual drift in dark/light theme switching — the dashed toggle won't follow theme retunes that other chrome respects.
- **Fix sketch**: Replace `border-slate-700/50` → `border-border/40` and `border-slate-600/60` → `border-border/60` (or a new `BORDER_DASHED` token). Same single-line fix in both buttons.
