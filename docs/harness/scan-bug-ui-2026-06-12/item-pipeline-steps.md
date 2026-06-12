# Item Pipeline Steps — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

Fix verification: commit 3d50330 (`produceFrom`) correctly serializes concurrent generative writes inside the store updater and is pinned by `src/__tests__/components/layout-lab/ItemArt.gallery.test.tsx`. No data-loss regression found in the fix itself; finding #2 below is a residual behavior the fix exposed, and finding #1 is a pre-existing path the fix does NOT cover.

## Bug findings (new since 2026-06-09)

## 1. "Populate demo" silently destroys the entire kept generation history — locally and on the server
- **Severity**: High
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/components/layout-lab/steps/itemsSteps.ts:400` (with `src/components/layout-lab/Baseline.tsx:180`)
- **Scenario**: An artist has run several Icon/3D/Material re-rolls (batches "kept across re-rolls" per the gallery's promise), then clicks the accent **Populate demo** button in the pipeline rail — e.g. to fill in the remaining static steps. Every generative step's artifact is overwritten by `ITEM_STEP_SPECS[step].produce(e)` (`{ selected: 0, prompt }`, `{ tris, cap }`, `{ maps }`) which contains **no `genHistory`**, and the write-through sink (`_labSync` → `postArtifact`) persists the wiped data to the server too. Because `hydrateEntity` is add-only, nothing ever restores it.
- **Root cause**: `populateItemDemo` loops `produce()` (whole-artifact replace) over **all** `ITEM_STEP_NAMES`, but the three generative steps store their batches *inside* `data.genHistory`. The demo path predates the gallery model and was never taught to either skip already-produced steps or merge through `produceFrom`/`appendBatch`. Bonus inconsistency: the demo-written `{ selected: 0 }` makes the Icon acceptance read PASS ("A main icon is selected · candidate · 256px") while the gallery says "No icon candidates yet" and the Selected·silhouette swatch is blank — two contradicting sources of truth for "selected".
- **Impact**: Irreversible loss of every kept batch, candidate, art direction, and prompt for all three generative steps (the exact artifact the gallery exists to preserve), plus a pass-while-empty acceptance contradiction on fresh entities. The 3d50330 fix protects against double-click loss but not against this wholesale wipe.
- **Fix sketch**: In `populateItemDemo`, skip steps that already have an artifact (`byEntity[id][step]`), or route generative steps through `produceFrom` with `appendBatch` so demo data merges instead of replacing. For the contradiction, have the generative specs' `produce()` emit a one-batch `genHistory` via `makeBatch`/`historyData` instead of bare `{ selected: 0 }`.

## 2. Double-click on Generate now appends duplicate batches and silently moves the selection (residue of the 3d50330 fix)
- **Severity**: Low
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/layout-lab/steps/shared/CliProduce.tsx:59` (with `src/components/layout-lab/steps/ItemArt.tsx:27`)
- **Scenario**: If the artist double-clicks "Generate via Leonardo (CLI)" (or "Produce fix") before noticing the first click landed, both clicks dispatch: pre-fix the second overwrote the first (batch lost); post-fix `produceFrom` serializes them, so **two near-identical batches** (same direction/prompt, only hue-shifted by `seq`) are appended, and `appendBatch` auto-selects the *second* batch's first candidate.
- **Root cause**: The Item steps still use CliProduce's synchronous path (no step passes `minDispatchMs`), so the `if (dispatching) return` guard at line 53 remains dead — there is still zero double-dispatch protection. The store fix changed the failure mode from data loss to duplication; this is the new, introduced-by-fix behavior.
- **Impact**: History pollution ("2 re-rolls kept" from one intent, 8 duplicate icon tiles) and a silent selection change to the duplicate batch — confusing, though no longer destructive.
- **Fix sketch**: Apply the in-flight guard unconditionally in `dispatch()` (move the sync call behind `setDispatching(true)`/`finally`), or pass a small `minDispatchMs` (e.g. 300) from the three generative steps so the existing async guard and "Dispatching…" state engage.

