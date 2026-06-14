# Character & Genome Designer — zen-perf scan
> Context: Character & Combat Authoring / Character & Genome Designer
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. `optimize()` brute-forces an O(n²) simplex when the objective is linear (answer is always a vertex)
- **Severity**: high
- **Lens**: performance
- **Category**: algorithmic-complexity
- **File**: src/components/modules/core-engine/sub_character/attributes/data.ts:105
- **Scenario**: Every time the user changes level, target preset, or a custom weight slider, `optimalAlloc` recomputes via `optimize(totalAvailable, level, activeWeights)` inside a `useMemo` (AttributePointOptimizer.tsx:47). At the default level 50, `totalAvailable = 49 * 3 = 147`, so the nested `for s … for d` loop runs ~`147²/2 ≈ 10,878` iterations, each calling `calcStats` + `objectiveScore`. Dragging a weight slider fires this on every input event.
- **Root cause**: `objectiveScore` (data.ts:97) is a strictly linear combination of `effectiveDPS`, `effectiveHP`, `manaPool`, and each of those is linear in `str`/`dex`/`int` (data.ts:84-94 — `attackPower` linear in str, `critChance` linear in dex up to the `Math.min(…,1)` clamp, `maxMana` linear in int). Maximising a linear function over the simplex `s+d+i = totalPoints, all ≥ 0` always lands on a vertex, i.e. dump all points into one attribute (or split at the crit clamp boundary). The exhaustive grid is computing what is provably a corner solution.
- **Impact**: ~11k iterations of trig-free but non-trivial arithmetic on the React render path per slider tick; janky weight sliders, wasted CPU, and it scales quadratically if `maxLevel`/`attributePointsPerLevel` ever grow.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Replace the double loop with evaluating the ≤3 pure-corner allocations (`{all str}`, `{all dex}`, `{all int}`) plus, if you want to respect the `critChance` clamp kink, the dex value that first hits crit cap; pick the max by `objectiveScore`. O(1). Keep `optimize`'s signature so callers are unchanged. Add a unit test asserting the new result matches the old grid output across the presets.

## 2. Entire genome-editor + attribute-optimizer vertical slice is orphaned (never imported)
- **Severity**: high
- **Lens**: architecture
- **Category**: dead-code
- **File**: src/components/modules/core-engine/sub_character/genome/CharacterGenomeEditor.tsx:36
- **Scenario**: `CharacterGenomeEditor` (178 lines, the headline component of this context) is exported but a full-tree grep finds zero importers — only its own definition line matches. Same for `AttributePointOptimizer` (attributes/AttributePointOptimizer.tsx:25): no import anywhere in `src`. The live `sub_character/index.tsx` wires its tabs to a different set of components (`OverviewTab`, `InputTab`, `MovementTab`, `SimulatorTab`, `CharacterFeelPlayground`, `CharacterFeelOptimizer`, `CharacterSourceWizard`) — none of which is the genome editor or the optimizer.
- **Root cause**: The genome-editor slice (editor + `ProfileSection`, `GenomeHeaderPanel`, `LevelScaledPowerCurve`, `GenomeComparisonTable`, `LiveSimDashboard`, `CheckpointTimeline`, etc.) and the attribute optimizer were built as standalone tabs but never wired into the `SUBTABS`/`index.tsx` navigation, or were unwired in a refactor without removing the code. The `genomeStore`, `field-data.ts`, `sim-engine.ts`, and `validation.ts` are reachable only through these orphaned roots.
- **Impact**: Large dead subtree ships in the bundle, drags TS/lint/test surface, and misleads every future reader (and this audit) into maintaining code no user can reach. The careful WeakMap caching in sim-engine and the memoization in the editor protect a screen that never renders.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Confirm against product intent. If the genome designer is meant to ship, add it to `SUBTABS`/`index.tsx` and render `<CharacterGenomeEditor />` (and `AttributePointOptimizer` under an `attributes` tab). If not, delete the orphaned roots and any files reachable only through them (verify `genomeStore`, `field-data`, `sim-engine`, `validation`, `useGenomeHistory` have no other live consumers first — `build-code.ts` and `genome-diff.ts` DO have live consumers via `BuildCodeExport`/`GenomeImportPanel`/`CheckpointTimeline`, so keep those).

