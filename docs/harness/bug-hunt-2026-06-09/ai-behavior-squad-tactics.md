# Bug Hunt — AI Behavior & Squad Tactics
> Total: 4
> Severity: 0 critical, 1 high, 3 medium, 0 low

Context slug: `ai-behavior-squad-tactics`. Scope = the 13 files listed in `_contexts.json` plus the shared helpers they pull in (`eqs-geometry.ts`, `seeded-rng.ts`, `eqs-defaults.ts`, `useDragAngle.ts`, `polar-layout.ts`, `arc-helpers.ts`, `useBlueprintTranspiler.ts`, `useAITesting.ts`). The squad engine and its validation layer are genuinely well-defended (typed `Result`, finite-guards, divide-by-zero guard on `minSeparation`), so the real bugs cluster in the visualizer/scaffold UIs where state and scale assumptions are weaker.

## 1. Stale transpile result shown (and copied) when re-scan parse fails
- **Severity**: high
- **Category**: state-corruption
- **File**: src/components/modules/game-systems/multiplayer/ReplicationScaffoldPanel.tsx:45-68 (root in src/hooks/useBlueprintTranspiler.ts:43-82)
- **Scenario**: User scans Blueprint A successfully (the panel now renders A's replicated fields and a Copy-able `GetLifetimeReplicatedProps()` body). They paste Blueprint B (or edit A into malformed JSON) and click "Scan Replication". `handleScan` does `await parse(blueprintJson)` then `await transpile(...)`. `parse` throws because B is invalid JSON / the API returns `success:false` (`apiFetch` throws on `!json.success`, api-utils.ts:78). `transpile` never runs.
- **Root cause**: The result gate `replication && !isLoading` (line 128) reads `transpileResult`, but `parse`'s failure path only calls `setError` — it never clears `transpileResult`/`asset`. So after the throw, `isLoading` is reset to `false` in the `finally`, `error` is set, yet `transpileResult` still holds Blueprint A. The component assumes "an error means no stale success is visible," which is false because parse and transpile are two independent state writers and only one failed. Compounding it, `onClick={handleScan}` never catches the rejection, so the throw also becomes an unhandled promise rejection.
- **Impact**: corruption / UX degradation — the panel displays Blueprint A's replicated field list AND its `OnRep_`/`DOREPLIFETIME` boilerplate underneath a red error banner for Blueprint B. The user can hit "Copy" and paste replication code for the **wrong class** into their UE5 project, where it silently compiles against A's properties.
- **Fix sketch**: Make the scan atomic and self-clearing: wrap `handleScan` in try/catch, and on entry (or in the hook's `parse`/`transpile` catch blocks) reset `transpileResult`/`asset`/`summary` to `null` before/at failure so a failed scan can never leave a previous success on screen. Better: collapse parse+transpile into one request, or gate rendering on a single per-scan token so output is only shown when it belongs to the latest input.

## 2. Attack ring overflows the SVG viewport above 300 UU (scale fixed to 300, slider allows 500)
- **Severity**: medium
- **Category**: logic-error
- **File**: src/components/modules/game-systems/AttackRingVisualizer.tsx:44-45 (slider bound at line 294)
- **Scenario**: User drags the `AttackDistance` slider past ~300 (it allows up to 500). The ring circle and every ring point render partially or fully outside the `<svg>` box.
- **Root cause**: `scale = MAX_DRAW_RADIUS / 300` hard-codes the assumption "max attack distance is 300 UU" (`// 300 units fits at max radius`). But `MAX_DRAW_RADIUS` is `(340 − 50·2)/2 = 120`, so `scale = 0.4`, and the distance slider's `max` is `500`. At 500 UU, `outerR = 500·0.4 = 200`, while the drawable radius is only 120 and the half-viewBox is 170. Points at `SVG_CENTER ± outerR = 170 ± 200` land at −30…370, outside the 0…340 viewBox. The scale denominator (300) and the slider max (500) were chosen independently and never reconciled.
- **Impact**: UX degradation — at common "ranged/support" distances (>300) the ring, its points, and the distance label clip out of the diagram, making the visualizer look broken exactly when showing the more interesting large-radius case.
- **Fix sketch**: Derive the scale from the actual maximum the control can produce, not a magic constant: `const scale = MAX_DRAW_RADIUS / SLIDER_MAX_DISTANCE` (or recompute per-render against `Math.max(attackDist, ...)`). Centralize "slider max" and "scale basis" in one constant so the class of "control allows more than the canvas was scaled for" cannot recur.

## 3. "Best position" silently falls back to point[0] (an exposed point) when a score mode is all-zero
- **Severity**: medium
- **Category**: logic-error
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis.tsx:208-211 (and the "Best Positions" list at 735-772)
- **Scenario**: User switches "Score by" to **Elevation**. Only 2 of 7 mock obstacles are elevation, and they sit at specific offsets; the generated ring points (radii 300–1200) mostly get `elevationScore = 0`. The `reduce` that picks `bestPoint` finds no point with `getScore(p) > getScore(best)`, so it returns its seed, `points[0]`.
- **Root cause**: `points.reduce((best, p) => getScore(p) > getScore(best) ? p : best, points[0])` treats `points[0]` as a valid "best" even when every score ties (commonly at 0). Strict `>` plus a non-sentinel seed means "no point actually wins" is indistinguishable from "point[0] wins." The glow ring, the `%` label, and the top-5 "Best Positions" list then present an arbitrary, possibly fully-exposed point as the recommended tactical position.
- **Impact**: corruption of the surfaced recommendation / UX degradation — the tool confidently highlights a 0%-elevation (exposed) point as "best cover," which is the opposite of the analysis's purpose. No crash, but the headline output is wrong.
- **Fix sketch**: Detect the degenerate case: if `getScore(bestPoint) <= 0` (or all scores equal), render an explicit "no advantaged position in this mode" empty state instead of a highlighted point. Generally, seed reductions with a sentinel (`-Infinity` + "found any?" flag) so "nothing qualifies" is a distinct, surfaced state rather than silently aliasing to the first element.

## 4. Heatmap "closest point" uses JS modulo on negative angle deltas → wrong coloring across the 0°/360° seam
- **Severity**: medium
- **Category**: edge-case
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis.tsx:232-240
- **Scenario**: For each of the 72 heatmap arc segments the code finds the nearest sample point by angular distance. For arc segments near angle 0 (and points whose `angle` is near 2π), the wrapped difference goes negative and the "closest" comparison picks the wrong point, miscoloring the seam region of the coverage ring.
- **Root cause**: `Math.abs(((p.angle - midAngle + Math.PI) % (2*Math.PI)) - Math.PI)` relies on `%` returning a value in `[0, 2π)`. JavaScript's `%` is a *remainder*, not a modulo: it preserves the sign of the dividend. When `p.angle - midAngle < -π`, the expression `(p.angle - midAngle + π)` is negative, `% 2π` stays negative, and subtracting π yields values down to ≈ −2π, so `Math.abs` returns up to ~2π instead of the true minimal angular gap (≤ π). The intended canonical-angle-difference formula assumed a non-negative modulo.
- **Impact**: UX degradation — incorrect/asymmetric heatmap arc colors near the 0°/360° boundary (the faint annular coverage tint), making the cover quality readout subtly misleading. Same `%`-on-negative pattern is the kind of bug that bites harder anywhere this "wrap to [0,2π)" idiom is reused.
- **Fix sketch**: Use a sign-safe wrap, e.g. `const d = Math.abs(p.angle - midAngle) % (2*Math.PI); const gap = Math.min(d, 2*Math.PI - d);` (always in `[0, π]`), or `((x % m) + m) % m` to force a true non-negative modulo. Extract it as a shared `angularDistance(a, b)` helper so every polar visualizer wraps angles identically.
