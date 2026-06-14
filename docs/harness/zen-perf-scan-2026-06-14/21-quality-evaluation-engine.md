# Quality Evaluation Engine — zen-perf scan
> Context: Quality Evaluator & Health / Quality Evaluation Engine
> Total: 5
> Severity: critical=0 high=2 medium=3 low=0

## 1. Deep-eval runs every module × pass strictly serially — no concurrency
- **Severity**: high
- **Lens**: performance
- **Category**: serial-async / throughput
- **File**: src/lib/evaluator/deep-eval-engine.ts:139
- **Scenario**: A full "Run Deep Eval" with the default module set. `getEvaluableModuleIds()` returns ~17 modules (MODULE_CONTEXTS keys), each with 4 default passes (+1 combat-trace for arpg-combat) → ~69 CLI calls. The outer `for (const moduleId …)` / inner `for (const pass …)` loops each `await fetch('/api/claude-terminal/query')` then `await collectStreamResponse(...)` one at a time (lines 142-204).
- **Root cause**: Wall-clock time is the *sum* of every pass's CLI latency. There is no batching, no per-pass parallelism, no concurrency cap — each Claude pass (often 30-120s) blocks the next. The engine is the slowest path in the whole evaluator module.
- **Impact**: A full scan takes minutes-to-tens-of-minutes of strictly sequential latency. The user stares at `ProgressPanel` the entire time, and a single slow pass stalls everything behind it.
- **Effort**: 5 · **Value**: 8
- **Fix sketch**: Run passes through a bounded-concurrency pool (e.g. 3-4 in flight) — flatten `moduleIds × passesFor(m)` into a work list, drive it with a `Promise`-pool/`p-limit`-style runner, still pushing into `allFindings` and updating `passStatuses` per completion. `emitProgress()` already tolerates out-of-order updates (it snapshots state). Keep `signal.aborted` checks at task entry. Even concurrency=3 roughly thirds the scan time.

## 2. `emitProgress` deep-clones passStatuses + spreads findings on every step
- **Severity**: high
- **Lens**: performance
- **Category**: allocation / re-render churn
- **File**: src/lib/evaluator/deep-eval-engine.ts:129
- **Scenario**: `emitProgress()` fires before/after every pass (~2× per step, ~140 calls for a full scan). Each call does `progress.findings = [...allFindings]` (line 131) AND `JSON.parse(JSON.stringify(passStatuses))` (line 132), then invokes `onProgress` → `setProgress` in DeepEvalResults, re-rendering the whole results tree + `ProgressPanel`.
- **Root cause**: `JSON.parse(JSON.stringify(...))` is the most expensive possible clone of the nested `Record<module, Record<pass, status>>` (~17×4 entries), recomputed from scratch each emit even though only one `[module][pass]` cell changed. The `[...allFindings]` spread copies a monotonically growing array every emit (O(steps × findings)).
- **Impact**: O(steps²)-ish allocation pressure and ~140 full React re-renders of a large component subtree during a scan, on top of the network waits. Visible as UI jank / GC churn while the scan runs.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Replace the deep clone with a shallow structural copy that only reclones the changed module row: `{ ...passStatuses, [m]: { ...passStatuses[m] } }`. Skip the `[...allFindings]` spread unless `findings.length` changed since last emit (track a counter), or pass the array by reference and let React's `useState` setter own the snapshot. Coalesce the pre-pass + post-pass emits into one.