## 3. `useGenomeHistory` hook is dead code superseded by the store's checkpoint system
- **Severity**: medium
- **Lens**: architecture
- **Category**: dead-code
- **File**: src/hooks/useGenomeHistory.ts:28
- **Scenario**: This 117-line undo/redo hook (debounced snapshot stack, capped at 50) is exported but the only references in the tree are its own definition and a prose mention in `types/genome-checkpoint.ts:3`. No component calls it. Undo-like functionality is actually provided by the store's named `checkpoints` (genomeStore.ts:145-193: create/rename/delete/restore), a different mechanism.
- **Root cause**: An earlier local-state history approach was replaced by persisted store checkpoints; the hook was left behind. Its `initial: () => CharacterGenome[]` signature also predates the move to a shared Zustand store (the editor now reads `genomes` from the store, not local state), so the hook is structurally incompatible with the current data flow.
- **Impact**: Misleading "we have undo/redo" signal; carries an `useEffect` cleanup, `queueMicrotask` flag dance, and a full snapshot stack that allocates `CharacterGenome[][]` copies — none of it exercised. Confuses the mental model of how history works (hook vs. checkpoints).
- **Effort**: 1 · **Value**: 5
- **Fix sketch**: Delete `src/hooks/useGenomeHistory.ts` and drop the stale reference in the `genome-checkpoint.ts` doc comment. If snapshot-based undo is still desired alongside named checkpoints, that's a feature decision — but the current orphaned implementation should not linger.

## 4. `GenomeComparisonTable` recomputes `Math.max(...values)` per stat row and per cell with no memoization
- **Severity**: medium
- **Lens**: performance
- **Category**: react-render / recomputation
- **File**: src/components/modules/core-engine/sub_character/genome/GenomeComparisonTable.tsx:30
- **Scenario**: For each of the 14 `COMP_STATS` rows the component maps all genomes to `values`, then computes `Math.max(...values)` (bestVal) and a second `Math.max(...values)` (maxVal) — two spreads-as-args reductions per row. Then the inner `genomes.map` recomputes `barPct`, `isBest`, `isActive` per cell. With the comparison feature allowing up to all genomes as columns, this is `O(rows × genomes)` work redone on every render of the parent editor, which re-renders on every keystroke/slider drag (the editor holds `codePreview` state and rebuilds `radarOverlays`, `warningsByProfile`, etc.).
- **Root cause**: The whole table body is computed inline in JSX with no `useMemo`; the `memo()` wrapper (line 77) only helps when props are referentially stable, but `genomes` is a fresh array reference on many store updates and `activeId` changes frequently. `bestVal`/`maxVal` are also computed twice (they're identical when `higherIsBetter`).
- **Impact**: Redundant per-render numeric passes over the full genome set; on a heavy compare set this is visible jank while editing. Low absolute cost today (small N) but pure waste and trivially avoidable.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Precompute a `useMemo` keyed on `[genomes]` that yields, per stat row, `{ values, bestVal, maxVal }` in a single pass (track min/max while mapping). Render from that. Collapse the duplicate `Math.max` and reuse `maxVal` for the `higherIsBetter` case. Keeps the `memo()` wrapper meaningful.

## 5. `findPowerCurveCrossovers` is O(g²) and silently uses a linear-crossover formula on the non-linear `power` stat
- **Severity**: low
- **Lens**: both
- **Category**: correctness / complexity
- **File**: src/components/modules/core-engine/sub_character/genome/sim-engine.ts:49
- **Scenario**: Called from `LevelScaledPowerCurve.tsx:47` in a `useMemo` over `[genomes, selectedStat]`. For every genome pair it solves a single linear-intersection equation `crossL = (v1a - v1b)/(rateB - rateA) + 1` using only the level-1 and level-100 endpoints. For `hp`/`armor`/`stamina`/`mana` the curves are linear so this is exact; but for `stat === 'power'` (sim-engine.ts:14-20) the value is `hp + armor*factor + stamina + mana` — still linear per term, so it remains linear overall *here* — yet the formula assumes a single crossing and reports `value: getScaledStat(a, stat, crossL)` using only curve A, which is only correct because both are linear. Any future non-linear term (e.g. armor diminishing returns) would make both the single-root assumption and the "evaluate on A" reporting wrong with no guard.
- **Root cause**: A two-point linear-extrapolation crossover baked into a function that takes an arbitrary `PowerCurveStat`, coupling the algorithm's correctness to an invariant (all stats linear in level) that lives in a different file and isn't asserted. The O(g²) pair loop is fine at today's genome counts but is recomputed wholesale on each stat-tab switch.
- **Impact**: Latent correctness trap if any stat becomes non-linear; minor redundant pairwise work. Today it produces correct numbers, hence low severity.
- **Effort**: 2 · **Value**: 3
- **Fix sketch**: Either document the "all power-curve stats are affine in level" invariant at the function head and add a test, or compute crossovers from the already-cached `getStatCurve` arrays (scan adjacent samples for sign change of the difference) so it stays correct regardless of curve shape — that also reuses the WeakMap-cached curves instead of recomputing endpoints.
