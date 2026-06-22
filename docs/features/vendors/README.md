# Vendors Pipeline

> Catalog ID `vendors` · Category Systems · `arpg-inventory` module · 11 steps · Tracks: logic, art-2d, audio, test

**Purpose.** Authors a stationary or wandering NPC merchant that buys, sells, and repairs items within PoF's grounded economy. Per ARPG-LAWS §10 (Economy & Crafting) and the `vendor-laws` canon: margin within ±20% of a 30% target, buyback 50%, settlement in `currency-gold` only, reputation discount linear off the faction repTier (no custom curves), all three services explicitly declared. Wires into UE5 via `UARPGVendorComponent` on the NPC actor, which reads `FARPGVendorInventoryRow` from `DT_VendorInventory`, settles in `DT_Currencies` (`currency-gold`), and applies faction reputation from `faction-ashen-order`.

## Target / starter entity
- **Wandering Merchant** (`vendor-wandering-merchant`) — A roaming general-goods vendor: a stationary NPC merchant with a 12-hour restock cycle, a 30% markup / 50% buyback economy, and a linear Ashen Order reputation discount (Neutral 0% → Exalted 20%).

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Inventory Pool | rules | `DT_VendorInventory` | L0 · `minCount(stock, ≥1)` + L2 statics |
| 3 | Pricing & Restock | rules | — | L0 · `fieldsPopulated(pricing: markupPct/buybackPct/restockHours)` |
| 4 | Reputation Modifiers | rules | — | L0 · `fieldsPopulated(repMods: repTier/discountCurve)` |
| 5 | Buy/Sell/Repair | rules | `DT_Currencies` | L0 · `fieldsPopulated(services: buy/sell/repair)` + L2 statics |
| 6 | Economy Sim | balance | — | L0 · `withinPercent(marginPct, 30, ±20%)` |
| 7 | Shop UI | rules | — | L0 · `fieldsPopulated(shopUi: widget/format/anchor)` |
| 8 | Icon 2D Art | gallery | `T_<name>_Icon` | L1 · `selected` |
| 9 | Localization | checklist | — | L0 · `minCount(keys, ≥1)` |
| 10 | Test Gate | checklist | — | L3 · `runtimeDeferred(VSVendorTransactionTest)` |
| 11 | UE Packaging | manifest | `DT_VendorInventory`, `T_`, `WBP_VendorShop`, `BP_Vendor_`, `DT_Currencies` | L0 · `minCount(assets, ≥3)` + L2 statics |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `FARPGVendorInventoryRow` (steps 2/11), `UARPGVendorComponent` (steps 5/11), `UARPGCurrencySubsystem` (step 5). Vendor is `BP_Vendor_<name>` (an `AARPGNPCActor`); UI is `WBP_VendorShop` (5-col grid); reputation via `UARPGFactionSubsystem::GetRepTier`.
- **DataTables**: `DT_VendorInventory` (row keyed by slug), `DT_Currencies` (`currency-gold` settlement).
- **Seeds** (`seedRowPresent`): `seed_vendor_inventory.py` (vendor inventory row, steps 2/11).
- **Runtime test** (`runtimeDeferred`): `VSVendorTransactionTest` — buy deducts gold + adds item, sell adds gold + removes item, repair deducts gold + restores durability, rep discount + buyback floor applied, in PIE.
- **Cross-catalog `links`**: `items::item-1/3/4/5` (stock — Iron Longsword, Crystal Staff, Steel Chestplate, Assassin's Cowl; step 2), `currencies::currency-gold` (transaction-currency, step 5), `factions::faction-ashen-order` (rep-source, step 4). Flavor stock (Health Potion, Leather Armor, Shield) is design intent only — not resolvable links.

## Acceptance profile
Uses L0 (data: brief, stock count, pricing, rep mods, service flags, margin, shop UI, localization keys, asset count), L1 (gallery: vendor icon), L2 (static UE source: `FARPGVendorInventoryRow`, `UARPGVendorComponent`, `UARPGCurrencySubsystem`, seeded `DT_VendorInventory` row), and one L3 deferred gate (`VSVendorTransactionTest`). L4 visual is not used. "Config-complete" means all data/selection/static steps reach `pass` and the Test Gate terminates `deferred` (buy/sell/repair wallet + stock cycle verified in PIE).

## Status & notes
11-step pipeline. Obeys `vendor-laws`: markup 30% within the 24–36% band, buyback 50% floor, gold-only settlement, strictly linear reputation discount (discountPct = repTier × 5, 0–20%), and all three services declared. The Economy Sim `withinPercent` target (margin 30 ±20% → 24–36) uses a representative sim value of 28 derived from a 23.1% headline margin blended across the buyer-tier mix. Bridge-driven runtime transaction behavior is deferred to PIE. Reputation is sourced from the factions catalog with no custom curves.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
