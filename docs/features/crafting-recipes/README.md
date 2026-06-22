# Crafting Recipes Pipeline

> Catalog ID `crafting-recipes` · Category Systems · `arpg-inventory` module · 11 steps · Tracks: logic, art-2d, vfx, audio, test

**Purpose.** Authors deterministic bench/vendor recipes that combine one or more input items (+ an optional currency cost) into a specific output item at a designated crafting station, gated by player skill level. Per ARPG-LAWS §10 (Economy & Crafting) and canon `arpg-crafting-bench` + `proj-economy`: fixed inputs → fixed output, gold cost is a documented sink, currency sinks balanced within ±15%. Wires into UE5 via `UARPGCraftingComponent` on the bench actor, which reads `FARPGRecipeRow` from `DT_Recipes`, validates inputs from `UARPGInventoryComponent`, subtracts gold via `UARPGCurrencySubsystem`, and yields the output to inventory. Input items are consumed (the consumption IS the sink).

## Target / starter entity
- **Health Potion** (`recipe-health-potion`) — Combine herb + vial into a healing potion: two gathered reagents + 20g at the Alchemist's Bench yield one consumable that restores 120 Life. Requires Crafting Skill Level 1.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Inputs & Output | schema | `DT_Recipes` | L0 · `fieldsPopulated(io: inputs/output/deterministic)` + L2 statics |
| 3 | Station & Skill | rules | — | L0 · `fieldsPopulated(stationSkill: station/skillLevel/gating)` + L2 static |
| 4 | Cost & Yield | balance | `DT_Currencies` | L0 · `withinPercent(costRatio, 0.8, ±20%)` + L2 static |
| 5 | Discovery / Unlock | rules | — | L0 · `fieldsPopulated(discovery: method/trigger/persistenceTag)` |
| 6 | Craft FX / Audio | rules | `NS_Craft_`, `SC_Craft_<name>_Loop`, `SC_Craft_<name>_Success` | L0 · `fieldsPopulated(craftFx: vfx/sfxLoop/sfxSuccess)` |
| 7 | Recipe UI | rules | — | L0 · `fieldsPopulated(recipeUi: widget/displayFormat/hudAnchor)` |
| 8 | Icon 2D Art | gallery | `T_<name>_Icon` | L1 · `selected` |
| 9 | Localization | checklist | — | L0 · `minCount(keys, ≥1)` |
| 10 | Test Gate | checklist | — | L3 · `runtimeDeferred(VSCraftingTest)` |
| 11 | UE Packaging | manifest | `DT_Recipes`, `T_`, `WBP_CraftingStation`, `NS_Craft_`, `SC_Craft_` ×2, `DT_Currencies` | L0 · `minCount(assets, ≥2)` + L2 statics |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `FARPGRecipeRow` (steps 2/11), `UARPGCraftingComponent` (steps 3/11), `UARPGCurrencySubsystem` (step 4). Bench is `BP_AlchemistBench` (an `AARPGInteractable`); skill gate reads `CraftingSkill` from `UARPGAttributeSet`; UI is `WBP_CraftingStation`.
- **DataTables**: `DT_Recipes` (row `recipe-health-potion`), `DT_Currencies` (`currency-gold` 20g sink).
- **Seeds** (`seedRowPresent`): `seed_recipes.py` (recipe row keyed by slug, steps 2/11).
- **Runtime test** (`runtimeDeferred`): `VSCraftingTest` — inputs consumed → output produced (also: gold deducted, atomic rollback on insufficient gold/missing inputs/wrong station/skill, recipe visibility gated by discovery) in PIE.
- **Cross-catalog `links`**: `items::item-7` (recipe-output, Minor Health Potion — base heal 50 HP upgraded to 120 HP as a crafting-tier improvement, steps 2/11), `currencies::currency-gold` (craft-cost-sink, steps 2/4/11), `icon-sets::iconset-abilities` (icon-family, step 8). Reagent inputs (Thornleaf Extract, Ashroot Dust) are honest deferrals pending a material items seed — not resolvable links.

## Acceptance profile
Uses L0 (data: brief, io, station/skill, cost ratio, discovery, craft FX, recipe UI, localization keys, asset count), L1 (gallery: recipe icon), L2 (static UE source: `FARPGRecipeRow`, `UARPGCraftingComponent`, `UARPGCurrencySubsystem`, seeded `DT_Recipes` row), and one L3 deferred gate (`VSCraftingTest`). The Craft FX step also notes an L4 visual smoke-test as a deferral within its wiring contract. "Config-complete" means all data/selection/static steps reach `pass` and the Test Gate terminates `deferred` (full craft cycle verified in PIE).

## Status & notes
11-step pipeline. Obeys ARPG-LAWS §10d (deterministic known-crafting counterweight to the gambling loot loop) and canon `proj-economy` / `proj-balance`: gold cost (20g) is the sole documented sink, calibrated so the gold-cost/output-value ratio (20/24 ≈ 0.833) lands within ±20% of the 0.8 target band (0.64–0.96), and price/power is 1.0× inside the 0.8–1.2× band. Bridge-driven runtime craft behavior is deferred to PIE. Known gap: reagent input items and the Tier-2 recipe-scroll unlock await a material items seed.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
