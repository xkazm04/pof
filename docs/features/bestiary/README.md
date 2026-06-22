# Bestiary Pipeline

> Catalog ID `bestiary` · Category Core / Existing · 12 steps

**Purpose.** Authors a tank-archetype enemy entity in PoF. Per ARPG-LAWS §6 and canon `game-creature-design` / `arpg-monster-rarity` / `arpg-monster-mods`, difficulty comes from rarity + modifiers + telegraphed patterns, never hand-tuned stat inflation: rarity multipliers scale the Normal baseline and each modifier is a buff/aura GE granted at spawn. Realised as an `AARPGEnemyCharacter` BP child with one `DT_AttributeDefaults` stat row — no new C++ per canon `char-config-not-cpp`.

## Target / starter entity
- **Brute** (`bestiary-brute`, tank/melee — seeded from `ARCHETYPES`) — a deliberate, telegraphed bruiser: slow move speed, high burst on slams. Abilities and loot links are resolved at seed time (abilities by name → spellbook ids; loot → `lt-Brute`).

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept & Role | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Lore / Codex | brief | — | L0 · `minLength(lore, ≥200)` |
| 3 | Stat Block | schema | — | L0 · `fieldsPopulated(health/damage/armor/moveSpeed)`; L2 `cppSymbolExists(AARPGEnemyCharacter)` |
| 4 | Resistances | schema | — | L0 · `fieldsPopulated(fireRes/iceRes/lightningRes/chaosRes)` |
| 5 | Monster Rarity | rules | — | L0 · `fieldsPopulated(rarityTier/lifeMultiplier/modifiers)` |
| 6 | Abilities | rules | — | L0 · `minCount(abilities, 1)` |
| 7 | AI Behavior | rules | — | L0 · `fieldsPopulated(tree/aggroRange/archetype)` |
| 8 | Encounter Balance | balance | — | L0 · `withinPercent(threat, 100, ±10%)` |
| 9 | Concept 2D Art | gallery | `T_<slug>_Concept` | L1 · `selected` |
| 10 | 3D & Rig | gallery | `SK_<slug>` | L1 · `selected(mesh)` |
| 11 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSBestiarySpawnTest)` |
| 12 | UE Packaging | manifest | `DT_Bestiary::<slug>`, `BP_<slug>`, `SK_<slug>`, `BT_<slug>`, `GE_Mod_ExtraFast`, `GE_InitResistances` | L0 · `minCount(assets, 3)`; L2 `cppSymbolExists(AARPGEnemyCharacter)` |

## UE wiring
- **C++ symbol** (`cppSymbolExists`): `AARPGEnemyCharacter` (enemy actor base class).
- **DataTables / assets:** `DT_Bestiary` / `DT_AttributeDefaults` (stat + resist rows applied via `GE_InitStats` / `GE_InitResistances` at spawn), `BP_<slug>` (BP child), `SK_<slug>` (skeletal mesh), `BT_<slug>` (behavior tree), `GE_Mod_ExtraFast` (rarity modifier aura).
- **Runtime test:** `VSBestiarySpawnTest` (spawns + possesses, Ground Slam + Heavy Attack fire, dies + drops `lt-Brute` loot, rarity-modifier GE applied on Magic/Rare, resist profile reduces elemental hits).
- **Cross-catalog links:** `spellbook::off-phy-04` (Ground Slam, primary), `spellbook::off-phy-02` (Heavy Attack, heavy), `loot-tables::lt-Brute` (loot, from `DEFAULT_ENEMY_LOOT_BINDINGS`). Depends on `UARPGAttributeSet` (Armour/MaxHealth/BaseDamage + per-type resist attributes) and `ARPGDamageExecution`.

## Acceptance profile
**L0 (data)** for brief/lore/stats/resists/rarity/abilities/AI/balance, **L1 (human selection)** for the Concept 2D and 3D & Rig galleries, **L2 (static UE source)** on Stat Block and UE Packaging (`cppSymbolExists(AARPGEnemyCharacter)`), plus one **L3 runtime-deferred** gate (`VSBestiarySpawnTest`). Config-complete = all L0/L1/L2 steps pass and the spawn/combat test sits `deferred` until a live-UE runner executes it.

## Status & notes
Resistances use the code damage-type enum `Ice` (never `Cold`); monsters are uncapped per §4c (normal range 0–40%, no 75% cap). Rarity scaling is data: `rarityScale` table (Normal ×1 / Magic ×1.75 / Rare ×5 / Unique ×8 life, +0/+1/+3/fixed modifiers), with each modifier as a self-applied aura GE on `BeginPlay`. Abilities link to real seeded spellbook ids; loot links to `lt-Brute`. Per-producible-step §12 wiring contracts throughout.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
