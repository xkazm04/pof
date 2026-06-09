# Bug Hunter Fix Wave 1 — Trust-boundary input validation

> 7 commits, 7 findings closed (3 critical, 4 high).
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors, tests 3926 pass / 14 fail (pre-existing) → 3925 pass / 15 fail. The +1 test delta is pre-existing `ueStaticCheckers` jsdom/fs flake — reproduced as 14 failures on clean `master` for the same files, none touching changed code.

## Theme

Every fix is one shape: a trust boundary (an imported scenario/build code, a UE5 JSON file, a client API body, or free-form JSON in SQLite) accepted values that were *well-typed/finite* but not *physically sane and bounded*. The unbounded value then OOM'd a tab, threw a `RangeError`, divided `0/0`, or NaN-poisoned a simulation result and the UE5 code generated from it. Each fix clamps/validates at the boundary using the same envelope the editor already enforces.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|--------|----------------|----------|-------|
| 1 | `fff4b9f` | abilities-gas-system #1 | critical | `sub_ability/gas-balance/data.ts`, `…/simulation.ts` |
| 2 | `51d29b4` | economy-balance-simulation #1 | critical | `app/api/economy-simulator/route.ts` |
| 3 | `e56035a` | gdd-compliance-design-doc #1 | critical | `lib/gdd-synthesizer.ts` |
| 4 | `73e84c8` | character-genome-designer #2 | high | `lib/genome/defaults.ts` |
| 5 | `283fd09` | loot-affix-system #2 | high | `sub_loot/_shared/codegen.ts` |
| 6 | `e246c16` | world-quests-procgen #3 | high | `lib/world/zone-analysis.ts` |
| 7 | `3390054` | economy-balance-simulation #2 | high | `lib/economy/simulation-engine.ts` |

## What was fixed (grouped by sub-pattern)

**Unbounded numeric inputs that crash/hang/OOM**
1. **GAS scenario import** (`fff4b9f`). `isValidCombatantStats` only checked `isFinite`, so an imported base64 scenario with `count: 1e9` (OOM via `Array.from`), `attackSpeed: 0` (`1/0 = Infinity`, player never resolves an attack), or negative armor (NaN mitigation) passed validation and crashed/froze the tab on Run. The validator now enforces the editor's per-field envelope, integer-bounds enemy `count` and `iterations`, and `runIteration` clamps the materialized-enemy allocation as belt-and-braces.
2. **Economy sim config** (`51d29b4`). The route clamped only the *upper* bound of `agentCount`/`maxLevel`/`maxPlayHours`, never the lower bound, integer-ness, or NaN, so `agentCount: 0` reached the engine, divided `0/0`, and poisoned every metric and the emitted UE5 C++ with NaN/undefined. A shared `clampConfigInt` now coerces and clamps each field in both the simulate and generate-code paths.
3. **GDD room difficulty** (`e56035a`). `rooms[].difficulty` is unbounded JSON from SQLite; `String.repeat(5 - difficulty)` threw `RangeError` on a negative/NaN count and failed the *entire* GDD document. Difficulty is now clamped to an integer in `[0,5]` before rendering (the sibling `getSummary` already guards this exact field).

**Unvalidated imports that corrupt state + UE5 codegen**
4. **Genome profile import** (`73e84c8`). `sanitizeProfile` accepted any finite number, so `baseHP: -500` / `gravityScale: -3` / `critChance: 50` persisted verbatim into the power-curve sim and codegen. It now clamps each field to a lib-layer mirror of the editor's `field-data` ranges.
5. **Loot table import** (`283fd09`). `entry.DropWeight ?? 1` let a negative/NaN/Infinity/string weight through (`??` only guards null/undefined), producing `NaN%` preview bars and poisoned codegen. A `finiteNonNeg` helper coerces `DropWeight`, `MinQuantity`, `MaxQuantity`, `NothingWeight` at the parse boundary.
6. **Zone connections** (`e246c16`). `asZone` cast `connections as string[]` without validating elements; a non-string entry was mis-reported as a dangling connection or could flip reachable zones to unreachable. It now filters to string elements so every `ZoneLike.connections` member is a real id by construction.
7. **Economy flow overrides** (`3390054`). `applyFlowOverrides` blind-spread client overrides onto the base flow, so a string/NaN `baseAmount` NaN-poisoned every metric and a negative `frequencyPerHour` silently dropped a flow while it still read as active. Overrides now merge only the known numeric fields through a coerce-finite-nonnegative guard.

## Verification

| Gate | Baseline | After Wave 1 | Verdict |
|------|---------:|-------------:|---------|
| `tsc --noEmit` errors | 0 | 0 | ✓ no change |
| `eslint` errors (changed files) | 0 | 0 | ✓ (1 pre-existing warning unrelated) |
| Tests passing | 3926 | 3925 | ✓ no regression — the 1 delta is `ueStaticCheckers` fs/jsdom flake, reproduced at 14 fails on clean `master` for the same files |
| Tests failing | 14 | 15 | pre-existing env flake; none in changed modules |

## Cumulative status (across all waves so far)

| Wave | Theme | Findings closed | Crit | High |
|------|-------|----------------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| **Total** | | **7 / 140** | **3 / 18** | **4 / 70** |

## Patterns established (catalogue items 1–4)

1. **Finite ≠ valid.** A trust-boundary validator that asserts only `typeof === 'number' && isFinite` still admits values that OOM, divide-by-zero, or throw `RangeError`. "Valid" must mean "within the same envelope the editor/UI enforces." Clamp or reject against an explicit per-field `[min,max]`.
2. **`?? fallback` is not validation.** `??` only guards null/undefined. Imported numeric fields need `Number()` coercion + `Number.isFinite` + a range/non-negative clamp; a string or NaN sails past `??`.
3. **Cast ≠ validate at a `data: unknown` boundary.** `x as string[]` validates the container, never the elements. Filter/validate elements (`.filter((c): c is string => typeof c === 'string')`) so the narrowed type is true by construction.
4. **Server is the trust boundary, not the UI.** A `min=`/slider clamp in the editor is bypassable (curl, replayed request, a stored record predating the clamp, a re-simulate path). Re-validate the same envelope server-side / at the parse function.

## What remains

17 of 140 findings closed-or-validated would require the other 6 waves. Open per the INDEX, in suggested order:
- **Wave 2** — Atomicity & write races (regression-tracker transaction, A/B trial atomic counter, checklist last-writer-wins, idempotency check-then-act, …).
- **Wave 3** — Silent-failure safety gates (cook `sizeBytes:0`, harness budget no-op, success-theater "produce/heal/written").
- **Wave 4** — Shared-singleton concurrency (Blender socket correlation, CLI abort→kill process, UE5 connection-manager leak, harness `git reset --hard`).
- **Wave 5** — UE5 codegen correctness · **Wave 6** — Security hardening (command injection, path traversal) · **Wave 7** — Determinism / timestamps / stale closures.

Waves 1–4 close 14 of the 18 criticals; Wave 1 closed 3.
