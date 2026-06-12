# Economy & Balance Simulation — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Config clamp fix only covers `simulate` — `generate-code` and the entire `/sweep` route still feed raw client configs into `runSimulation`
- **Severity**: High
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/app/api/economy-simulator/route.ts:73`
- **Scenario**: The 2026-06-09 finding #1 fix added `clampConfigInt` — but only to `action: 'simulate'`. POST `{ action: 'generate-code', config: { agentCount: 0 } }` (route.ts:73-75 still uses the old `Math.min(... ?? 100, 500)` with no lower bound/NaN guard), or POST `/api/economy-simulator/sweep` with `{ config: { agentCount: 0, seed: 1 } }` (sweep/route.ts:13 passes `config` to `runSensitivitySweep` with zero clamping), and the unvalidated config reaches `runSimulation` exactly as before. This is the residual half of the known fix — new because the fix landed and missed two of the three `runSimulation` entry points.
- **Root cause**: The fix sketch said "single helper, single source of truth", but `clampConfigInt` was applied at one call site instead of inside a shared config-normalization step; the other entry points kept their pre-fix code paths. Worse, the sweep route runs 1 + 2×15 = 31 full simulations per request, so an unclamped `agentCount: 1e8` or `maxPlayHours: 1e7` is a 31×-amplified CPU DoS that `simulate`'s 500-agent cap was meant to prevent.
- **Impact**: NaN/undefined-poisoned UE5 codegen output (`ExpectedEndgameGold = undefined`, `InflationThreshold = NaN.f`) emitted as "calibrated" C++; NaN sweep entries; unbounded server CPU on the sweep route (event-loop starvation — better-sqlite3 app is single-process).
- **Fix sketch**: Move clamping into one exported `normalizeSimulationConfig(body.config)` (reusing `clampConfigInt`) and call it in all three places: `simulate`, `generate-code`'s re-simulate branch, and `sweep/route.ts` before `runSensitivitySweep`. Also clamp `range` into `[0.05, 0.9]` in the sweep route.

## 2. Tornado chart relabels stale sweep data when the output metric is toggled — gini values displayed as "Net Flow /hr"
- **Severity**: Medium
- **Lens**: bug
- **Category**: stale-state
- **File**: `src/components/modules/evaluator/EconomySimulatorView.tsx:872`
- **Scenario**: User runs a sweep with "Endgame Gini" selected; results render. User then clicks "Net Flow /hr" (or "Critical Alerts") without clicking "Run sweep". The existing `sweep` state (gini values ≈ 0.0–1.0) stays mounted, but `fmt` and the axis/baseline labels key off the *current* `output` state — so gini 0.43 is rendered as `formatGold(0.43)` → "0" under a "Net Flow /hr" framing, and every bar reads "0 → 0".
- **Root cause**: `SweepResult` carries the `output` it was computed for (`sensitivity-sweep.ts:20`), but `TornadoSection` ignores `sweep.output` and formats with the selected-toggle state. The toggle looks like a view filter but is actually only an input to the *next* run; nothing invalidates or re-labels the previous result.
- **Impact**: Confidently wrong numbers under the wrong label — a designer reading "Net Flow sweep: everything 0 → 0" concludes no parameter affects net flow, when they are looking at reformatted gini data. No error, no hint.
- **Fix sketch**: Format and label from `sweep.output` instead of `output`; when `output !== sweep.output`, dim the chart and show "Showing {sweep.output} — re-run for {output}" (or simply `setSweep(null)` on toggle).

## 3. Saving a run with an existing name silently overwrites it — including the baseline snapshot
- **Severity**: Medium
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/lib/economy/economy-run-db.ts:44`
- **Scenario**: User saved run "v1-economy" weeks ago and marked it baseline. Today they run a new simulation and type "v1-economy" again (forgotten, or intentionally reusing a naming scheme) and click Save. `saveRun`'s `ON CONFLICT(name) DO UPDATE` replaces the stored config + metrics in place, keeping `is_baseline = 1`.
- **Root cause**: Upsert-by-name was chosen for idempotency, but neither the API (`save-run` returns 200 + the run either way, no "overwritten" flag) nor the UI distinguishes create from overwrite. Because `is_baseline` survives the update, the baseline's *metrics are silently replaced with the current run's own metrics* — drift then compares the run against itself and reports "✓ No drift vs baseline".
- **Impact**: Irreversible loss of the original baseline snapshot plus success theater: the drift guardrail reads green precisely when the reference it guards was destroyed.
- **Fix sketch**: Return an `overwritten: boolean` from `saveRun` (or reject with 409 unless `overwrite: true`); in `EconomyRunsStrip`, when the typed name matches an existing run, show "Overwrite 'v1-economy'?" confirmation — with an extra warning when that run is the baseline.

