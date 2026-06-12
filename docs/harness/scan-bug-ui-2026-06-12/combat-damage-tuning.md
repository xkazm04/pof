# Combat & Damage Tuning — Bug + UI scan (2026-06-12)

> Total: 8 findings (3 bug, 5 ui)

## Bug findings (new since 2026-06-09)

*Regression check for commit 0a01cd8 (armor-multiplier fix): verified clean. All three `calculateDamage` call sites now follow the apply-once contract — `buildPlayerAttributes` (simulation-engine.ts:90) and choreography-sim's `playerTargetAttrs` (choreography-sim.ts:146) pre-multiply `playerArmorMul` at build time, predictive-balance's `calcDamage` applies only `armorEffectivenessWeight`. No caller was left depending on the removed in-formula multipliers.*

## 1. Player ability fallback bypasses both cooldown and mana gates — caster loadouts cast free, cooldown-less spells forever
- **Severity**: High
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/combat/simulation-engine.ts:344` (fallback; spend at 241, cooldown reset at 244)
- **Scenario**: In the Combat Balance Simulator, deselect Melee Attack and run with only Fireball + Ground Slam. After ~1.7s of fight time both are on cooldown and mana is spent down; from then on `choosePlayerAbility` returns `abilities[0]` (Fireball) unconditionally — every ~0.9s, with mana driven to −15, −30, … Even with the default loadout, whenever every ability is simultaneously on cooldown the fallback fires Melee Attack ~0.3s before its 0.8s cooldown elapses and re-arms it.
- **Root cause**: When `available.length === 0`, the fallback (`player.abilities.find((a) => a.id === 'ga-melee-attack') ?? player.abilities[0]`) assumes a free, off-cooldown basic attack exists. The returned ability skips both filters, then `simulateFight` unconditionally subtracts `manaCost` (line 241) and resets the cooldown (line 244), so the gates can never re-engage. This is the player-side twin of known finding #4 (2026-06-09), which covered only the enemy mana fallback at line 255–261 — the player path additionally bypasses *cooldowns*, which the enemy path does not.
- **Impact**: Wrong results — for any loadout without a 0-mana, short-cooldown basic, player DPS is computed as if the strongest ability had no cooldown and no mana cost. Survival rates, TTK, "too easy" alerts and the Story-Mode report card for caster/burst builds are fiction; designers nerf player abilities that are actually fine. Default loadout numbers are mildly inflated (melee at ~0.5s cadence vs 0.8s cooldown).
- **Fix sketch**: Make the fallback honor the gates: pick the cheapest ability with `(cooldowns[a.id] ?? 0) <= time && a.manaCost <= mana`; if none, return null so the player skips the beat (set `nextActionTime = time + dt` to retry). Guard the spend/cooldown writes the same way as the prior #4 fix sketch suggested for enemies.

## 2. API accepts unvalidated `scenario.enemies` — unbounded `count` hangs the server, all-unknown archetype ids return a silent 100%-survival result
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/combat-simulator/route.ts:53` (with `src/lib/combat/simulation-engine.ts:157-159`)
- **Scenario**: (a) POST `{action:'simulate', scenario:{enemies:[{archetypeId:'melee-grunt', count:1e9, level:5}]}}` — the entity-build loop `for (let i = 0; i < entry.count; i++)` and every subsequent tick iterate a billion entities inside one `simulateFight`, blocking the Node event loop indefinitely (the batched runner only yields *between* fights). (b) POST a saved/scripted scenario whose archetype ids were since renamed — `ENEMY_ARCHETYPE_BY_ID.get()` misses, `continue` skips every group, the fight runs against zero enemies, `enemies.every(...)` on an empty array is `true`, and the API returns 100% survival / 0 damage / "encounter is trivial". (c) `level: NaN` flows into attribute math and yields a NaN summary.
- **Root cause**: `clampInt` was added (route.ts:19-23, comment: "Guards the sim engine against… non-numeric input") but only for `config.*`; `scenario.enemies[].count/level` and `archetypeId` reach the engine raw, and the engine's unknown-id policy is a silent `continue`. choreography-sim.ts:100-104 already fixed this exact class with a `skippedEnemies` warning alert; `simulateFight` did not. The UI clamps count to 1–10, so the gap is invisible until a direct API/MCP/scripted caller hits it.
- **Impact**: Denial of service for the whole dev server (one request starves every other route), or — worse — confidently wrong balance data: a fully-stale scenario reports a perfectly winnable encounter instead of erroring.
- **Fix sketch**: In the route, clamp `count` (1–10) and `level` (1–50) with the existing `clampInt`, and reject (400) any `archetypeId` not in `ENEMY_ARCHETYPE_BY_ID`. In `simulateFight`, count skipped groups and surface them as a `BalanceAlert` (mirror choreography-sim's `skippedEnemies`), and treat "zero enemies built" as an error, not a win.

## 3. Predictive-balance lets the player act every 0.1s tick — no cast time or global action slot, so its heatmap overstates player throughput ~2×
- **Severity**: Medium
- **Lens**: bug
- **Category**: engine-divergence
- **File**: `src/lib/combat/predictive-balance.ts:123` (loop; cast at 144-160, `time += TICK` at 183)
- **Scenario**: Run the predictive sweep and compare any heatmap cell against the authoritative simulator at the same level/enemy/gear. Predictive's `simulateFight` picks and fires one `bestAbility` **per 0.1s tick**, gated only by per-ability cooldowns — Fireball, Combo Finisher, Melee, Slam and Dash all run concurrently on their own cooldowns (~2.5 casts/s sustained), while the engine serializes the player through one action slot of `castTimeSec + 0.1` (~1.3-1.6 casts/s) and `castTimeSec` is ignored entirely.
- **Root cause**: The lightweight sweep engine never models a global "player is busy casting" state. This is *distinct from* known finding #3 (2026-06-09), which covered where `playerDamageMul`/`enemyDamageMul` are applied — routing both engines through a shared `calculateDamage` (that finding's fix) would not close this gap, and it materially compounds it. Secondary divergence in the same loop: `buff` abilities are selected (priority 5, lines 137) but `appliesBuff` is never applied, so War Cry burns 25 mana and a turn for zero effect.
- **Impact**: Wrong results — survival heatmaps, level curves, and sensitivity/diminishing-returns analysis are systematically optimistic about player damage (high-cooldown burst kits most distorted), so the sweep clears encounters the real sim says are lethal. Designers trust whichever tool they opened first.
- **Fix sketch**: Add a `nextActionTime` gate to predictive's `simulateFight`: after a cast, `nextActionTime = time + ability.castTimeSec + 0.1`, and skip ability selection while `time < nextActionTime`. Either apply `appliesBuff` (with expiry) or exclude buff-type abilities from the lightweight AI. Add a parity test asserting predictive DPS is within ~10% of the engine for the default scenario.

## UI findings

## 4. Pipeline-node expansion (C++ references) is mouse-only — invisible to keyboard and screen-reader users
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_combat/damage-pipeline/DamagePipelineFlow.tsx:79` (root cause in neighbor `FlowNode.tsx:108-119,146-152`)
- **Scenario**: A keyboard user tabs through the Damage Pipeline tab. Every node carries a ▸ expand caret and a `cursor-pointer`, and clicking reveals the node's C++ reference — but nothing in the SVG is focusable: the `onClick` sits on bare `<rect>`/`<text>` elements with no `tabIndex`, `role="button"`, `aria-expanded`, or Enter/Space handler.
- **Root cause**: Interactive SVG built without the focus/ARIA contract the rest of the module follows (CombatSubTabNav uses `FOCUS_RING_CLASS` + real buttons; the same file even ships a WCAG 1.4.1 `ChartLegend`). SVG shapes are not in the tab order by default.
- **Impact**: The entire C++-reference layer — the diagram's main payload for engineers — is unreachable without a mouse, and screen readers announce nothing for any node.
- **Fix sketch**: In `FlowNode`, wrap the node in `<g role="button" tabIndex={0} aria-expanded={expanded} aria-label={`${node.label} — ${node.detail}`} onKeyDown={Enter/Space → onToggle}>` and render the existing focus ring (e.g. a `focus-visible` stroke on the rect). One change fixes all three pipeline flows.

## 5. Combo timeline remove button is invisible until hover and has no accessible name
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_combat/combos/TimelineBlock.tsx:37`
- **Scenario**: Removing a step from the combo chain requires the per-block "X" button, but it is `opacity-0 group-hover:opacity-100` — keyboard users tab onto a button they cannot see (focus does not reveal it), and screen-reader users hear an unnamed button (icon-only `<X/>`, no `aria-label`/`title`).
- **Root cause**: Hover-reveal pattern implemented with hover-only opacity and no `focus-visible` state or label; the icon was assumed self-describing.
- **Impact**: A core editing interaction (removing a chain step) is effectively mouse-only; the only keyboard recourse is "Clear" (destroying the whole chain). Same anti-pattern, milder, on CombatSimulatorView's always-visible but unlabeled enemy-row "×" (line 628).
- **Fix sketch**: Add `aria-label={`Remove ${ability.name} from combo`}` and extend the reveal: `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` plus the shared focus ring. Give the enemy-row "×" an `aria-label` too.

## 6. Combo time ruler doesn't line up with the blocks it measures
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/core-engine/sub_combat/combos/index.tsx:149` (with `TimelineBlock.tsx:30,120`)
- **Scenario**: The `TimeRuler` maps time linearly (`totalDuration × 160px`), but the blocks beneath are laid out in a `flex … gap-4` lane — each block adds a 16px gap (where the chevron sits) — and every block enforces `minWidth: 80` (so any ability under 0.5s renders wider than its true duration). With a 5-step chain the block edges drift ~64px+ right of the tick marks; the "1.5s" tick points at the middle of the wrong ability.
- **Root cause**: Two independent coordinate systems: the ruler assumes a continuous time axis while the lane uses flex gaps and minimum widths for readability/arrow spacing.
- **Impact**: In the one view built for judging hit timing and combo pacing, the timestamps lie — designers reading start/end times off the ruler get values offset by up to half an ability.
- **Fix sketch**: Drop `gap-4` and render each block at exact `animDuration × 160px` (no minWidth), positioning the chevron absolutely inside the block's right edge; or compute ruler tick positions from the cumulative block+gap layout instead of raw time. Truncate labels rather than widening blocks.

## 7. DirectHealthFlow nodes advertise expansion (caret + pointer cursor) but clicking does nothing
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_combat/damage-pipeline/DirectHealthFlow.tsx:29` (also 46-48, 56-58, 66-68)
- **Scenario**: In the Damage Pipeline tab the main flow's nodes expand on click to show their C++ reference. The Direct Health flow renders the same `FlowNode`s — every `DIRECT_PIPELINE` node has a `cppRef`, so each shows the ▸ expand caret and `cursor-pointer` — but the component hardwires `expanded={false} onToggle={() => {}}`, so clicks are silently swallowed.
- **Root cause**: The expansion state plumbing (`useState` + toggle + the `AnimatePresence` cppRef panel) lives only in `DamagePipelineFlow`; `DirectHealthFlow` stubbed the props instead of replicating or sharing it.
- **Impact**: Dead affordance — users who learned "click a node to see the C++" on the flow directly above conclude the diagram is broken, and the direct-mod C++ refs (clamp, sign-branch, broadcasts) are unreachable.
- **Fix sketch**: Lift the `expandedNode` state + cppRef panel into a small shared wrapper (or copy the 10-line pattern from `DamagePipelineFlow`) and pass real `expanded`/`onToggle` here. Alternatively, if expansion is unwanted, strip `cppRef` rendering affordances by passing a `static` flag to `FlowNode`.

## 8. Gear select has no programmatic label — the one unlabeled control in the scenario form
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/CombatSimulatorView.tsx:482`
- **Scenario**: In the Scenario builder, Player Level and Iterations use `NumberField` with `ariaLabel`, and every enemy-row select carries `aria-label="Enemy group N archetype"` — but the Gear `<select>` sits under a visual `<label>` that has no `htmlFor`/`id` association and no `aria-label`. Screen readers announce it as an unnamed combo box; clicking the label text doesn't focus the control.
- **Root cause**: The `<label>` element is styled as a caption only; the association step was skipped for this one control while its siblings all got explicit labels.
- **Impact**: Inconsistent form semantics inside a single card — assistive-tech users can set level and iterations but must guess what the unnamed dropdown (announcing "Starter Gear, combo box") controls.
- **Fix sketch**: Add `id="combat-sim-gear"` to the select and `htmlFor="combat-sim-gear"` to the label (or `aria-label="Player gear loadout"`), matching the pattern already used on the enemy archetype selects.
