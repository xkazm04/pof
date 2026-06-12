# Bug+UI Scan Fix Wave 6 — Trust boundaries & sim/display correctness (theme F)

> 4 commits, 4 High findings closed (+5 new tests).
> Baseline preserved: tsc 0 src errors → 0; eslint (changed files) 0; tests (see Verification).

One mental model: **a value that flows into a simulation, an API engine, or a coordinate system carries an implicit contract (gates apply, ids exist, units match, the axis covers the data) — when the contract is unstated, stale data and direct callers silently produce confidently-wrong output.**

## Commits

| # | Commit | Finding closed | The wrong output |
|---|---|---|---|
| 1 | `64f7234` | combat #1 | caster loadouts cast free, cooldown-less spells forever → DPS/survival fiction |
| 2 | `5862142` | combat #2 | unbounded `count` hangs the event loop; all-unknown ids report 100% survival |
| 3 | `96be535` | world/procgen #1 | boss diamonds render at the top-left corner, detached from labels/edges |
| 4 | `c1acd05` | world/procgen #2 | six Density rows render blank; Lv-50 indicator pegs at level 7 |

## What was fixed

1. **Player ability gates.** `choosePlayerAbility`'s fallback returned `abilities[0]` regardless of cooldown/mana; `simulateFight` then charged mana and reset the cooldown unconditionally. It now returns `null` when nothing is off-cooldown AND affordable — the player idles the beat and re-checks after mana regen. (Player-side twin of the 06-09 #4 enemy-mana fix, which didn't cover cooldowns.)
2. **API-edge validation.** The route now clamps each enemy group's `count` (1–10) and `level` (1–50) and rejects (400) unknown `archetypeId`s — closing the event-loop DoS, the NaN-summary path, and the stale-scenario silent win. Defense in depth: `simulateFight`'s `won` now requires `enemies.length > 0`, so a zero-enemy fight can never be a win for any direct engine caller.
3. **Boss diamond coordinates.** Replaced the user-space `<polygon points>` with a percent-positioned `<rect>` (mirroring the hub) resting at a 45° rotation (`transform-box: fill-box` pins the pivot to its own center) — so the boss shape shares the canvas coordinate space with its label and edges.
4. **Data-derived level axis.** `axisMax = max(MAX_LEVEL, ...bar maxes)` drives bar positions, the player indicator, and evenly-spaced tick labels — the axis grows to cover level-50 zones instead of clipping everything above 7.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors in `src/` (per-fix and at wave end) |
| `eslint` (all 7 changed files) | 0 problems |
| `vitest run` (full suite) | **3945 pass / 15 fail / 1 skip** — failure set identical to waves 1–5 (all pre-existing); +5 new tests passing (player gates ×2, zero-enemy win ×1, boss rect ×1, axis scale ×1) |

## Cumulative status (this scan)

| Wave | Theme | Closed | Crit |
|---|---|---:|---:|
| 1 | CLI process lifecycle & abort theater | 6 | 1 |
| 2 | Fix-the-fixes (06-09 regression tail) | 7 | 0 |
| 3 | Destructive writes & data loss | 6 | 0 |
| 4 | UE5 codegen correctness | 4 | 0 |
| 5 | Queues, races & orphaned async | 6 | 0 |
| 6 | Trust boundaries & sim/display correctness | 4 | 0 |
| **Total** | | **33 / 323** | **1 / 1 (100%)** |

## Patterns established (catalogue items 47–49)

47. **A "fallback" must obey the same gates as the primary path.** A default-when-nothing-qualifies branch that skips the qualifying filters (cooldown/mana) lets the simulation cheat — and downstream charge/reset code makes the cheat permanent. Return "no action" instead of a gate-bypassing default.
48. **Validate array-of-records inputs element-by-element, not just the scalars beside them.** `clampInt` guarded `config.*` but the sibling `scenario.enemies[].count/level/archetypeId` reached the engine raw. The trust boundary is every untrusted field, including ids (reject unknown) and counts (bound the loop).
49. **SVG `points`/`d` are user-space only — never mix them with percentage-positioned siblings.** A shape built from raw coordinates in a no-viewBox SVG lands in pixel space while percent-attribute siblings (circle/rect/line/text) scale with the canvas. Use a percent-positioned rect/circle, or give the SVG a viewBox and go fully unitless.

## What remains

323 → 290 open findings. Next (this session): **Wave 7 = theme G — stale state & dead reads** (6: GDD compliance never invalidated, SessionDetail no refetch, BatchReviewPanel frozen poll, A/B tests unreachable after reload, phantom module picker ids, pattern-miner module-wide success rate). Then H + U3 (shell hazards + silent-failure UX) and the a11y program.
