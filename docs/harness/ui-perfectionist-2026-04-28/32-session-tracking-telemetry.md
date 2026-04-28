# UI Perfectionist — Session Tracking & Telemetry

> Context: Session Tracking & Telemetry (Analytics & Session Tracking)
> Files read: 4 (SessionAnalyticsDashboard, WeeklyDigestView, chart-colors, SurfaceCard) plus cross-reference to context #20
> Total: 7 — Critical: 0, High: 4, Medium: 2, Low: 1

> Note: This context is mostly logic — only two UI surfaces are in scope. Both reproduce patterns flagged across the broader Evaluator suite (#20). Findings 1, 2, 3 are direct reinstantiations of the Evaluator-UI themes (StatCard fork, ad-hoc header, token-vs-tailwind drift). Findings 4–7 are local issues specific to these two views.

## 1. Two more local `StatCard` forks reinforce the suite-wide KPI drift

- **Severity**: High
- **Category**: Component Architecture / Design System
- **File**: src/components/modules/evaluator/SessionAnalyticsDashboard.tsx:170-190 · src/components/modules/evaluator/WeeklyDigestView.tsx:323-348
- **Scenario**: Both files declare a private `function StatCard(...)`. They render the same KPI recipe (icon + 2xs label + bold value + accent color), with subtly different details: Session uses a `SurfaceCard level={2}` wrapper, an uppercase tracking-wider label, and `text-lg font-bold` colored by `style={{ color }}`; WeeklyDigest uses a hand-rolled `bg-surface border border-border rounded-lg` div, a non-uppercase label, `text-lg font-bold text-text` (color is *not* applied to the value, only the icon), and adds a delta badge with TrendingUp/Down. These two variants render side-by-side at the top of the Evaluator Overview tab, producing two visibly different KPI silhouettes for the same metric family.
- **Root cause**: No shared `KPICard` / `MetricTile` primitive exists. Context #20 finding 1 already documented 12 such forks across the evaluator suite; these two files are #11 and #12. Authors copy-paste the recipe from sibling views and tweak.
- **Impact**: The user moves from Session Analytics → Weekly Digest one tab over and sees the same "Sessions: N" tile rendered with different background depth, different label casing, different color application policy. Even *within* WeeklyDigest's own export-to-PNG renderer (line 506-531) a third visual recipe is used (no border, color *is* applied to the value). Three flavors of one KPI inside one feature.
- **Fix sketch**: Promote a shared `<KPICard icon label value sub? delta? accent variant?='solid'|'soft' />` primitive into `src/components/ui/` per finding 1 of context #20. Migrate both `StatCard` definitions to it (the prop shape is already identical). Decide one policy on whether the value uses the accent color or `text-text` — both files disagree with each other. The PNG renderer should call `KPICard.toCanvas(...)` (or share the layout constants) so the screenshot matches the screen.

## 2. Local `MODULE_COLORS.setup` / `content` / `evaluator` mapping for "good/fair/bad" is wrong-semantic and forks the threshold ramp four ways

- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/evaluator/WeeklyDigestView.tsx:227, 273, 279, 558, 592 · src/components/modules/evaluator/SessionAnalyticsDashboard.tsx:215, 267 · cross-ref src/lib/chart-colors.ts (STATUS_SUCCESS / STATUS_WARNING / STATUS_ERROR exist)
- **Scenario**: WeeklyDigest's daily sparkline, leaderboard bars, and PNG export all color "good ≥0.75 / mid ≥0.5 / bad" using `MODULE_COLORS.setup` (green `#00ff88`), `MODULE_COLORS.content` (amber `#f59e0b`), `MODULE_COLORS.evaluator` (red `#ef4444`). Those constants are *category accents for the Setup/Content/Evaluator modules* — not status semantics. SessionAnalytics, sitting one tab away, uses the canonical `STATUS_SUCCESS` (`#4ade80`), `STATUS_WARNING` (`#fbbf24`), `STATUS_ERROR` (`#f87171`) for the equivalent mapping. Same "75% success rate" reads as `#00ff88` neon green in WeeklyDigest and `#4ade80` softer green in SessionAnalytics. Thresholds also disagree: SessionAnalytics uses 70/40 cutoffs (lines 215, 267), WeeklyDigest uses 75/50 cutoffs (lines 227, 273); the SessionAnalytics PNG-renderer-equivalent path doesn't exist but if extracted today it'd be a fourth ramp.
- **Root cause**: WeeklyDigest's author treated `MODULE_COLORS.setup/content/evaluator` as a free "vibe-coded green/amber/red" ramp because those happen to be those colors. There is no exported `successRateColor(rate: number)` helper, so each view re-derives the if/else.
- **Impact**: Brand grammar collision — `MODULE_COLORS.setup` is the dedicated accent for the Setup module's UI tile, and using it as a generic "good rate" green means the day a designer recolors `MODULE_COLORS.setup`, the WeeklyDigest sparkline silently changes meaning. Threshold drift means a 72%-success day is "good" in SessionAnalytics and "fair amber" in WeeklyDigest — same data, two verdicts. Theme switching is broken for these views (the hex literals don't follow theme tokens).
- **Fix sketch**: Add `export function successRateColor(rate: number, opts?: { neutralOnZero?: boolean }): string` to `chart-colors.ts` returning `STATUS_SUCCESS | STATUS_WARNING | STATUS_ERROR` against one canonical threshold pair (pick one — 70/40 to match SessionAnalytics and the existing `healthColor` cousin at 60/30). Replace the five usages in WeeklyDigest (227, 273, 279, 558, 592) and the two in SessionAnalytics (215, 267). Stop using `MODULE_COLORS.setup/content/evaluator` for non-module semantics; the canvas renderer's `MODULE_COLORS.setup/content` choices on lines 509-511 should also use `STATUS_INFO/SUCCESS/STALE` semantically.

