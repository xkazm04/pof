# Progression & Save Systems — Bug + UI Scan

> Total: 9

## Bug findings

### 1. XP curve chart silently truncates before the labeled Max Level
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_progression/_shared/data.ts:34
- **Scenario**: `generateChartData` loops `for (let lvl = 1; lvl <= MAX_LEVEL; lvl += 5)` with `MAX_LEVEL = 50`. The sequence is 1, 6, 11, 16, 21, 26, 31, 36, 41, 46 — the next step (51) exceeds 50 and the loop exits. Level 50 is never produced.
- **Root cause**: The loop starts at 1 instead of 0 and never snaps the final point to `MAX_LEVEL`; the `levelToUse = lvl > MAX_LEVEL ? MAX_LEVEL : lvl` clamp inside the loop body is dead code because the loop condition already guarantees `lvl <= MAX_LEVEL`, so it can never fire.
- **Impact**: `MainChartArea.tsx` header reads "Max Level: 50 | Max XP: …" (src/components/modules/core-engine/sub_progression/curves/MainChartArea.tsx:40) sourced from `maxXp = chartData[chartData.length-1]?.xp`, which is actually the XP for level 46, not 50. Designers tuning the curve see a "Max XP" figure that under-reports the true level-50 cost, and `CurveDeltaSummary`/`XpTableGenerator` consumers relying on the same data silently reflect the same off-by-one gap.
- **Fix sketch**: Build the level series explicitly (e.g. `[...range(1, MAX_LEVEL, 5), MAX_LEVEL]` deduped) or change the loop to `for (let lvl = 5; lvl < MAX_LEVEL; lvl += 5) { … } push(MAX_LEVEL)` so the last sampled level is always exactly `MAX_LEVEL`.

### 2. Danger-zone ratio silently mislabels a level as "Hard" when player/enemy arrays desync
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_progression/analysis/PowerCurveDangerZones.tsx:74
- **Scenario**: The component accepts `playerPower`/`enemyDifficulty` as override props (both default to same-length arrays today). If a caller passes arrays of different lengths — e.g. `enemyDifficulty` one element shorter than `playerPower` (a very plausible "add one power sample without updating the difficulty table" authoring mistake) — the loop at line 70 iterates `playerPower.length - 1` times and reads `enemyDifficulty[i]` past its end for the last index.
- **Root cause**: `ratio = safeDivide(playerPower[i], enemyDifficulty[i])` receives `undefined` for the out-of-range index. `safeDivide` does `Math.abs(divisor) < epsilon` which is `false` for `NaN`, so `safeDivisor = NaN`, the division yields `NaN`, and `Number.isFinite(NaN)` is false, so `safeDivide` returns `0` — not an error, not a visible break.
- **Impact**: `ratio` of `0` falls into the `ratio > 0.77` false branch, so the zone silently renders as `STATUS_TOKENS.bad` ("Hard", enemy overpowering) regardless of the real data — a wrong answer presented with full visual confidence, and no console warning or empty-state fallback (the `plottable` guard only checks length ≥ 2 and spread, not equal lengths).
- **Fix sketch**: Add an explicit length-equality check to the `plottable` guard (`playerPower.length === enemyDifficulty.length`) and render `ChartEmptyState` (or throw in dev) when they diverge, instead of letting `safeDivide` mask the mismatch as a valid ratio.

