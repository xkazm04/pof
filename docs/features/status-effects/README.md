# Status Effects Pipeline

> Catalog ID `status-effects` · Category Game Assets · `arpg-gas` module · 6 steps · Tracks: logic, art-2d, vfx, audio, test

**Purpose.** Models ARPG ailments — secondary effects that out-live the hit that applied them. Identity is the granted `State.*` gameplay tag (canon `arpg-status-tag-identity`): VFX, AI threat weighting, and the player's buff bar all key off the tag, never the source ability. The seeded entity "Burning" is an ignite-type fire DoT per ARPG-LAWS §5c. Wires into UE5 as `GE_Gen_Burning` (`UGE_Gen_Burning`), registered in `DT_GeneratedAbilities`; applied by Fireball's on-hit GE via `ApplyGameplayEffectToTarget`.

## Target / starter entity
- **Burning** (`status-burning`) — Fire damage-over-time; pairs with Fireball, grants `State.Burning`. (Sibling starter **Chilled** `status-chilled`, an ice movement-speed slow, also seeds the catalog.)

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Effect Logic | rules | `GE_Gen_<name>`, `DT_GeneratedAbilities` | L0 · `fieldsPopulated(effect: tag/magnitude/period/duration/stacking/sourceDamageType/dispellable)` + L2 static |
| 3 | Balance | balance | — | L0 · `withinPercent(dps, 7.875, ±20%)` |
| 4 | Icon 2D Art | gallery | `T_<name>_Icon` | L1 · `selected` |
| 5 | Test Gate | checklist | — | L3 · `runtimeDeferred(VSStatusBurningEffectTest)` |
| 6 | UE Packaging | manifest | `GE_Gen_`, `T_<name>_Icon`, `DT_GeneratedAbilities`, `NS_<name>_VFX` | L0 · `minCount(assets, ≥3)` + L2 seed |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UGE_Gen_Burning` (step 2 — ignite GameplayEffect class compiled in `Source/PoF/Abilities/Generated/`). Runtime dependencies declared: `UARPGAttributeSet` (FireDamage + Health), `ARPGDamageExecution` (damage routing + ailment-chance roll).
- **DataTables**: `DT_GeneratedAbilities` (row "Burning").
- **Seeds** (`seedRowPresent`): `seed_generated_abilities.py` (row keyed by slug, step 6).
- **Runtime test** (`runtimeDeferred`): `VSStatusBurningEffectTest` — tick at 0.5 s period, `State.Burning` present during duration, removed on expiry/cleanse, highest-stack law (weaker re-apply discarded, stronger replaces + resets timer).
- **Cross-catalog `links`** (step 2): `spellbook::off-fire-01` (Fireball, primary-ignite-source), `spellbook::off-fire-04` (Blazing Slash), `spellbook::off-fire-05` (Flame Lance) — all real seeded fire ability ids.

## Acceptance profile
Uses L0 (data: brief, effect rules, balance DPS), L1 (gallery: status icon), L2 (static UE source: `UGE_Gen_Burning` compiled + seeded `DT_GeneratedAbilities` row), and one L3 deferred gate (`VSStatusBurningEffectTest`). L4 visual is not used. "Config-complete" means the brief/effect/balance/icon/packaging steps reach `pass` and the Test Gate terminates `deferred` (runtime tick timing + tag lifecycle + highest-stack replacement verified in PIE).

## Status & notes
Compact 6-step pipeline. Obeys ARPG-LAWS §5c (ignite ≈ 90% of triggering fire hit over 4 s at a 0.5 s tick → 8 ticks; magnitude derived from Fireball base 35 → ≈ −3.94 fire dmg/tick → 7.875 fire DPS, inside the tier-100 envelope) and §5d (stacking `highest`: stronger refreshes, weaker discarded). The Balance step's `withinPercent` target (7.875 ±20% → 6.3–9.45) is a self-consistent derivation from the documented ignite formula. Bridge-driven runtime ailment behavior is deferred to the named PIE test.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