## 3. Out-of-band economy values render off-chart: the OUTLIER diamond vanishes and budget bars bleed past their track
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/layout-lab/steps/ItemEconomy.tsx:31` (with `shared/ChartPanel.tsx:87,133`)
- **Scenario**: A hydrated or server-written Economy artifact carries `power` outside the hard-coded `X_DOMAIN [84,124]` (e.g. 150) or above `BARS_MAX` 130, or a negative `cost`. The scatter's accent point clamps **only** the y-top (`Math.min(c, Y_DOMAIN[1])`); x and y-bottom are unclamped, so `sx(150)` lands outside the SVG viewBox and is clipped invisible — the legend still promises "◆ this item". In the bars chart, `scale(150)` yields a `width: 115%` div that overflows its track (no `overflow: hidden`).
- **Root cause**: The view assumes produced values (always 102/143) instead of validating the persisted artifact against its fixed chart domains; the partial `Math.min` clamp shows the boundary was considered but only for one of four edges. This is distinct from the known NaN gate poisoning (2026-06-09 #2) — it bites with perfectly finite, merely extreme values, exactly the outliers the chart exists to show.
- **Impact**: Wrong results display: the more extreme the outlier, the more invisible it becomes — the user sees "Outlier · price/power 1.94×" text but an empty chart, or a highlight bar bleeding across the panel.
- **Fix sketch**: Clamp both axes when building `accentPoints` (`Math.min(Math.max(power, X_DOMAIN[0]), X_DOMAIN[1])`, same for y-bottom) and render an "off-scale" marker style at the edge; in `ChartPanel`'s bars/scatter, clamp scale output to the range (or set `overflow: hidden` on the bar track) so no caller can overflow.

## 4. CliProduce's "✓ written…" success banner survives Reset, contradicting the wiped store
- **Severity**: Low
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/layout-lab/steps/shared/CliProduce.tsx:49` (with `Baseline.tsx:183`)
- **Scenario**: The user produces a step (banner shows "✓ Saved to the pipeline store · feeds the UE item description."), then clicks **Reset** in the pipeline rail. `resetEntity` deletes every artifact, the acceptance flips back to `pending`, and the view panel reverts to "No brief yet" — but the Produce panel still shows the green success message, because the step component's key (`${entity.id}:${stepName}`) is unchanged and `result` is local `useState`.
- **Root cause**: Dispatch outcome is cached in component-local state with no subscription to (or invalidation by) the store artifact it describes; nothing remounts the component when the artifact it reported on is deleted (the same staleness occurs if server hydration replaces nothing but a future overwrite path changes data).
- **Impact**: Success theater after the fact: a screen simultaneously asserting "✓ written to the UE project + DB" and "No brief yet — run Produce", undermining trust in the acceptance gate the lab is meant to demonstrate.
- **Fix sketch**: Derive the banner from truth: clear `result` when the subscribed artifact becomes `undefined` (e.g. accept an optional `producedAt` prop and reset state when it goes null), or include the artifact's `at` in the component key so Reset remounts the Produce panel.

## 5. Batch timestamps display UTC as if it were local wall-clock time
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/layout-lab/steps/shared/CandidateGallery.tsx:67`
- **Scenario**: An artist in any non-UTC timezone (the team is UTC+2) generates a batch at 14:02 local; the gallery header shows "Batch 2 · latest 12:02" — `batch.at.slice(11, 19)` extracts the HH:MM:SS of the **UTC** ISO stamp with no timezone conversion or label.
- **Root cause**: The comment justifies the slice as "pure, TZ-stable", optimizing for render purity/test determinism, but the value is presented as a human wall-clock time. Purity concerns apply to `Date.now()` *creation*, not to formatting an already-persisted ISO string with `toLocaleTimeString`.
- **Impact**: Every batch appears stamped hours off; when comparing re-rolls made minutes apart across a DST boundary or with collaborators, the times mislead ("which batch did I just make?").
- **Fix sketch**: Format on render with `new Date(batch.at).toLocaleTimeString(undefined, { hour12: false })` (deterministic per environment, still pure given the same input), or keep the slice but suffix "UTC" so the label stops lying.

## UI findings

## 6. LabTextarea / LabInput remove the focus outline with no replacement — keyboard users lose their place in every Produce panel
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/layout-lab/steps/controls.tsx:22` (also `:29`)
- **Scenario**: Tabbing into the "Direction (your input)" textarea — present in all 13 Item steps via CliProduce — gives zero visual feedback: the field sets `outline: 'none'` and its resting border (`1px solid t.line`) never changes on focus. Keyboard users cannot tell whether their typing will land in the direction field or trigger the adjacent dispatch button.
- **Root cause**: Inline style objects can't express `:focus`, so the outline was suppressed without the compensating focus ring the rest of the app's native buttons get for free (WCAG 2.4.7 Focus Visible).
- **Impact**: Severe keyboard-navigation degradation on the single most-used input in the lab; affects every step's Produce panel app-wide.
- **Fix sketch**: Drop `outline: 'none'`, or add `onFocus`/`onBlur` handlers that swap `borderColor` to `t.ink` and add `boxShadow: 0 0 0 2px t.accentBg` — matching the CandidateGallery selection ring so focus language stays consistent.