### 3. Cloud sync "Last Sync" timestamp is timezone-dependent and can mismatch server/client render
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_save/advanced/CloudSyncStatus.tsx:38
- **Scenario**: `new Date(CLOUD_SYNC.lastSync).toLocaleTimeString()` formats a fixed UTC ISO timestamp (`'2026-02-26T14:32:08Z'`) using the runtime's local timezone. Next.js can pre-render this tree on the server (server's OS/container timezone, frequently UTC) and then hydrate on the client (the author's local timezone).
- **Root cause**: `toLocaleTimeString()` with no explicit `timeZone` option is environment-dependent; the component is `'use client'` but is still subject to SSR + hydration in the app's rendering pipeline, so the string computed during the initial server pass can differ from the client's re-render.
- **Impact**: React hydration-mismatch warning in dev, and in worse cases a visibly "wrong" last-sync time flashing/correcting after hydrate — undermines trust in a status widget whose entire purpose is to show accurate sync recency.
- **Fix sketch**: Either compute the formatted time only after mount (`useEffect` + local state, matching the common "suppressHydrationWarning" pattern) or pin an explicit `timeZone`/format via `Intl.DateTimeFormat` so server and client agree.

### 4. Data Recovery step tracker is a pure label toggle with no backing recovery state
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_save/advanced/DataRecoveryTool.tsx:52
- **Scenario**: Clicking any of the four step pills (`Detect / Recover / Verify / Confirm`) just calls `setRecoveryStep(step.id)` — including jumping backward, or straight to "Confirm" without ever visiting "Detect"/"Recover"/"Verify".
- **Root cause**: There is no state machine or validation gating the transitions; `RECOVERY_RESULTS` and the confidence gauge are static constants unrelated to `recoveryStep`, so the "current step" has no effect on what data is shown.
- **Impact**: The control looks like a live wizard with sequential gating (visual "complete"/"current" styling implies progress must be earned) but is actually a free-jump tab selector over content that never changes — a success-theater UI element that could mislead a user into thinking they drove an actual recovery action.
- **Fix sketch**: Either restyle it as a plain non-sequential tab bar (drop the "isComplete" progress semantics) or wire step transitions to actually gate/reveal the relevant `RECOVERY_RESULTS` subset per step.

## UI findings

### 5. Build stat comparison table hardcodes 3 columns for a 5-preset dataset
- **Severity**: High
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_progression/builds/BuildPathComparison.tsx:60
- **Scenario**: `BUILD_PRESETS` (src/components/modules/core-engine/sub_progression/_shared/data.ts:104) ships 5 builds (Warrior, Mage, Rogue, Jedi Guardian, Sith Inquisitor), and both the header row (line 62) and every stat row (line 71) `.map()` over all 5. But the grid container is `grid-cols-[1fr_repeat(3,60px)]` (lines 60 and 69) — a fixed template for exactly 3 stat columns.
- **Root cause**: The build-preset toggle bar above it (lines 22-43) was correctly built to scale with `BUILD_PRESETS.length`, but the comparison table's CSS grid template was left hardcoded from an earlier 3-build version and never updated when Jedi Guardian/Sith Inquisitor were added.
- **Impact**: With 5 presets rendered into a 4-track grid template (`1fr` + 3×`60px`), the 4th and 5th preset's label/value cells overflow the defined columns — misaligned headers vs. values, likely visually overlapping or wrapping unpredictably, defeating the entire point of a side-by-side stat comparison.
- **Fix sketch**: Replace the hardcoded `repeat(3,60px)` with `repeat(${BUILD_PRESETS.length},60px)` (inline style, since Tailwind can't take a dynamic arbitrary value from a JS expression) or switch to `grid-template-columns: 1fr repeat(var(--cols),60px)` set via a CSS variable.

### 6. Inconsistent aria-pressed usage between near-identical toggle-button patterns
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_progression/builds/BuildPresetPanel.tsx:24
- **Scenario**: `BuildPathComparison.tsx` (line 30) sets `aria-pressed={active}` on its build-filter toggle buttons. `BuildPresetPanel.tsx`'s visually identical preset-select buttons (`onClick={() => setActiveBuild(idx)}`, styled by `isActive`) omit `aria-pressed` entirely, even though they're the same "select one of N labeled chips" affordance rendered a few files apart in the same feature.
- **Root cause**: The two components were authored independently without a shared `ToggleChip`/`SegmentedControl` primitive, so accessibility semantics drifted between copies of the same pattern.
- **Impact**: Screen-reader users get state feedback ("pressed"/"not pressed") on one toggle group but not the other within the same tab, an inconsistent and confusing experience for assistive tech users moving between Builds sub-sections.
- **Fix sketch**: Extract a shared toggle-chip component (or at minimum add `aria-pressed={isActive}`/`role="tab"` consistently) so both build-selection surfaces expose identical semantics.

### 7. Compare-mode split pane has no responsive fallback and cramps on small viewports
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_progression/curves/MainChartArea.tsx:47
- **Scenario**: When `compareMode` is on, the Snapshot/Live charts render inside `<div className="grid grid-cols-2 gap-3 mt-2">` — a fixed 2-column grid with no `sm:`/`lg:` breakpoint. Every sibling grid in this same component and its parent (`index.tsx`) consistently uses the `grid-cols-1 lg:grid-cols-N` mobile-first pattern (e.g. `index.tsx:107,134`).
- **Root cause**: This one grid was written as a permanent 2-up layout instead of following the established responsive convention used everywhere else in the module.
- **Impact**: On narrow/tablet viewports each of the two 220px-tall XP charts is squeezed into roughly half the available width, making axis labels and the "Base X | Exp Y" captions (lines 54-56, 68-70) wrap or truncate — the one feature (curve compare) that most needs legible side-by-side reading becomes the least legible on smaller screens.
- **Fix sketch**: Change to `grid-cols-1 sm:grid-cols-2` (stack Snapshot above Live below the `sm` breakpoint) to match the responsive convention used elsewhere in the same file.

### 8. Static/mock live-status widgets pulse and animate as if truly real-time
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_save/advanced/CloudSyncStatus.tsx:22
- **Scenario**: The status dot uses `animate={{ opacity: [0.5, 1, 0.5] }}, transition={{ duration: 2, repeat: Infinity }}` — a classic "live/heartbeat" pulsing indicator — bound to `CLOUD_SYNC`, a frozen module-level constant (`src/components/modules/core-engine/sub_save/_shared/data-panels.ts:55`) that never changes at runtime.
- **Root cause**: The animation was copied from a genuinely-live status pattern but wired to static demo data with no interval/poll to actually refresh it.
- **Impact**: Visually implies an actively-monitored live connection ("synced", pulsing) when the values (queue size, conflicts, bandwidth) are permanently fixed — the same success-theater ambiguity flagged for the recovery tool (finding #4), reinforcing a pattern of interactive-looking-but-inert authoring surfaces across the save-system tab.
- **Fix sketch**: Either drive the pulse only while an actual sync operation is in flight (gate on a real `isSyncing` boolean) or drop the infinite pulse animation for a static status glyph so idle "synced" state doesn't visually claim ongoing activity.

### 9. Serialization budget bar can show a negative "free" figure when segments exceed budget
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_save/advanced/SerializationProfiler.tsx:51
- **Scenario**: `{SERIALIZATION_BUDGET_MS - SERIALIZATION_TOTAL}ms free` is rendered with no floor. Today's fixture data (67ms of 100ms budget) keeps it positive, but the moment authored segment data pushes `SERIALIZATION_TOTAL` above `SERIALIZATION_BUDGET_MS` (entirely plausible as more save-system state gets added), this renders e.g. `-12ms free`.
- **Root cause**: No `Math.max(0, …)` guard on the derived "free" value, unlike the budget bar's color ramp just below it which does correctly clamp/branch on the same over-budget condition.
- **Impact**: A raw negative number in a slot that's semantically "remaining capacity" reads as a rendering bug rather than the "you are over budget" signal it's meant to convey, undermining the profiler's credibility exactly when it matters most (the budget-exceeded case).
- **Fix sketch**: Clamp with `Math.max(0, SERIALIZATION_BUDGET_MS - SERIALIZATION_TOTAL)` and, when the true delta is negative, surface it as an explicit "Xms over budget" label using the existing `STATUS_ERROR` token instead of silently flooring to 0 or showing a negative number.