## 3. Tailwind arbitrary-value class `bg-[${STATUS_WARNING}${OPACITY_10}]` does not work — the badge background is invisible

- **Severity**: High
- **Category**: Polish / Design System
- **File**: src/components/modules/evaluator/SessionAnalyticsDashboard.tsx:107, 380
- **Scenario**: Two badges use template-literal arbitrary Tailwind classes built at render time: `` `text-2xs px-1.5 py-0.5 rounded bg-[${STATUS_WARNING}${OPACITY_10}] text-[${STATUS_WARNING}] font-medium` `` (line 107, the insights count badge) and `` `text-2xs px-1 py-0.5 rounded bg-[${STATUS_SUCCESS}${OPACITY_10}] text-[${STATUS_SUCCESS}] flex-shrink-0` `` (line 380, the recent-session "ctx" pill). Tailwind v4's JIT scanner only generates arbitrary classes whose *literal* string appears in source — runtime-interpolated `bg-[#fbbf24...]` strings are not statically discoverable, so the corresponding CSS rule is never emitted. The badges render with `text-[var(--undefined)]`-equivalent (text falls back to inheriting `text` foreground) and `bg-` simply absent. The text *color* on the same line uses the same template trick (`text-[${STATUS_WARNING}]`) and has the same problem.
- **Root cause**: Pattern was copy-pasted assuming Tailwind would interpolate. Sibling files in the suite use either inline `style={{ backgroundColor: ... }}` or hard-coded literal arbitrary values — both work; this file used neither.
- **Impact**: The "5 insights" badge silently has no amber tint and probably no amber text, defeating its visual purpose; the "ctx" pill on Recent Sessions silently loses its emerald background. Functional regression — the visual signal the author intended to ship is not on screen at all.
- **Fix sketch**: Replace both with inline style: `<span className="text-2xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: statusBg(STATUS_WARNING, 0.08), color: STATUS_WARNING }}>` (and likewise for `STATUS_SUCCESS`). The `statusBg()` helper already exists in `chart-colors.ts`. Better still, since this same recipe (token color + 10% bg + same color text) appears across the whole evaluator suite, extract a `<TokenChip color size? children />` primitive — counted ~15 hits in #20 finding 8 territory.

## 4. Sub-tab and stat icons are not interactive even though the visual treatment hints they are

- **Severity**: Medium
- **Category**: Accessibility-as-polish / Visual Consistency
- **File**: src/components/modules/evaluator/SessionAnalyticsDashboard.tsx:212-251 (QualityScoreRow) · 364-384 (RecentSessionRow)
- **Scenario**: `QualityScoreRow` is a flex row with `hover:bg-surface-hover transition-colors` (line 218) — every visual cue says "I am clickable, I open details." It is not a `<button>`, has no `onClick`, no `role`, no `tabIndex`. `RecentSessionRow` (line 370) does the same: hover background change, prompt preview text that begs to be expanded — but it's an inert `<div>`. The neighboring `ModuleStatsRow` (line 273) *is* a real `<button>` with `aria-expanded`/`aria-controls` and a chevron, so users learn "rows in this dashboard are clickable" — then quality-score and recent-session rows betray that learning by going dead on click.
- **Root cause**: The hover-background recipe was copy-pasted from `ModuleStatsRow` without copying the interactivity. No "clickable rows must be `<button>`/`<a>` or have `role=button + onKeyDown`" lint.
- **Impact**: Users hover, see the affordance, click, nothing happens — corrosive on perceived quality. Keyboard users tab past these rows entirely (no `tabIndex`), so they don't even get the misleading hover state but lose access to whatever drill-down would have helped them.
- **Fix sketch**: Either (a) remove the hover affordance from the two rows that aren't actually clickable (keep them as static `<div>`s with no `hover:` classes), or (b) wire them up — RecentSession could open a session-detail modal, QualityScore could expand a per-module breakdown identical to `ModuleStatsRow`. Option (a) is the conservative fix; option (b) is the right one because the dashboard already has insight cards that link to no detail page. Whichever you pick, do *not* leave the bait-and-switch.

## 5. The streak section uses tabular-nums and a divider that don't match the Module Activity row's number formatting

