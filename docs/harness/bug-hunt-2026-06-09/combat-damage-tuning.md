# Bug Hunt — Combat & Damage Tuning
> Total: 4
> Severity: 1 critical, 2 high, 1 medium, 0 low

## 1. Player-armor multiplier is squared and enemy armor is scaled by a damage knob in `calculateDamage`
- **Severity**: critical
- **Category**: state-corruption
- **File**: src/lib/combat/simulation-engine.ts:58 (with src/lib/combat/simulation-engine.ts:87)
- **Scenario**: A designer drags the "Player Armor" slider to 2.0 (or "Enemy Dmg" to 2.0) and reads the resulting survival/DPS numbers to make a balance decision.
- **Root cause**: The armor term `effectiveArmor = targetAttrs.armor * (isPlayer ? tuning.enemyDamageMul : tuning.playerArmorMul) * tuning.armorEffectivenessWeight` reuses the wrong tuning factors. `buildPlayerAttributes` already baked `playerArmorMul` into `attrs.armor` (line 87); applying `playerArmorMul` a second time here when an enemy hits the player squares it (set armor x2 → mitigation computed as if x4). On the player's own attacks the enemy's armor is multiplied by `enemyDamageMul` — a *damage* knob applied to *armor* — so raising enemy damage also makes enemies more damage-resistant, and `enemyHealthMul`/no enemy-armor knob is ignored. The design assumption "each tuning knob maps to exactly one axis" is violated; the knobs cross-contaminate.
- **Impact**: corruption — every survival rate, DPS, TTK, threat-breakdown and balance alert produced by the Monte-Carlo sim is computed from a wrong mitigation curve whenever any armor/enemy-damage knob leaves 1.0. Designers tune against numbers that don't reflect the documented formula (`ArmorReduction = Armor/(Armor+100)`), shipping mis-balanced encounters.
- **Fix sketch**: Compute mitigation once from the already-scaled `targetAttrs.armor` and only `armorEffectivenessWeight`: `effectiveArmor = targetAttrs.armor * tuning.armorEffectivenessWeight`. Never re-apply a build-time multiplier in the damage step, and never feed a damage multiplier into the armor term. Add a unit assertion that doubling only `playerArmorMul` produces exactly one doubling of player armor in the mitigation input.

## 2. Choreography timeline ignores enemy cooldowns, so brutes spam their 6s burst and fabricate critical "burst spike" alerts
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/combat/choreography-sim.ts:230 (enemy loop 227–249)
- **Scenario**: An encounter contains a Stone Brute (abilities[0] = "Charge Attack", baseDamage 30, cooldownSec 6.0). The designer opens the combo/choreography timeline preview to check pacing.
- **Root cause**: `simulateEncounter` always fires `enemy.arch.abilities[0]` every `attackIntervalSec` and never reads or writes an enemy-cooldown map (unlike `simulateFight` in simulation-engine.ts, which gates on `enemy.cooldowns[a.id] <= time`). The assumption that "abilities[0] is the right per-tick attack" holds only for enemies whose first ability has cooldown 0; for the Brute (and any archetype whose strongest move is listed first with a real cooldown) the preview lets the 30-damage Charge Attack repeat on a ~2.8s cadence instead of every 6s.
- **Impact**: UX degradation / false signal — the timeline reports far more damage than the actual fight, then the bucket scan (lines 300–307) flags `severity: 'critical'` "Burst damage spike" alerts and "Player dies" alerts that the real Monte-Carlo sim never produces. Designers nerf encounters that are actually fine, or distrust the tool.
- **Fix sketch**: Give the choreography sim the same cooldown bookkeeping as the engine: track `enemyCooldowns[id]`, pick the first ability whose cooldown has elapsed (falling back to a zero-cooldown basic), and set the cooldown on use. Better, extract one shared "pick enemy ability" function so the preview and the authoritative sim can never diverge.

## 3. Predictive-balance applies `playerDamageMul` only to AttackPower, so its heatmap disagrees with the real sim
- **Severity**: high
- **Category**: logic-error
- **File**: src/lib/combat/predictive-balance.ts:60 (with calcDamage at src/lib/combat/predictive-balance.ts:79)
- **Scenario**: A designer compares the survival heatmap from `runPredictiveBalance` against a point-run from the combat-simulator API at the same level/enemy and sees different survival/DPS.
- **Root cause**: Two engines implement the *same* damage model differently. `buildPlayerAttrs` multiplies `attackPower *= tuning.playerDamageMul` (line 60) and `calcDamage` has **no** `damageMul` term, whereas the canonical `calculateDamage` leaves attackPower untouched and multiplies the *whole* hit (baseDamage + scaling) by `playerDamageMul` (simulation-engine.ts:51,61). Result: predictive-balance never scales the flat `baseDamage` portion by the player-damage knob, and double-shifts the scaling portion's contribution. The assumption that "both engines share one formula" is false. (Predictive also applies `enemyDamageMul` to enemy attackPower at line 73 while the engine applies it as a full-hit multiplier — same class of mismatch.)
- **Impact**: UX degradation — the predictive sweep (the headline heatmap/sensitivity tool) and the authoritative single-encounter sim give contradictory balance verdicts for identical inputs, eroding trust and leading to wrong level-curve tuning, especially for low-attackPower / high-baseDamage ability mixes.
- **Fix sketch**: Make both call a single shared `calculateDamage`. Delete the attribute-build-time `*= playerDamageMul` / `*= enemyDamageMul` lines in predictive-balance and route every hit through the engine's formula (full-hit `damageMul`). One formula, one source of truth.

## 4. Enemies cast mana abilities they cannot afford once their pool runs dry (fallback bypasses the mana gate)
- **Severity**: medium
- **Category**: edge-case
- **File**: src/lib/combat/simulation-engine.ts:255 (fallback `?? enemy.abilities[0]`, spend at line 293)
- **Scenario**: A Dark Mage (mana 80, no mana regen) fights long enough to cast Shadow Bolt (manaCost 10) eight times. From cast nine onward its mana is 0.
- **Root cause**: Enemy ability selection filters on `a.manaCost <= enemy.attrs.mana`, but when every ability is filtered out it falls back to `enemy.abilities[0]` unconditionally and then unconditionally subtracts `ability.manaCost` (line 293), driving mana to -10, -20, … The assumption "the fallback is a free basic attack" is wrong for archetypes whose only/first ability has a mana cost and no regen — there is no zero-cost basic to fall back to. The mana economy is silently ignored.
- **Impact**: UX degradation / corruption of results — enemies that should fall silent (or switch to a cheaper move) when out of mana keep dealing full damage forever, inflating enemy DPS, one-shot rate, and threat-breakdown for caster-heavy encounters. The mana resource is effectively cosmetic for enemies.
- **Fix sketch**: Make the fallback affordability-aware: pick the cheapest castable ability, and if none is affordable, skip the enemy's turn (or emit a zero-damage "out of mana" beat) rather than force-casting `abilities[0]`. Guard the spend with `if (ability.manaCost <= enemy.attrs.mana)` so the gate can never be bypassed by a fallback path. Give archetypes an explicit no-cost basic so "no affordable ability" is unambiguous.
