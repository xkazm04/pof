# Combat & Damage Tuning — zen-perf scan
> Context: Character & Combat Authoring / Combat & Damage Tuning
> Total: 5
> Severity: critical=0 high=3 medium=2 low=0

## 1. Damage formula + fight loop triplicated across three engines (and they disagree)
- **Severity**: high
- **Lens**: both
- **Category**: duplication / SRP / correctness drift
- **File**: src/lib/combat/simulation-engine.ts:42 · src/lib/combat/predictive-balance.ts:79 · src/lib/combat/choreography-sim.ts:81
- **Scenario**: Any tuning change to the GAS damage model (crit, armor curve, mana regen, ability-selection priority) must be hand-applied in three places; designers comparing the Monte-Carlo result, the predictive heatmap, and the choreography timeline see numbers that won't reconcile.
- **Root cause**: `calculateDamage` (simulation-engine.ts:42), `calcDamage` (predictive-balance.ts:79), and the inline enemy/player damage in `simulateEncounter` (choreography-sim.ts:171/232) are three independent copies of the same formula, and each owns its own tick loop and ability-AI. They have already drifted: the main engine rounds with `Math.max(1, Math.round(...))` (sim-engine:64) while the predictive copy uses `Math.max(0, ...)` un-rounded (predictive:91); the main engine selects AoE by `ability.aoeRadius > 0` (sim-engine:222) while predictive keys off `ab.type === 'aoe'` (predictive:138) — so Fireball/Dash-Strike (aoeRadius>0 but type≠'aoe') hit all enemies in one engine and one target in the other. `buildPlayerAttributes` also differs: the main engine does NOT scale `attackPower` by `playerDamageMul` (applies it per-hit instead) but predictive multiplies `attrs.attackPower *= playerDamageMul` (predictive:60), double-counting relative to the main engine.
- **Impact**: Silent balance divergence between the three views designers trust; every formula edit is a 3x change with a high omission risk. This is the core maintainability liability of the context.
- **Effort**: 6 · **Value**: 8
- **Fix sketch**: Extract one shared `damageFormula(ability, src, tgt, tuning, rng, isPlayer)` (the sim-engine version is canonical) and one `tickFight` primitive parameterized by output collectors (full FightResult vs. lightweight QuickFightResult vs. event log). Have all three callers consume it. Reconcile the AoE predicate and attackPower-scaling location as part of the merge, with a test asserting identical single-fight output for a fixed seed.

## 2. `computeSummary` makes ~12 full passes over the fights array + redundant re-sorts
- **Severity**: high
- **Lens**: performance
- **Category**: O(n) pass multiplication / redundant sort
- **File**: src/lib/combat/simulation-engine.ts:493
- **Scenario**: Every run with the max 5000 iterations (UI/`NumberField` allows up to 5000, API clamps to 5000) calls this once; it also runs twice per `runFeedbackComparison` (sim-engine:857/861) and twice per A/B candidate. Each call walks the 5000-element `fights` array roughly a dozen times.
- **Root cause**: Lines 499–518 do `fights.filter` (wins), three separate `fights.map` (durations/dmgDealt/dmgTaken), then independent `.reduce` passes for avgDuration, totalCrits, totalHits, avgDamageDealt, avgDamageTaken, avgPlayerHealthRemaining, avgDPS, avgEnemyDPS, plus `fights.filter(f => f.oneShot)` (line 536) and per-ability `fights.reduce` inside a loop (lines 506–509, i.e. abilities × n). `buildBuckets` (line 706) then does `[...values].sort()` on `dmgDealt` and `dmgTaken` which were never sorted — fine — but `durations` is sorted at line 500 and `buildBuckets(durations,8)` re-sorts the already-sorted array again (line 514). The `abilityHeatmap` loop is O(abilities × fights) when it could be O(fights) with a single tally pass.
- **Impact**: ~12+ array traversals + 3 sorts (one redundant) over up to 5000 objects, multiplied by 2–4 for comparison/feedback flows. Pure wasted CPU on the request path that `runCombatSimulationBatched` is explicitly trying to keep non-blocking.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Single accumulation loop over `fights` collecting sums, counts, win count, oneShot count, per-ability tally (Map), and pushing duration/dmgDealt/dmgTaken into pre-sized arrays. Sort each distribution array once and pass a `presorted` flag to `buildBuckets` (or inline bucketing into the same pass via min/max known after one scan). Drop the redundant re-sort of `durations`.

