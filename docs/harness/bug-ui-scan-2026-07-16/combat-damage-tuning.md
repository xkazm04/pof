# Combat & Damage Tuning — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Concurrent simulation runs corrupt state via last-write-wins
- **Severity**: Critical
- **Category**: bug
- **File**: src/stores/combatSimulatorStore.ts:142-203 (also src/components/modules/evaluator/CombatSimulatorView/index.tsx:91-102, 143-152)
- **Scenario**: User clicks "Run 1000 Fights", then — before React re-renders the `disabled={isSimulating || !tuning}` button — clicks it again (double-click, or clicks then quickly edits a scenario field that re-triggers `handleRun` through some other path). Two independent `runSimulationStreaming` calls now execute concurrently, each with its own `reader`/`buffer`/`finalResult` local state, but both write into the *same* shared zustand fields (`result`, `summary`, `alerts`, `comparison`, `isSimulating`, `simProgress`) via `set()`.
- **Root cause**: There is no request-token / generation counter guarding which in-flight call is allowed to commit its result. `isSimulating` is set `true` synchronously at the start of each call, but that alone does not prevent a second call from starting between the click and the DOM's disabled-attribute update, and nothing invalidates an older call's `set()` once a newer one has started.
- **Impact**: Whichever stream's `finally`-equivalent `set()` resolves last "wins", even if it was the *older*, slower request (e.g. a smaller iteration count finishing after a larger concurrent run). The UI can silently display a stale/mismatched result (wrong scenario, wrong iteration count) as if it were the latest run, undermining the entire balance-tuning workflow's trustworthiness.
- **Fix sketch**: Add a monotonically increasing `runId` in the store; capture it at the start of each `runSimulationStreaming` call and only apply the terminal `set()` (progress and final result) if `get().activeRunId === runId`. Alternatively, cancel/ignore any previous in-flight reader when a new run starts (abort via `AbortController`).

### 2. Removing a combo ability silently changes the new first hit's damage math
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_combat/combos/helpers.ts:15, src/components/modules/core-engine/sub_combat/combos/TimelineBlock.tsx:24
- **Scenario**: User builds a 4-ability combo chain, then clicks the "×" remove button on the first block. `removeAbility` filters by array index, so ability #2 becomes the new index 0. Both `computeComboStats` (for Total DMG/DPS stats) and `TimelineBlock` (for the per-block damage label) special-case `index === 0` to force `multiplier = 1.0`, overriding that ability's real `comboMultiplier`. The previously-second ability's damage number silently changes (goes up or down) purely because of its new position — no user action targeted it, and nothing in the UI explains why its number moved.
- **Root cause**: The "no combo bonus on the opener" rule is encoded as "index 0 in the current array" rather than tied to a stable per-block identity/flag, so any removal/reorder retroactively re-labels a different ability as "the opener."
- **Impact**: Balance designers reading the Total DMG/DPS stat strip after pruning a chain will see numbers move for a reason unrelated to the change they just made, which is exactly the kind of surprising, hard-to-trust output a Monte-Carlo/tuning tool must not produce.
- **Fix sketch**: Track "is combo opener" as an explicit flag on the chain entry set once when the first ability is added (or always treat index 0 as opener but surface a small inline badge/tooltip — "opener: no combo bonus" — so the multiplier drop is visible, not implicit).

