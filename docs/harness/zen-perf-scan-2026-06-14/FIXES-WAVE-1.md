# Zen-Perf Fix Wave 1 — Dead Code Purge + Dormant-Feature Activation

> 8 atomic commits, 8 findings closed. 43 files changed (+138 / −5,023; net −4,885 LOC).
> Baseline preserved: tsc 0→0 errors; test suite 3946 passing (15 catalog/ueStaticCheckers
> failures are pre-existing on master, unrelated); 0 new lint errors.

The wave split into two halves: **purge** (delete confirmed-dead code) and **activate**
(wire three half-built features the user chose to keep rather than cut).

## Commits

| # | Commit | Finding | Type | Files |
|---|---|---|---|---|
| 1 | `cf00520` | #52 (ctx 31) | purge + fix | gas-codegen.ts, sub_ability/blueprint/codegen.ts |
| 2 | `df909b4` | #50 (ctx 26) | purge | feature-definitions.ts, feature-definitions.test.ts |
| 3 | `2443a04` | #3 (ctx 03) | purge | useGenomeHistory.ts (del), genome-checkpoint.ts |
| 4 | `f27cd8f` | #46 (ctx 03) | purge | 28 files (genome slice) |
| 5 | `fe7e2ff` | #51 (ctx 30) | purge | UE5RemoteController, LiveCodingPanel, useLiveCoding (del) |
| 6 | `9794155` | #47 + #5 (ctx 13) | activate | blenderMCPStore.ts, BlenderConnectionBar.tsx |
| 7 | `b0e397b` | #48 (ctx 18) | activate | analysis-engine.ts, crashAnalyzerStore.ts |
| 8 | `0308037` | #49 (ctx 23) | activate | execute/route.ts, build-history-store.ts |

## What was fixed

### Purge (5 commits, ~4,900 LOC removed)
1. **Dead `generateEffectsCode` duplicate (#52).** The GAS editor imports `generateEffectsCode` from its local `sub_ability/blueprint/codegen.ts`; the copy in `@/lib/gas-codegen` had zero importers. The two had drifted — the live copy emitted a `// Period: <n>s` header line that contradicted its own warning that emitting cooldown as Period turns the effect into a repeating DoT tick. Deleted the dead canonical copy; replaced the live `// Period:` line with an accurate `// Cooldown:` line. (Bug fix bundled with the dedup.)
2. **Dead transitive-chain BFS (#50).** `DependencyInfo.chain` was filled by an O(V·E) BFS on every `buildDependencyMap()` call but read in exactly one place — a test asserting it was non-empty. Removed the field + BFS pass, repointed the test to assert on direct deps.
3. **Dead `useGenomeHistory` hook (#3).** 117-line undo/redo hook with zero callers, superseded by the store's named-checkpoint system and structurally incompatible with the shared Zustand store. Deleted + cleaned the stale doc reference.
4. **Orphaned Character Genome Designer slice (#46).** `CharacterGenomeEditor` + `AttributePointOptimizer` (the headline components of the genome context) had zero importers. Removed the two roots + every file reachable only through them (28 files: genome/ subcomponents, attributes/ panels, field-data/sim-engine/validation, 3 dedicated tests). Kept everything with a live consumer (`genomeStore`, `_genome-share/*`, all `lib/genome/*`).
5. **Never-mounted UE5 panels (#51).** `UE5RemoteController` + `LiveCodingPanel` (~1,360 LOC) were never imported anywhere; `LiveCodingPanel` was the sole consumer of `useLiveCoding`, so that hook + its polling went too.

### Activate (3 commits — dormant features the user chose to wire, not cut)
6. **Blender connection health-check (#47, also resolves #5).** `UI_TIMEOUTS.blenderHealthCheck` (15s) and the store's `refreshStatus()` both existed but were wired to nothing, so a silently-dropped socket left the UI green and the auto-retry loop never armed. Added a store-managed health-check interval (mirroring the existing `retryTimer` pattern) armed on connect, cleared on disconnect/unmount; `refreshStatus` now flips `connected→false` on a probe miss and schedules a reconnect when `autoConnect` is set.
7. **Crash-import recompute (#48).** `importCrashLog` appended the imported crash but never recomputed `patterns`/`stats`, so the severity pills and pattern list stayed frozen on the 8 baked-in samples. Now recomputes `detectPatterns([...reports])` then `computeStats(reports, patterns)` and sets both. `detectPatterns`/`computeStats` exported as-is (no logic change); diagnosis behavior unchanged (imported crashes legitimately have no sample diagnosis — no fabrication).
8. **Size-budget gate on interactive cooks (#49).** `evaluateBuildSize` ran only in the nightly scheduler; operator cooks recorded bloated builds silently. The execute route now evaluates the same gate. **Caught + fixed a self-comparison bug in the subagent's first pass:** the baseline lookup must run *before* `insertBuild` (matching the scheduled runner, scheduled-build-runner.ts:124-134) or the just-recorded green row becomes its own baseline and the gate never fires. Added shared `lastGreenSizeBytes`/`updateBuildNotes` helpers to avoid a duplicate code path; emits a final `{type:'size-regression'}` SSE event. Passing builds are unchanged.

## Verification (before / after)

| Gate | Before (master) | After (wave) |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| Test suite | 15 fail / 3946 pass (catalog ueStaticCheckers, pre-existing) | 15 fail / 3946 pass (same set; 3 deleted genome test files were for deleted components) |
| ESLint (changed files) | — | 0 errors (1 pre-existing `sig` unused warning in detectPatterns) |
| LOC | — | −4,885 net |

## Cumulative status (across all waves so far)

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |

Total findings in scan: 176 (0 critical, 67 high, 82 medium, 27 low). Closed so far: 8 (incl. the linked #5). Remaining: ~168.

## Patterns established (catalogue, items 1–5)

1. **Orphaned vertical slice** — a feature's "headline" component can be fully built (store, sim engine, sub-components, tests) yet never wired into the live tab/route registry. Grep the root component for importers; if zero, the whole transitive subtree below it is dead. Delete iteratively (a file is deletable only if every importer is also being deleted), keeping anything a live sibling imports.
2. **Diverged duplicate where the *dead* copy is the documented one** — two implementations of the same function; the one carrying the authoritative doc-comment can be the dead (zero-importer) copy, while the live copy has silently drifted (and acquired a bug). Always grep importers before trusting "canonical."
3. **Dormant feature = defined-but-unwired trio** — a config constant (`blenderHealthCheck`), a store action (`refreshStatus`), and the loop that should connect them all exist separately but nothing wires them together. The fix is to connect, not delete (when the capability is wanted). Look for constants/actions with zero call sites.
4. **Append-without-recompute** — a store mutation appends to a list but forgets to recompute derived state (patterns/stats) over the new list, so dashboards silently freeze. Recompute derived state in the same `set(...)`.
5. **Insert-before-baseline self-comparison** — a "compare against last green" gate must capture the baseline *before* inserting the current record, or the new row becomes its own baseline and the gate never fires. Mirror the reference implementation's ordering exactly.

## What remains

Per the INDEX wave plan: Wave 2 (DB N+1 / over-fetch, 18 findings), Wave 3 (algorithmic hot loops, 14), Waves 4-5 (React re-render, 42), Wave 6 (resource leaks / lifecycle, 13), Wave 7 (correctness + diverged-logic consolidation, incl. the triplicated damage formula). Open follow-up: the `sig` unused-var warning in `crash-analyzer/analysis-engine.ts:87` (pre-existing, fold into a future cleanup).