## 4. `buildSupplyDemand` divides cohort earnings by the total agent count — affordability index inflated for every level past the early game
- **Severity**: Medium
- **Lens**: bug
- **Category**: logic-error
- **File**: `src/lib/economy/simulation-engine.ts:500`
- **Scenario**: An 80-hour run ends with only ~30% of 100 agents at level ≥ 20. For level 20 supply/demand points, `avgGold` is computed as `agents.filter(a => a.level >= 20).reduce(sum totalGoldEarned) / Math.max(agents.length, 1) / level` — the filtered cohort's earnings are divided by **all 100 agents**, not the ~30 in the cohort.
- **Root cause**: The denominator uses `agents.length` (total population) while the numerator sums only the `a.level >= level` subset. The per-agent income estimate is therefore understated by the cohort fraction (≈3.3× here), and `affordabilityIndex = avgPrice / avgGold` is overstated by the same factor, growing worse the higher the level (smaller cohorts).
- **Impact**: Wrong results in the Supply/Demand chart tooltip ("Afford: 6.20" when the true index is ~1.9) — endgame items systematically look unaffordable, pushing designers to cut prices that were actually fine. No crash; silently biased analysis.
- **Fix sketch**: Capture the filtered array once (`const cohort = agents.filter(a => a.level >= level)`), divide by `Math.max(cohort.length, 1)`, and keep the existing `affordabilityIndex 999` sentinel for empty cohorts.

## 5. "Download All" fires 7 synchronous programmatic downloads — browsers block all but the first, and the blob URL is revoked while the download may still be starting
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/evaluator/EconomyCodeGenPanel.tsx:44`
- **Scenario**: User clicks "All" to download the 7 generated UE5 files. `handleDownloadAll` loops, creating an anchor per file, calling `a.click()` and `URL.revokeObjectURL(url)` back-to-back. Chrome's multiple-download throttling allows the first download and prompts/blocks the rest (silently dropped if the user previously denied the permission); the anchor is never appended to the DOM (required by Firefox for programmatic clicks); immediate `revokeObjectURL` races the navigation in some browsers.
- **Root cause**: The code assumes N programmatic `click()`s in one task behave like N user-initiated downloads. Browsers deliberately gate batch downloads, and object-URL lifetime is not guaranteed past the synchronous click.
- **Impact**: User believes they exported the full UE5 module but gets only `EconomyConfig.h` — the missing `.cpp`/tags files surface later as C++ link errors in their project, far from the cause. No error is shown in the app.
- **Fix sketch**: Bundle the files into a single download (zip via JSZip, or one concatenated `.txt` with file separators); if keeping per-file downloads, `document.body.appendChild(a)`, `await` a ~250 ms delay between clicks, and defer `revokeObjectURL` with `setTimeout`.

## UI findings

## 6. All four economy charts are hover-only — zero keyboard or screen-reader access to the simulation's core output
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/EconomySimulatorView.tsx:540`
- **Scenario**: A keyboard or screen-reader user runs a simulation. The Gold Flow bars (line 540), Gini strip (646), wealth histogram (670), and Supply/Demand bars (736) expose their data exclusively through `hidden group-hover:block` tooltips on plain non-focusable `div`s. Tab order skips the charts entirely; a screen reader announces nothing — the entire analytical payload of the feature is mouse-only.
- **Root cause**: Tooltip visibility is keyed solely to `:hover` via `group-hover`, with no `tabIndex`, no `group-focus-within:` variant, and no `role="img"`/`aria-label` text alternative summarizing each chart.
- **Impact**: The module's primary output (inflation trends, inequality, supply/demand) is unusable without a pointer — a severe a11y gap in the feature's main content, not its chrome.
- **Fix sketch**: Make each bar a focusable element (`tabIndex={0}`, `role="img"`, `aria-label`="Hour 40: in 2.1K/hr, out 1.8K/hr, net +300/hr") and add `group-focus-within:block` beside `group-hover:block`; give each chart container an `aria-label` one-line summary (e.g. "Gold flow over 80 hours, net inflationary after hour 30").