## 3. combat-trace pass prints prose before JSON — parser can drop all its findings
- **Severity**: medium
- **Lens**: both
- **Category**: fragile-parsing / prompt-parser contract mismatch
- **File**: src/lib/evaluator/finding-collector.ts:84
- **Scenario**: The arpg-combat `combat-trace` pass prompt explicitly says "Output the numbered call graph first, then the JSON findings array" (module-eval-prompts.ts:159), while the shared `FINDING_SCHEMA` for all other passes says "Output ONLY the JSON array" (module-eval-prompts.ts:42). `parseFindings` locates the array with `indexOf('[')` … `lastIndexOf(']')` then a single `JSON.parse` of that slice.
- **Root cause**: The parser assumes the *first* `[` and *last* `]` bound the findings array. The combat-trace call graph is free prose emitted first; if it contains any bracket (e.g. an array literal, `TSet<...>`-style notes, a markdown list rendered with `[ ]`, or a stray `]`), `arrayStart`/`arrayEnd` straddle non-JSON text and `JSON.parse` throws → the `catch` returns `[]` (line 95-96). The richest, most expensive pass then silently contributes zero findings.
- **Impact**: Combat-trace findings vanish with no error surfaced; the module looks "clean" for its most important check, and (because the pass still completes 'done') it is *not* in `failedModules`, so the false-clean result feeds the regression baseline.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Make the contract robust: either (a) require every pass — combat-trace included — to wrap findings in a sentinel block (e.g. ```json … ``` fence or `<findings>…</findings>`) and parse that span, or (b) in `parseFindings`, scan for balanced-bracket JSON candidates from each `[` and accept the first that `JSON.parse`s as an array, instead of a single first-to-last slice. Add a unit test feeding "prose with brackets + trailing JSON array."

## 4. Within-scan dedup collapses distinct findings sharing file+line+80-char prefix
- **Severity**: medium
- **Lens**: architecture
- **Category**: lossy-dedup
- **File**: src/lib/evaluator/finding-collector.ts:163
- **Scenario**: `deduplicateFindings` fingerprints with `includeLine: true`, where the description key is the lowercased, punctuation-stripped, **first-80-character** prefix (fingerprintFinding, lines 141-145). Two genuinely different issues reported on the same file+line whose descriptions share an 80-char lead-in (common for templated phrasings like "In NativeUpdateAnimation, the call to GetOwner()… <differs after 80 chars>") collapse to one, keeping only the higher severity (lines 167-171).
- **Root cause**: An 80-char prefix is a coarse identity key, and the multi-pass design intentionally re-examines the same file from structure/quality/performance angles — collisions on the same line are likely, not rare. The "keep higher severity, discard the rest" rule then drops the other real finding entirely.
- **Impact**: Legitimate findings disappear from results and from the persisted baseline; the user never sees them and they can't be tagged NEW on the next scan. Silent under-reporting in exactly the multi-pass scenario the engine exists for.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Only merge when descriptions are truly equal/near-equal (full normalized string, or a similarity ratio) rather than an 80-char prefix; OR include `category`/`pass` in the within-scan fingerprint so cross-pass observations on the same line stay distinct. Keep the line-less variant for cross-scan regression matching as-is.

## 5. AggregateQualityDashboard re-mounts + per-cell stagger animates the whole heatmap on every refresh
- **Severity**: medium
- **Lens**: performance
- **Category**: render / animation cost
- **File**: src/components/modules/evaluator/AggregateQualityDashboard.tsx:333
- **Scenario**: Each heatmap cell is a `motion.button` with `initial={{opacity:0,scale:0.95}}` and `transition={{ delay: i * 0.03 }}` over `ALL_MODULE_IDS` (~17+ cells). Because `cells` is rebuilt from `aggregates` (useMemo) and the manual "Refresh" button (line 308) calls `fetchData` which flips `isLoading` true→false, the dashboard unmounts to a spinner (lines 193-199) and remounts the entire grid, replaying the full staggered fade-in every refresh.
- **Root cause**: Entry animation is keyed to mount, and the loading guard forces a remount on every fetch; the per-index delay turns a data refresh into a ~0.5s+ cascading re-animation of all cells plus each cell's `Sparkline` SVG.
- **Impact**: Every refresh (and every navigation back to the Quality tab) pays a full staggered animation + SVG re-render of all module cells — wasted main-thread work and a sluggish "why is it fading in again" feel.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Don't blank to the spinner on refetch — gate the full-screen loader on `isLoading && aggregates.length === 0` (first load only) and keep the grid mounted during refreshes. Drop or cap the `delay: i * 0.03` (e.g. `Math.min(i, 8) * 0.03`), or animate once via a stable `layout`/`AnimatePresence` key so a data update doesn't replay the entrance.