## 7. CandidateGallery uses 13px type in five places, breaking the module's documented 14px floor
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/layout-lab/steps/shared/CandidateGallery.tsx:74` (also `:83,:90,:109,:113`)
- **Scenario**: The batch time, "view prompt" toggle, expanded prompt `pre`, candidate captions, and ✓ badge all render at `fontSize: 13`, while every sibling surface (StepFrame, CliProduce, controls, all Item steps) holds the explicit "All type is >= 14px (text-sm floor)" rule (StepFrame.tsx:30) — CliProduce's identical "view prompt" toggle and prompt `pre` are 14px, so the same control is two sizes on one screen.
- **Root cause**: The gallery was authored after the floor was established and hand-picked 13px for density instead of reusing the 14px mono pattern.
- **Impact**: Noticeable inconsistency between the two prompt-disclosure controls and reduced legibility of exactly the text the gallery exists to surface (the recoverable art direction/prompt) — captions are also the only place tri counts and look names appear.
- **Fix sketch**: Bump all five `fontSize: 13` to 14 (the ✓ badge can stay if its circle grows to 20px to match ItemGate's check chip); reuse CliProduce's prompt-`pre` style verbatim for the batch prompt block.

## 8. ItemVFX hand-rolls its GPU budget bar instead of using ChartPanel, and it overflows past 100% exactly when over budget
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/layout-lab/steps/ItemAnimAudio.tsx:70`
- **Scenario**: The VFX step renders `width: ${(cost / CAP) * 100}%` in a bare div pair — the very "hand-rolled budget bar" pattern ChartPanel's `bars` variant was built to replace (used one step earlier in ItemEconomy). With over-budget data (`cost > cap`, the state the acceptance gate exists to flag) the fill renders >100% and bleeds outside its track; with a corrupt `cap: 0` the width becomes Infinity%. It also gets no entrance motion, no `role="figure"`/aria label, and no label/value column alignment, unlike every other chart in the pipeline.
- **Root cause**: The budget bar predates (or skipped) the shared ChartPanel manifest; no clamping because the happy-path produce always writes 0.4/0.8.
- **Impact**: Visual inconsistency between adjacent steps, a broken layout precisely in the over-budget state users most need to read, and a chart invisible to assistive tech.
- **Fix sketch**: Replace with `<ChartPanel t={t} variant="bars" max={CAP} rows={[{ label: 'GPU', value: Math.min(cost, CAP), color: cost <= CAP ? t.ok : t.bad, highlight: true }]} ariaLabel="GPU frame budget" />`; clamp scale output inside ChartPanel so no caller can overflow (pairs with bug #3).

## 9. "view prompt" disclosure toggles expose no expanded state to assistive tech
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/layout-lab/steps/shared/CliProduce.tsx:90` (also `CandidateGallery.tsx:81`)
- **Scenario**: Both prompt-disclosure buttons (one per Produce panel, one per gallery batch) toggle a `<pre>` purely by label text ("view prompt" / "hide prompt"). A screen-reader user gets no `aria-expanded` announcement, no `aria-controls` relationship to the revealed prompt block, and the appearing content isn't focus-reachable context — they must re-scan the region to discover what changed.
- **Root cause**: The toggles were styled as text links rather than built on the disclosure pattern; the revealed `pre` has a test id but no element `id` to point `aria-controls` at.
- **Impact**: The "recover the winning art direction" loop — a headline feature of the gallery — is opaque to keyboard/AT users; with multiple batches, several identical "view prompt" buttons are indistinguishable.
- **Fix sketch**: Add `aria-expanded={showPrompt}` and `aria-controls={promptId}` to both buttons, give each `pre` that `id` (batch id makes it unique), and include the batch number in the gallery button's accessible name (`aria-label={`view prompt for batch ${n}`}`).

## 10. Acceptance banner labels power with a spurious "%" — "power 102%" is a score, not a percentage
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/layout-lab/steps/itemsSteps.ts:314`
- **Scenario**: The Economy acceptance detail renders `` `power ${power}% · price/power ${ratio.toFixed(2)}×` `` — but `power` is the absolute stat-budget score compared against `target` (the bars chart shows the same 102 unit-less, next to "Tier target 100"). Because the demo target happens to be 100, "102%" reads plausibly as percent-of-target; with any other tier target the label becomes actively wrong (power 55 vs target 50 would read "power 55%").
- **Root cause**: Unit copy was written against the coincidence `target === 100`; the genuine percentage (deviation from target) is already computed separately in `economyCopy`.
- **Impact**: Misleads the exact comprehension the plain-language acceptance work exists to provide, and contradicts the unit-less power shown in the adjacent charts.
- **Fix sketch**: Drop the `%` (`` `power ${power} / ${target}` ``) or show the real deviation (`` `power ${power} (${pct >= 0 ? '+' : ''}${pct}% vs tier)` ``), reusing the `pct` math from `economyCopy`.