### 3. A/B comparison silently diffs runs from different scenarios
- **Severity**: Medium
- **Category**: bug
- **File**: src/stores/combatSimulatorStore.ts:207-212, src/components/modules/evaluator/CombatSimulatorView/index.tsx:91-102, 133-141
- **Scenario**: User runs a fight, pins it as baseline via `pinBaseline()`, then changes the scenario (player level, gear, ability loadout, or enemy setup) in `ScenarioBuilder` before clicking "Run Candidate". `handleRun` builds a brand-new `CombatScenario` from current UI state and runs it; `compareRuns(baseline, data.result, …)` executes unconditionally whenever a baseline exists.
- **Root cause**: `pinBaseline`/`runSimulationStreaming` never snapshot or compare `scenario` identity between the pinned baseline and the new candidate — the only gating is "does a baseline exist," not "is this an apples-to-apples comparison."
- **Impact**: The `ABComparisonPanel` renders a delta (survival rate, DPS, etc.) that looks like a controlled tuning-parameter comparison but may actually reflect an entirely different encounter (different enemy count/level or gear), misleading balance decisions with no warning banner.
- **Fix sketch**: Store the baseline's `scenario` alongside its result; when computing `comparison`, check for scenario equality (or at least enemy composition + player level + gear) and either block the diff or show an explicit "scenario changed since baseline was pinned" warning in the comparison panel.

### 4. SSE stream parser can silently drop the final frame / mis-decode multi-byte boundary
- **Severity**: Medium
- **Category**: bug
- **File**: src/stores/combatSimulatorStore.ts:152-183
- **Scenario**: The reader loop calls `decoder.decode(value, { stream: true })` and appends to `buffer`, splitting on `\n\n`; on `done`, it `break`s immediately without a final `decoder.decode()` flush call and without processing any content still sitting in `buffer` (only the last split segment before a `\n\n` is retained as `buffer`, the rest is used). If the server's final chunk is delivered without a trailing blank-line terminator before the connection closes (e.g. connection cut mid-frame, or a server that doesn't append the trailing `\n\n` after the last SSE event), the `result` frame is left un-parsed in `buffer` and discarded.
- **Root cause**: Streaming decode loop doesn't flush the decoder (`decoder.decode()` with no args) nor attempt to parse a trailing unterminated frame once `done` is true.
- **Impact**: A completed, successful simulation on the server can present to the user as `"Simulation stream ended without a result"` — a spurious failure for a run that actually finished, forcing a wasted re-run of potentially 1000+ Monte-Carlo iterations.
- **Fix sketch**: After the loop exits, flush the decoder and attempt to parse any remaining non-empty `buffer` as a final frame before deciding `finalResult` is missing.

### 5. "Simulating N…" label can display a different iteration count than the run actually in flight
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/CombatSimulatorView/index.tsx:64, 91-102, 143-152
- **Scenario**: User sets iterations to 1000, clicks Run. While `isSimulating` is true, the `iterations` input inside `ScenarioBuilder` is never disabled (no `isSimulating` prop is passed to it), so the user can type a new value, e.g. 5000, while the previous 1000-iteration run is still streaming. The header button renders `` `Simulating ${iterations}… ${Math.round(simProgress * 100)}%` `` using the *current* `iterations` state, not the count actually passed into the in-flight `config`.
- **Root cause**: The progress label reads from local component state that is mutable during the async operation instead of from the config actually submitted with the active request (or a store field capturing it).
- **Impact**: The user is shown a fabricated "N iterations, X% done" progress readout that doesn't correspond to the real running job — a success-theater style silent-failure (no crash, just wrong information) that could mislead someone waiting on a 1000+ iteration Monte-Carlo run.
- **Fix sketch**: Capture the submitted `config.iterations` (and disable the iterations input) at `handleRun` time, and read that captured value for the progress label instead of the live `iterations` state.

## UI findings

