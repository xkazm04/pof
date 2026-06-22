# Loot Tables Pipeline

> Catalog ID `loot-tables` · Category Core / Existing · 10 steps

**Purpose.** Represents the multi-stage drop-roll system that decides what falls when an enemy/container dies: drop-class roll → rarity roll → affix roll at `ilvl = monsterLevel` (ARPG-LAWS §7, canon `arpg-loot-weighting`). Wiring: `UARPGLootDropComponent` on the monster actor invokes the loot system on `OnAllWavesComplete` / on-death; it reads `DT_LootTables`, selects a base from the items catalog, then rolls rarity + affixes. It never re-authors item data — only references it via `CatalogLink`.

## Target / starter entity
- **`lt-Brute`** (Loot Tables / tier from drop-chance) — the Brute/Goblin archetype's kill-reward table, seeded from `DEFAULT_ENEMY_LOOT_BINDINGS`. Mid-game (area-level ≈40–60) faucet for Magic and Rare gear plus a currency sub-table.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Drop Generation | rules | `DT_LootTables` | L0 · `fieldsPopulated(itemClassWeights/dropCount/ilvlSource)`; L2 `cppSymbolExists(UARPGLootDropComponent)` |
| 3 | Rarity Odds | rules | — | L0 · `fieldsPopulated(normal/magic/rare/unique)` |
| 4 | Magic Find & Smart Loot | rules | — | L0 · `fieldsPopulated(iiq/iir/pity/smartWeight)` |
| 5 | Currency & Unique Pools | rules | `DT_LootTables`, `DA_<slug>_UniquPool` | L0 · `minCount(links, 1)`; L2 `cppSymbolExists(FARPGLootTableRow)` + `seedRowPresent(seed_loot_tables.py)` |
| 6 | Item Base Links | rules | `DT_Items` | L0 · `minCount(bases, 1)` |
| 7 | Balance / Drop Sim | balance | — | L0 · `withinPercent(raresPerHour, 12, ±20%)` |
| 8 | Icon 2D Art | gallery | `T_<slug>_*Beam` | L1 · `selected` |
| 9 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSLootDistributionTest)` |
| 10 | UE Packaging | manifest | `DT_LootTables::<slug>`, `DA_<slug>_UniquePool`, `T_<slug>_LootBeam_*`, `NS_<slug>_DropBeam` | L0 · `minCount(assets, 2)`; L2 `cppSymbolExists(UARPGLootDropComponent, FARPGLootTableRow)` + `seedRowPresent(seed_loot_tables.py)` |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UARPGLootDropComponent` (on-death drop roller, on `AARPGEnemyCharacter`), `FARPGLootTableRow` (loot-table row struct).
- **DataTables / assets:** `DT_LootTables` (per-entity loot row), `DA_<slug>_UniquePool` (named-unique data asset), `DT_Items` (item-base source), loot-beam textures + `NS_<slug>_DropBeam`.
- **Seed script** (`seedRowPresent`): `seed_loot_tables.py` (loot-table row keyed by entity slug).
- **Runtime test:** `VSLootDistributionTest` (N-kill distribution matches declared odds ±5%, ilvl = source monster level, pity guarantee, unique-pool gate).
- **Cross-catalog links:** `currencies::currency-gold` (soft-currency drop; orb currencies pending catalog seed), `items::item-1/item-3/item-4/item-5` (drop bases), `items::item-5/item-6` (unique pool — Assassin's Cowl Epic, Sunfire Amulet Legendary). UE Packaging declares dependencies on `items`, `currencies`, and `bestiary` (the spawner binds enemy → table).

## Acceptance profile
**L0 (data)** for brief/drop-gen/rarity/magic-find/pools/bases/balance, **L1 (human selection)** for the loot-beam gallery, **L2 (static UE source)** on Drop Generation, Currency/Unique Pools, and UE Packaging (`cppSymbolExists` + `seedRowPresent`), plus one **L3 runtime-deferred** gate (`VSLootDistributionTest`). Config-complete = all data/static steps pass and the N-roll distribution test sits `deferred` until a live-UE runner executes it.

## Status & notes
The drop simulation carries a fully worked self-consistent derivation (600 kills/hr × 0.02 blended rare-item rate = 12 Rares/hr) within ±20% of the tier target. Several design-flavor entries (orb currencies, named uniques like Ashen Claymore) are documented but **not yet seeded** — their resolvable `links` arrays use only real seeded ids (`currency-gold`, `item-1/3/4/5/6`); links will be added as those catalog rows land. ilvl is always sourced from monster/area level (§7/§11) — the table never self-assigns ilvl or re-authors stats.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
