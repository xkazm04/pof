# Progression & Save Systems — Bug + UI scan (2026-06-12)

> Total: 8 findings (3 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Build comparison table hardcodes 3 preset columns while BUILD_PRESETS ships 5
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/core-engine/sub_progression/builds/BuildPathComparison.tsx:60`
- **Scenario**: A designer opens Builds → Build Path Comparison. The stat table's header row and every stat row use `grid-cols-[1fr_repeat(3,60px)]` (lines 60 and 69), i.e. exactly 4 explicit tracks, but both rows map over `BUILD_PRESETS`, which now contains 5 presets (`Warrior, Mage, Rogue, Jedi Guardian, Sith Inquisitor` in `_shared/data.ts:104-145`). The 5th and 6th cells per row spill into implicit auto-sized grid columns.
- **Root cause**: The grid template and the `buildVisibility` init (`{ Warrior: true, Mage: false, Rogue: false }`, line 11-13) were written when there were 3 presets; the two Star Wars presets were later added to the shared data without updating the component's column contract. Each row is its own grid container, so the implicit columns are sized independently per row (`max-content` of one cell), meaning the JED/SIT header glyphs and their stat values don't share a column edge — the last two columns visibly drift between rows and the table can overflow its half-width panel.
- **Impact**: Wrong results by misreading — a comparison table whose last two columns are misaligned with their headers invites attributing Sith stats to Jedi (and vice versa); the new presets also can't be defaulted on, and the panel overflows at lg widths.
- **Fix sketch**: Derive the template from the data: `gridTemplateColumns: \`1fr repeat(${BUILD_PRESETS.length}, 60px)\`` via inline style (or `grid-cols-[1fr_repeat(5,52px)]` if widths must shrink), and build `buildVisibility` initial state with `Object.fromEntries(BUILD_PRESETS.map((b, i) => [b.name, i === 0]))` so the contract can't silently drift again.

## 2. Cloud sync "Last Sync" renders timezone-dependent time-of-day — hydration mismatch and stale syncs masquerade as fresh
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/core-engine/sub_save/advanced/CloudSyncStatus.tsx:38`
- **Scenario**: The Advanced tab renders `value={new Date(CLOUD_SYNC.lastSync).toLocaleTimeString()}` for the Last Sync stat. (a) In Next.js App Router this client component is still server-rendered: a server in UTC emits e.g. "2:32:08 PM" while a CET browser hydrates to "3:32:08 PM" → React 19 hydration text mismatch (console error, client re-render). (b) `lastSync` is `'2026-02-26T14:32:08Z'` (`_shared/data-panels.ts:56`) — the panel shows only a time-of-day with no date, so a sync from last February reads as "synced at 14:32 today" next to a green "synced" badge.
- **Root cause**: Locale/timezone-dependent formatting executed during render with no SSR-safe strategy, plus the formatting choice (`toLocaleTimeString`) silently discards the date component, assuming "last sync" is always same-day.
- **Impact**: Recurring hydration-mismatch console errors (environment-dependent time bomb — invisible in local dev where server TZ == client TZ), and a trust-surface lie: a months-stale cloud sync is presented as fresh, exactly the kind of misinformation that makes an operator skip a manual backup.
- **Fix sketch**: Format with an explicit relative/absolute renderer: compute "Xd ago" from `Date.now() - parsed` inside a `useEffect`/`suppressHydrationWarning`-guarded client-only value, or render a fixed-format UTC string (`date.toISOString().slice(0, 16) + 'Z'`) that is identical on server and client and keeps the date.

## 3. Diminishing-returns axis labels don't match the plotted coordinate scale (~11% read error)
- **Severity**: Low
- **Lens**: bug
- **Category**: wrong-results
- **File**: `src/components/modules/core-engine/sub_progression/analysis/DiminishingReturnsVisualizer.tsx:57`
- **Scenario**: A designer reads marginal value off the chart by eye against the y labels. The polyline maps values with `y = 100 - safeDivide(marginal, maxMarginal) * 90` (lines 81, 91, 99) — i.e. the data occupies only the bottom 90% of the viewBox, leaving 10% headroom — but `yLabels={[maxMarginal.toFixed(1), (maxMarginal/2).toFixed(1), '0']}` (line 57) are laid out by `NormalizedLineChart` with `justify-between` across the full plot height. The "max" label sits at y=0 where nothing is ever drawn; the actual max plots ~10% lower, and the midpoint value plots at y=55, not at the y=50 mid-label. Similarly the left x label "10 pts" (line 58) sits at x=0 while the first datum (`points=10`) plots at x=10% (line 80).
- **Root cause**: The 90%-scale headroom (added so the soft-cap text at y=8 doesn't collide with the line) was applied to the geometry but not to the label scale; labels assume a 0–100% mapping. The x labels assume the domain starts at the first sample, but the geometry maps `points/100` onto an axis whose origin is 0 pts.
- **Impact**: Every value read against the axes on a balance-tuning chart is overstated by ~11%, and the left axis tick is off by a full sample step — corrupted readings on the exact surface meant for tuning soft caps.
- **Fix sketch**: Drop the headroom from the data mapping (`* 100`) and instead pad via the container, or scale the labels by the same factor (label the top tick as `(maxMarginal / 0.9)` equivalent — better: compute label values from the same `y(v)` transform). Replace the `'10 pts'` left label with `'0 pts'` (or shift the x mapping to `points - 10 / 90`).

## UI findings

## 4. Data Recovery wizard steps are mouse-only clickable divs — keyboard users can't operate them
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_save/advanced/DataRecoveryTool.tsx:52`
- **Scenario**: The four step chips (Detect / Recover / Verify / Confirm) are `motion.div`s with `cursor-pointer` and an `onClick` (line 42-52) but no `role`, no `tabIndex`, and no key handler. A keyboard or screen-reader user tabs straight past the entire wizard control; the current/complete state is also conveyed only via inline color styles with no `aria-current`.
- **Root cause**: Interactive affordance built on a plain div for the sake of the `motion` scale animation, instead of `motion.button`; WCAG 2.1.1 (keyboard) and 4.1.2 (name/role/value) are unmet.
- **Impact**: A control that is operable by mouse only — severe a11y gap on a recovery surface, and inconsistent with the rest of the scope where step/preset selectors are real `<button>`s.
- **Fix sketch**: Switch to `motion.button type="button"` (keeps animations), add `aria-current={isCurrent ? 'step' : undefined}` and a visible focus ring (`focus-visible:ring-1`); the surrounding flex layout needs no change.

## 5. Selected-state toggle buttons are inconsistent: aria-pressed on one panel, color-only everywhere else
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_progression/analysis/DiminishingReturnsVisualizer.tsx:36`
- **Scenario**: `BuildPathComparison` correctly sets `aria-pressed` on its preset toggles (BuildPathComparison.tsx:30), but the visually identical attribute selector here (lines 36-47) and the preset buttons in `BuildPresetPanel.tsx:24` expose no pressed/selected state — and in all three, selection is conveyed by hue alone (tinted bg/border vs. muted text), with no shape/weight cue.
- **Root cause**: The pill-toggle pattern is re-implemented per panel instead of being a shared `<TogglePill active accent>` primitive, so the a11y fix applied to one copy never propagated to its siblings.
- **Impact**: Screen-reader users get three look-alike button rows where only one announces its state; low-vision users must distinguish selection purely by color (WCAG 1.4.1), and future panels will keep forking the pattern.
- **Fix sketch**: Extract the pill button (icon? label, accent color, `active`) into `_shared`, baking in `aria-pressed={active}` and a non-color active cue (e.g. the existing border + a check/format-weight change); replace the three inline copies.

## 6. Compare-mode layouts have no mobile breakpoints, unlike every sibling grid
- **Severity**: Medium
- **Lens**: ui
- **Category**: responsiveness
- **File**: `src/components/modules/core-engine/sub_progression/curves/MainChartArea.tsx:47`
- **Scenario**: Entering Compare mode renders the snapshot/live charts in a fixed `grid grid-cols-2 gap-3` (line 47) and the delta table in a fixed `grid grid-cols-5 gap-2` (CurveDeltaSummary.tsx:57). On a narrow window the two 220px charts shrink to unreadable slivers and five XP-number cards (with `toLocaleString` values like "1,084,202") overflow their boxes — while the rest of this module consistently uses `grid-cols-1 lg:grid-cols-N` (e.g. sub_progression/index.tsx:107, 134, 165).
- **Root cause**: The compare-mode panels were added without applying the module's established responsive convention; fixed track counts assume desktop width.
- **Impact**: Compare mode — the headline feature of the Curves tab — is effectively unusable below ~lg width, breaking the app-wide responsive consistency users get everywhere else.
- **Fix sketch**: `grid-cols-1 md:grid-cols-2` for the chart split and `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` (or `flex flex-wrap`) for the delta cards; let the per-level cards keep `min-w-0` so long XP strings truncate.

## 7. XP source rows print every label and percentage twice
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_progression/builds/XpSourceBreakdown.tsx:45`
- **Scenario**: Each source renders a header line ("Monster Kills … 60%", lines 30-33) and then the identical text again inside the bar ("Monster Kills - 60%", line 45) in hardcoded `text-white/80` — every row says everything twice, and the in-bar copy collides with short bars (a 10% bar can't contain "Exploration - 10%", which spills across the empty track).
- **Root cause**: Two labeling treatments (outside-row and in-bar) were combined instead of choosing one; the in-bar span is absolutely positioned over the full track, not the filled segment, so it only *looks* contained for large percentages.
- **Impact**: Visual noise and a sloppy first impression on an otherwise clean panel; the hardcoded white also ignores the theme tokens used everywhere else in the module.
- **Fix sketch**: Drop the in-bar duplicate (keep the header line, which already pairs label + colored pct), or keep only the in-bar label and clamp it with `max-width: ${pct}%` + truncate. One source of truth per row.

## 8. Budget bar's "80%" tick label is positioned with a margin hack and drifts off its marker
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/core-engine/sub_save/schema/BudgetAlerting.tsx:79`
- **Scenario**: The amber threshold line is drawn at exactly `left: 80%` of the bar (line 74), but its label is placed with `marginLeft: '76%', position: 'relative', left: '-8px'` inside a `flex justify-between` row (line 79). Because justify-between redistributes the leftover space, the label's true position varies with panel width (≈82% on a wide panel) and the row overflows at narrow widths, so the label visibly disagrees with the line it annotates — repeated for all five budget rows.
- **Root cause**: A flow-layout approximation of an absolutely-positioned tick; the 76%/-8px constants only line up at one specific width.
- **Impact**: The threshold annotation — the one number this alerting panel exists to communicate — looks misaligned and jitters across breakpoints, undermining the precision aesthetic of the rest of the panel.
- **Fix sketch**: Make the label row `relative` and position the tick absolutely to match the marker: `<span className="absolute left-[80%] -translate-x-1/2">80%</span>`, keeping "0" / "100%" as flex ends.