## 7. Chart hover-tooltip JSX copy-pasted 4× with drifting styles — and the Gold Flow variant overflows the card edge
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/evaluator/EconomySimulatorView.tsx:540`
- **Scenario**: The absolute-positioned tooltip block appears at lines 540, 646, 670, and 736 with inconsistent copies: Gold Flow uses `mb-2 px-2.5 py-1.5 rounded-lg shadow-lg` and is *not* centered (no `left-1/2 -translate-x-1/2`), so tooltips on the rightmost bars spill outside the SurfaceCard and get visually clipped/awkward; the other three use `mb-1 px-1.5 py-0.5 rounded` centered, two without shadow. Hovering across sections shows three subtly different tooltip designs.
- **Root cause**: No shared `ChartTooltip` primitive — each chart re-implements the pattern, and per-copy tweaks accumulated. None clamp to container bounds.
- **Impact**: Visible polish inconsistency within a single view, edge tooltips cut off on the most recent (rightmost = endgame) data points users care about most, and 4× maintenance cost for any future fix (e.g. the a11y work in finding 6).
- **Fix sketch**: Extract `<ChartTooltip rows={...}>` with one style (centered, shadowed, `whitespace-nowrap`), clamped via `max-w` + edge-aware translate (or simply right-align for the last 20% of bars), and reuse it in all four charts.

## 8. Saved-run delete is one un-confirmed click sitting 12 px from the load/baseline buttons
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/EconomyRunsStrip.tsx:117`
- **Scenario**: Each run chip packs three tiny (w-3) icon buttons — load, baseline-toggle, delete — into one ~110 px pill. Clicking the Trash2 icon immediately and permanently deletes the run: no confirmation, no undo, no toast. A user aiming for the bookmark (baseline) icon and missing by a few pixels destroys a saved calibration snapshot; deleting the baseline run also silently clears the baseline and the drift row vanishes without explanation.
- **Root cause**: Destructive action treated identically to navigational ones — same size, adjacent placement, instant effect; the store's `deleteRun` has no soft-delete or confirmation gate.
- **Impact**: Irreversible loss of curated baseline/run data from a misclick; violates the app's stakes hierarchy (runs are the persistence feature of this module).
- **Fix sketch**: Two-step confirm on the chip (first click swaps Trash2 → "Delete?" in red for 3 s, second click commits), or a small confirm popover; keep delete visually separated (e.g. only visible on `group-hover`, left divider).

## 9. Collapsible section headers lack `aria-expanded`, and the CodeGen title row invisibly changes function from "expand" to "trigger network call"
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/EconomyCodeGenPanel.tsx:74`
- **Scenario**: The Config button correctly sets `aria-expanded` (EconomySimulatorView.tsx:164), but the Inflation Alerts header toggle (EconomySimulatorView.tsx:782) and the CodeGen header (EconomyCodeGenPanel.tsx:74) don't — screen readers can't tell the sections are collapsed. Worse, when no code has been generated yet, clicking the CodeGen title row *generates code* (a network call) instead of expanding, with no chevron and no affordance distinguishing the two behaviors.
- **Root cause**: Disclosure pattern applied inconsistently across the three collapsibles in this view; the CodeGen header overloads `onClick={() => codeGenResult ? setExpanded(!expanded) : handleGenerate()}` so one control has two unannounced modes.
- **Impact**: SR users get no collapsed/expanded state on 2 of 3 sections; any user can fire an unexpected generation request by clicking what reads as a static title.
- **Fix sketch**: Add `aria-expanded={expanded}` to both header buttons; make the CodeGen title row expand-only (no-op or expand+auto-generate with the chevron always rendered), leaving generation to the explicit "Generate UE5 Code" button.

## 10. Save-run input relies on placeholder-as-label and gives no inline failure feedback
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/EconomyRunsStrip.tsx:62`
- **Scenario**: The "Name this run…" input has no `<label>` or `aria-label` — its accessible name falls back to the placeholder, which disappears the moment the user types and doubles as a state indicator ("Run a simulation to save…"). If the save POST fails, `saveCurrentRun` writes to the store's global `error`, which renders in the main view body far below; in the strip itself the spinner just stops and the typed name remains, with no local indication anything failed.
- **Root cause**: Placeholder is doing three jobs (label, hint, disabled-state explainer), and the strip has no local error surface — errors are routed to a distant shared banner.
- **Impact**: SR users get a vanishing/ambiguous field name; sighted users experience silent save failures (classic "did my click work?" loop, risking duplicate names and finding #3's overwrite path).
- **Fix sketch**: Add `aria-label="Run name"`; on save failure show an inline red `role="alert"` text next to the Save button (reuse the ConfigField error styling) instead of relying on the global error card.