## 3. Per-action array allocation inside the simulation tick loop
- **Severity**: high
- **Lens**: performance
- **Category**: hot-loop allocation churn
- **File**: src/lib/combat/simulation-engine.ts:205
- **Scenario**: A 120s fight at dt=0.1 is up to 1200 ticks; 5000 iterations × multiple allocations/tick = millions of throwaway arrays per run, all feeding GC pressure during the very loop the batched runner is trying to keep the event loop responsive through.
- **Root cause**: Inside `while (time < ...)` the player branch does `enemies.filter((e) => e.attrs.health > 0)` (line 205) on every player action, and `damageAbilities` is rebuilt with `.filter(...).sort(...)` on every action in `choosePlayerAbility` (sim-engine:374–379). The end-of-tick check `enemies.every(...)` (line 311) and `updateBuffs` calling `entity.buffs.filter(...)` (sim-engine:394) each tick add more. The predictive engine has the same pattern: `enemies.map(...).filter(...)` twice per tick (predictive:125 and 163) plus an inner ability scan. None of these allocations are needed — counts and a reusable scratch index list suffice.
- **Impact**: Millions of short-lived arrays/closures per max run; measurable GC overhead and slower sims, directly counter to the "don't block the Node process" goal in the engine's own comments.
- **Effort**: 4 · **Value**: 6
- **Fix sketch**: Track `aliveCount` incrementally (decrement when an enemy's health crosses ≤0) instead of re-filtering; iterate `enemies` in place skipping dead ones. Precompute the damage-ability list once per fight (abilities don't change), and only re-rank when needed. Skip `updateBuffs` filtering when `buffs.length === 0` (common case).

## 4. `getEffectiveAttrs` is a dead no-op indirection; `buildHistogram`/`buildBuckets` are duplicate logic
- **Severity**: medium
- **Lens**: architecture
- **Category**: dead code / duplication
- **File**: src/lib/combat/simulation-engine.ts:403 · src/lib/combat/histogram.ts:17
- **Scenario**: Reader/maintainer overhead — `getEffectiveAttrs(player)` (called at sim-engine:225/269) looks like it resolves buffs but is literally `return entity.attrs;` with a "Buffs already applied in-place" comment, so it conveys intent it doesn't implement. Separately, two equal-width bucketing routines exist with cosmetic field-name differences.
- **Root cause**: `getEffectiveAttrs` (line 403) is an identity function left from a refactor that moved buff application in-place. `buildBuckets` (sim-engine:706, fields `{min,max,count}`) and `buildHistogram` (histogram.ts:17, fields `{low,high,count}`) implement the identical sort→range→fixed-width→tally algorithm; only the bin field names differ, and `CountBucket` in histogram.ts already matches `buildBuckets`'s output shape.
- **Impact**: Two cheap abstractions to remove; reduces surface area and a misleading helper. Low risk.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: Inline `getEffectiveAttrs(x)` → `x` (or delete and pass `entity.attrs` directly). Make `buildBuckets` delegate to `buildHistogram` with a thin field-rename adapter (or standardize on one bin shape), keeping the single histogram implementation in `histogram.ts`.

## 5. Non-streaming POST builds the full fights array then trims, defeating the payload guard
- **Severity**: medium
- **Lens**: both
- **Category**: payload bloat / memory
- **File**: src/app/api/combat-simulator/route.ts:78
- **Scenario**: A 5000-iteration non-streaming run allocates and holds all 5000 `FightResult` objects (each with an `abilitiesUsed` record and `damageBySource` array) in `result.fights`, then `trim()` slices to 100 only when serializing the response (route.ts:78/117). The summary/threat aggregation only ever needs the full array transiently.
- **Root cause**: `runCombatSimulationBatched` accumulates every fight into one array (sim-engine:467–474) and returns it whole; the route trims at the boundary. So peak memory is "all fights" even though the client receives ≤100 and the summary is already aggregated. `damageBySource` per fight (a `Map`→array, sim-engine:334) and `abilitiesUsed` add per-fight allocation that is discarded.
- **Impact**: Up to 5000 rich objects retained per concurrent run; under parallel requests this multiplies. The trim is a band-aid that runs after the cost is already paid.
- **Effort**: 5 · **Value**: 4
- **Fix sketch**: Have the runner accept an `onFight` callback (or `keepFights` cap) so summary/threat aggregation folds each fight incrementally and only the first N fights are retained for the response — peak memory becomes O(N_kept + accumulators) instead of O(iterations). Streaming path already aggregates at the end, so the same incremental fold benefits both.