- **Severity**: Medium
- **Category**: Visual Consistency / Polish
- **File**: src/components/modules/evaluator/WeeklyDigestView.tsx:196-208 vs. 256-294
- **Scenario**: The streak strip (lines 196-208) renders numbers as `text-sm font-bold tabular-nums` separated by a `w-px h-4 bg-border` vertical divider in a `gap-4` container. The Module Activity rows below (lines 261-291) render their session counts as `text-2xs text-text-muted tabular-nums w-8 text-right` and the success-rate as `text-2xs tabular-nums` — no divider, no `font-bold`, half the size. The Stat cards above (lines 165-194) use yet a third recipe: `text-lg font-bold text-text tabular-nums`. Three numeric-display weights stacked vertically; the eye cannot find a hierarchy because the streak block is *bolder* than the stat cards (`text-sm font-bold` reads heavier than `text-lg font-bold` at this density), inverting the implied importance.
- **Root cause**: No type-scale doc for "primary KPI value vs. secondary numeric vs. inline metric." Each section was sized by feel.
- **Impact**: Visual hierarchy is muddled. The streak strip — secondary information — visually competes with the headline KPI cards. The vertical divider is a one-off; nothing else in the view uses an inline pipe.
- **Fix sketch**: Introduce a 3-tier numeric scale documented next to `chart-colors.ts` (e.g., `numeric-xl` = `text-2xl font-bold tabular-nums` for headline KPIs, `numeric-md` = `text-sm font-semibold tabular-nums` for inline rows, `numeric-xs` = `text-2xs tabular-nums` for table cells). Promote the streak block to `numeric-md` weight to recede it; remove the `w-px` divider in favor of consistent `gap-3` spacing already used elsewhere in this view. Bonus: the `tabular-nums` utility appears 9× in this file — codify it inside the KPICard / numeric primitive so authors don't need to remember it.

## 6. Daily-activity tooltip loses its "darker than surface" backdrop in light mode (hard-coded `bg-[#1a1a24]`)

- **Severity**: Medium
- **Category**: Design System
- **File**: src/components/modules/evaluator/WeeklyDigestView.tsx:381
- **Scenario**: The CSS-only sparkline tooltip (a polished piece of work — keyboard-focusable bar, fade+scale animation, arrow) hard-codes `bg-[#1a1a24]` for the tooltip body. Every other surface in the file goes through the `bg-surface` / `bg-background` / `bg-surface-deep` token aliases. `#1a1a24` is presumably the dark-theme `bg-surface-deep` value frozen as a literal; in any future light-theme or alt-theme it stays a near-black popover floating over a light card.
- **Root cause**: Tailwind arbitrary value used because there's no `bg-surface-deepest` / `bg-tooltip` token; author picked the literal that "looked right" in the current theme.
- **Impact**: Theme regression debt. Also breaks the suite-wide "no hex literals in components" convention (the rest of the file imports from `chart-colors.ts`). The arrow border on line 400 (`border-t-border`) is correctly tokenized — the tooltip body is the only literal.
- **Fix sketch**: Replace `bg-[#1a1a24]` with `bg-surface-deep` (or, if a darker-than-deep tooltip surface is wanted, add `--surface-tooltip` to the theme tokens and use `bg-surface-tooltip`). Cross-reference the rest of the file to confirm no other hex literals slipped in (none found in this read).

## 7. The PNG-export canvas renderer is a maintenance trap — a parallel rendering of the same data with no shared layout source

- **Severity**: Low
- **Category**: Component Architecture
- **File**: src/components/modules/evaluator/WeeklyDigestView.tsx:470-658 (renderDigestToCanvas + roundRect)
- **Scenario**: `renderDigestToCanvas` is 188 lines of imperative canvas drawing that mirrors the React JSX above it — same KPI tiles, same daily activity bars, same module leaderboard, same achievements. None of the dimensions, color choices, or thresholds are shared with the JSX renderer: KPI tile width is computed `(W - 80 - 30) / 4` here, fixed `gap-3` grid above; bar `barMaxH = 40` here, `h-12` (`48px`) above; achievement pill radius `12` here, `rounded-full` (`9999`) above; module-leaderboard threshold uses `ACCENT_RED` for fail (line 558, 592) vs. `MODULE_COLORS.evaluator` in the JSX (line 227, 273) — *different reds in the same chart between screen and exported PNG*.
- **Root cause**: Canvas rendering can't reuse JSX, so duplication is inevitable — but no shared constants module (`weekly-digest-layout.ts`) was extracted.
- **Impact**: The "Share as Image" feature ships a slightly-different visual than what the user sees on screen, eroding trust ("did this even capture what I'm looking at?"). Future tweaks to thresholds or colors will need to be made in two places and one of them will be missed.
- **Fix sketch**: Extract `WEEKLY_DIGEST_LAYOUT` and `WEEKLY_DIGEST_COLORS` constants ({ kpi: { gap, height, padding }, sparkline: { maxHeight, gap }, leaderboard: { rowHeight, barOffset } }) used by both render paths. Use `successRateColor()` (per finding 2) on both sides so the leaderboard never disagrees with itself. Long-term: render the JSX surface to PNG via `html-to-image` or `dom-to-image` and delete `renderDigestToCanvas` entirely — the duplication would dissolve and exports would be pixel-perfect to the on-screen view.
