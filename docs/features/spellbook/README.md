# Spellbook Pipeline

> Catalog ID `spellbook` · Category Game Assets · 11 steps

**Purpose.** Models active abilities used by characters and enemies — authored end-to-end as a UE GameplayAbility (GAS). The reference entity is the **Fireball** mage nuke: a single-target fire projectile that detonates on hit and ignites the target. Damage obeys ARPG-LAWS §3 (added → increased → more, routed through `ARPGDamageExecution` with fire-resist cap 75% §4); the on-hit ignite applies `status-effects::status-burning` (`State.Burning` DoT). Wiring: the owning `UAbilitySystemComponent` calls `GiveAbility(GA_Fireball)` at character init; input action `IA_Ability1` (or an AI BT task) activates it.

## Target / starter entity
- **Fireball** (`off-fire-01`, Offensive/Fire) — damage 35, manaCost 20, cooldown 3.0 s, tag `Ability.Fire.Fireball`, damageType Fire. The canonical ignite vector for the fire archetype.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Effect Logic | rules | `GA_<slug>`, `GE_<slug>_Impact`, `GE_<slug>_ApplyBurning`, `DT_GeneratedAbilities` | L0 · `fieldsPopulated(damageType/baseDamage/manaCost/cooldown/critChancePct/critMulti/onHitIgnite)`; L2 `cppSymbolExists(FARPGAbilityCatalogRow, UARPGGameplayAbility)` |
| 3 | Targeting | rules | — | L0 · `fieldsPopulated(shape/range/requiresLoS/projectileSpeed)` |
| 4 | Balance | balance | — | L0 · `withinPercent(sustainedDPS, 19.5, ±20%)` |
| 5 | Combo / Synergy | rules | — | L0 · `minCount(combos, 2)` |
| 6 | Animation | checklist | — | L0 · `minCount(checks, 6)` |
| 7 | VFX | rules | `NS_<slug>_CastGlow`, `NS_<slug>_Projectile`, `NS_FireImpactBurst` (shared) | L0 · `fieldsPopulated(castGlow/projectile/impact)` |
| 8 | Icon 2D Art | gallery | `T_<slug>_Icon_01..04` | L1 · `selected` |
| 9 | Applies Status | rules | — | L0 · `fieldsPopulated(statusId/role/trigger)` |
| 10 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSGenFireballEffectTest)` |
| 11 | UE Packaging | manifest | `GA_<slug>`, `GE_<slug>_Impact/ApplyBurning/Cooldown`, `T_<slug>_Icon`, `DT_GeneratedAbilities::<slug>`, `NS_*` | L0 · `minCount(assets, 4)`; L2 `cppSymbolExists(UARPGGameplayAbility, FARPGAbilityCatalogRow)` |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UARPGGameplayAbility` (base GA class), `FARPGAbilityCatalogRow` (ability catalog row struct).
- **DataTables / assets:** `DT_GeneratedAbilities` (registry row per ability), `GA_<slug>` (gameplay ability), `GE_<slug>_Impact` (instant fire damage), `GE_<slug>_ApplyBurning` → `GE_Gen_Burning` (ignite DoT), `GE_<slug>_Cooldown`.
- **Seed script** (named in wiring contract): `seed_generated_abilities.py` seeds the `DT_GeneratedAbilities` row.
- **Runtime test:** `VSGenFireballEffectTest` (PIE: ability activates, Health −≈35 fire, `State.Burning` applied, Mana −20, cooldown blocks re-cast < 3 s, tag-block rules enforced).
- **Cross-catalog links:** `status-effects::status-burning` (role `applies` — the ignite DoT), `vfx::vfx-fire-impact` (shared `NS_FireImpactBurst` impact), `icon-sets::iconset-abilities` (hotbar/tooltip icon family). Depends on `UARPGAttributeSet` (Mana/Health/FireDamage) and `ARPGDamageExecution`.

## Acceptance profile
Uses **L0 (data)** for brief/effect/targeting/balance/combo/animation/VFX/applied-status, **L1 (human selection)** for the icon gallery, **L2 (static UE source)** on Effect Logic and UE Packaging, and one **L3 runtime-deferred** gate (`VSGenFireballEffectTest`). Config-complete = all L0/L1/L2 steps pass and the runtime functional test sits `deferred` until a live-UE/PIE runner executes it.

## Status & notes
Heavily ARPG-LAWS-driven: every numeric (DPS 19.5 target, ignite 31.5 over 4 s, crit ×2.5) carries a §-citation in the produce code. Each producible step embeds a §12 wiring contract (grantedBy / activatedBy / dependencies / verification). The Fireball is the granting source of `status-burning` — its Applies-Status step declares the Fireball end of that cross-catalog contract. Known gap: the `AM_Fireball_Cast` AnimMontage + Mixamo/Blender import path is unbuilt (plan.md §8) — the Animation step is config-spec only; the L3 test gates the actual firing.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
