# Zen-Perf Fix Wave 7 — Correctness Consolidation

> 4 commits, 4 findings closed (the last high-severity theme). Behavior-sensitive logic:
> unify drifted duplicates, kill a cross-client singleton, fix a broken graph traversal,
> make an insert idempotent. New tests lock in the corrected behavior.
> Baseline preserved: tsc 0→0; tests 15 fail / **3959 pass** (was 3946 — +13 new tests, 0 new failures); 0 lint errors.

## Commits

| # | Commit | Finding | File(s) |
|---|---|---|---|
| 1 | `f3e4e0e` | #14 (ctx 02) | combat/damage.ts (new) + simulation-engine/predictive-balance/choreography-sim + test |
| 2 | `9e02660` | #66 (ctx 20) | api/gdd-compliance/route.ts + stores/gddComplianceStore.ts |
| 3 | `7886384` | #45 (ctx 31) | blueprint-cpp-codegen.ts + blueprint-parser.ts + types/blueprint.ts + 2 tests |
| 4 | `b6d5ff5` | #35 (ctx 35) | regression-tracker.ts |

## What was fixed

1. **Triplicated damage formula → one canonical function (#14).** (choreography-sim already imported sim-engine's; the real drift was sim-engine vs predictive-balance.) Extracted `src/lib/combat/damage.ts` (`calculateDamage`); all engines call it, locked by a referential-identity test. **Bugs fixed in the predictive copy:** damageMul was pre-baked into attackPower (scaled AP only) → now per-hit on the whole hit; results now round + clamp ≥1; armor no longer re-applies a build-time multiplier / cross-feeds enemyDamageMul into enemy armor. **Numeric impact:** at default tuning (muls=1.0) output is unchanged except integer rounding (balance-baseline tests still pass); with non-default damage/armor muls the predictive heatmap/DPS now matches the sim (the prior divergence was the bug). **DESIGN choices surfaced to the user** (see below).
2. **GDD shared-singleton corruption (#66).** The route held a module-level `cachedReport` every client overwrote, so a Resolve mutated whoever's report was cached. Now resolved client-side (the store applies a pure immutable transform to the report it already holds); the resolve-gap route branch + singleton are gone. Cross-client corruption eliminated; resolve behavior unchanged.
3. **Blueprint exec-edge traversal (#45).** `generateNodeLogic` resolved exec edges by `node.id === pinId || pin.name === pinId` — matched only by accident, so multi-node chains silently dropped statements past the first (and it was O(N²·pins)). The parser now assigns stable pin ids + `buildEndpointIndex()` (registers each node under its node id AND every pin id — `linkedTo` is dual-convention: UE5 exports use pin ids, the bundled sample uses node ids). All 3 call sites resolve via the map → correct + O(N+E). New tests prove multi-node chains emit every node's statements (was broken). 44 blueprint tests pass.
4. **Duplicate regression alerts (#35).** Re-analyzing a session re-inserted alert rows (no idempotency key, unlike occurrences). Mirrored occurrences: UNIQUE index on `(fingerprint_id, reappeared_in_session_id)` + `INSERT OR IGNORE`. Re-analysis is now a no-op; a genuinely new regression still inserts. Also guarded a post-insert `getAlert(...)!` crash on the no-op path.

## ⚠ Design choices in #14 — confirm or override

These were classified as DESIGN (not clear bugs); I kept the conservative/sim-canonical option. They only matter at non-default tuning or boundary cases:
1. **Min-damage clamp `Math.max(1, …)`** (kept) vs `Math.max(0, …)`. Consequence: predictive can no longer report 0-damage hits (a connecting hit always lands ≥1). If the predictive view was meant to show true 0s on full mitigation, switch to `max(0)`.
2. **Predictive's `type==='aoe'` ability-SELECTION heuristic** (left untouched). This is AI target-priority, separate from the damage/targeting predicate (which already agreed across copies). I did NOT unify it. Flag if you want selection logic unified too.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3959 pass — no new failures; +13 new passing (damage + blueprint); balance-baseline tests pass |
| ESLint (changed files) | 0 errors (12 pre-existing warnings: hardcoded hex, dead accumulators — all on master) |

## Patterns established (catalogue, items 25–28)

25. **Drifted duplicates need a canonical-choice decision** — unifying N copies that disagree isn't purely mechanical: classify each divergence as bug-vs-design, unify behind the most-correct, report the per-consumer numeric impact, and surface design choices to the owner. Lock the call sites to one function with a referential-identity test so they can't re-drift.
26. **Module-level mutable state in a request handler** — `let cache` at module scope in an API route is shared across all clients → cross-client corruption (and HMR-reset surprises). If a pure transform + client-held state suffice, resolve client-side; otherwise make the handler stateless (inputs in, result out).
27. **Idempotency key mirrors a sibling table** — when one table is idempotent (composite key + INSERT OR IGNORE) but a related one isn't, mirror the exact mechanism so re-runs can't duplicate while genuinely-new rows still insert.
28. **ID-vs-name graph traversal "works by accident"** — resolving edges by `id === x || name === x` scans is both wrong and O(n²). Build a proper id→node index in the parser and resolve through it (correct + O(N+E)); test a multi-node chain to prove nothing is dropped.

## Cumulative status — all waves

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |
| 3 | Algorithmic hot loops | 7 (+#37 by deletion) |
| 4 | React re-renders (batch 1) | 6 (#3 reverted) |
| 5 | React re-renders (batch 2) | 6 |
| 6 | Resource leaks / lifecycle | 6 |
| 7 | Correctness consolidation | 4 |

**Total closed: 43 / 176** (44 counting #37). **All high-severity themes are now complete.** Remaining: ~132 mediums/lows + a few deferred items.

## What remains (deferred / lower-severity)
- **Deferred:** #3 inventory re-render (cardRefs-owner refactor); #12 follow-on (CLITabBar/CLIBottomPanel same coarse subscription); the `(module_id, completed_at DESC)` session_analytics index.
- ~120 medium/low findings across all themes, opportunistically (no remaining highs).
- Pre-existing, unrelated to this audit: the 15 `catalog/ueStaticCheckers` test failures (server-only fs check run in jsdom) — present on master throughout.