### 6. Breadcrumb nav has no visible keyboard focus indicator, unlike the tab bar directly beneath it
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_combat/CombatNav.tsx:24-36
- **Scenario**: A keyboard user tabs through the Combat Action Map. The `CombatSubTabNav` buttons a few lines below (line 61-90) explicitly apply `focusRingStyle(ACCENT)` and `FOCUS_RING_CLASS` for a visible focus ring, but the `NarrativeBreadcrumb` buttons (lines 24-36) have no focus styling at all beyond the browser's default (which is frequently suppressed by the app's global CSS reset elsewhere in this design system).
- **Root cause**: The breadcrumb component was written as a "local copy" of a shared nav pattern (per the file's own comment) but the focus-ring treatment wasn't carried over.
- **Impact**: Two adjacent, functionally-identical navigation controls (both switch `activeTab`) behave inconsistently for keyboard/accessibility users — one is clearly focusable, the other effectively invisible when focused.
- **Fix sketch**: Apply the same `FOCUS_RING_CLASS` / `focusRingStyle(ACCENT)` treatment used in `CombatSubTabNav` to the breadcrumb buttons.

### 7. Combo multiplier feedback is asymmetric — bonuses are called out, penalties are hidden
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_combat/combos/TimelineBlock.tsx:24, 79
- **Scenario**: A designer chains an ability whose `comboMultiplier` is below 1.0 (a combo-position penalty) into a chain. `effectiveDmg` correctly reflects the reduced number, but the "×{comboMult}" green annotation only renders when `comboMult > 1` (line 79), so a damage-reducing multiplier is applied invisibly — the number just looks lower with no explanation, while a damage-boosting multiplier gets an explicit, colored callout.
- **Root cause**: The multiplier badge condition (`comboMult > 1`) was written only for the buff case; the penalty case was never given equivalent treatment.
- **Impact**: Balance designers scanning the timeline for "why is this ability's damage different" get an answer only half the time, making the tool feel inconsistent and less trustworthy for iterative tuning.
- **Fix sketch**: Show the multiplier badge whenever `comboMult !== 1`, using a distinct color (e.g. red/orange) for `< 1` versus green for `> 1`.

### 8. Cooldown overlap chart doesn't share the reusable responsive SVG wrapper its sibling diagrams use
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_combat/combos/CooldownOverlapChart.tsx:42, compare src/components/modules/core-engine/sub_combat/damage-pipeline/DamagePipelineFlow.tsx:55 and DirectHealthFlow.tsx:22
- **Scenario**: On a narrow viewport, `DamagePipelineFlow` and `DirectHealthFlow` both scale their diagrams to the available width via `ResponsiveSvgContainer`. `CooldownOverlapChart`, part of the same sub_combat module family, instead renders a raw `<svg width={w} height={totalH} viewBox=...>` (hardcoded `w = 400`) inside a plain `overflow-x-auto` div, so on mobile it simply gets a horizontal scrollbar and a fixed-size, non-scaling chart rather than shrinking to fit like its siblings.
- **Root cause**: Component-architecture inconsistency — one diagram type in the module adopted the shared responsive-SVG pattern, this one didn't.
- **Impact**: Inconsistent mobile experience within the same feature area: two of three SVG diagrams gracefully scale down, the cooldown chart requires horizontal scrolling even for short chains, breaking the "mobile-first" expectation set by its neighbors.
- **Fix sketch**: Wrap the `<svg>` in `ResponsiveSvgContainer` (already used two directories up) with `intrinsicWidth={w}` for consistency.

### 9. Preset / chain-empty states give no visual indication of which categories are affected together
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_combat/combos/index.tsx:80-106, 161-165
- **Scenario**: The "Preset Combos" row (lines 80-106) uses only color/opacity to indicate the active preset (`activePreset === preset.id`), and clicking any ability chip afterward silently clears `activePreset` back to `''` (per `addAbility`/`removeAbility`), so the preset buttons all revert to their unselected look with no transition or toast explaining "you've now diverged from the preset."
- **Root cause**: State transition (preset → custom chain) is a silent color change on a strip of buttons the user's attention is no longer on (they just clicked an ability chip elsewhere).
- **Impact**: Minor but real polish gap — users can lose track of whether they're looking at a named preset's stats or a modified/custom chain, since the only signal is a deselected button they aren't looking at.
- **Fix sketch**: Add a small inline label near the Timeline header (e.g. "Custom chain (modified from {lastPreset})") when `activePreset === ''` but the chain is non-empty and was seeded from a preset.
