# Items Pipeline — the reference implementation

> Catalog ID `items` · Category Core / Existing · `arpg-inventory` domain · 11 steps

**Purpose.** The items catalog is PoF's most mechanically dense row — every equippable object starts here. This pipeline is the **content + gate authority** that `loot-tables` and `vendors` link into, and it is the **reference implementation** for the whole catalog-pipeline chassis: the fullest set of bespoke step UIs and the model every other pipeline copies. Per `ARPG-LAWS.md` §1/§2 and the `arpg-item-rarity`, `arpg-item-level`, `arpg-affixes`, `arpg-affix-is-ge` canon rules.

> If you read one pipeline to understand the system, read this one. See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the shared View/Produce/Acceptance model and acceptance ladder.

## Target / starter entity
- **Iron Longsword** (`item-1`) — a canonical tier-1 one-handed sword (Damage 12–18, Speed 1.2s → 0.83 APS, base DPS ≈ 12.5). The pipeline derives every numeric from this seed, so the acceptance bands are pinned to real values.

## Pipeline steps
| # | Step | Archetype | Produces (UE) | Acceptance |
|---|------|-----------|---------------|------------|
| 1 | Concept Brief | `brief` | — | L0 · `minLength` (brief ≥ 300 chars) |
| 2 | Base Type & Rarity | `schema` | `DA_<slug>` | L0 · `fieldsPopulated` (slot/rarity/ilvl/requiredLevel/implicit) · L2 `cppSymbolExists(UARPGItemDefinition)` |
| 3 | Affixes | `rules` | — | L0 · `fieldsPopulated` (budget/tierTable/illustrativeRareRoll) |
| 4 | Damage / Implicit | `rules` | — | L0 · `withinPercent` (baseDPS ±30% of 12.5) |
| 5 | Economy | `balance` | — | L0 · `withinPercent` (pricePowerRatio 0.8–1.2× of 1.0) |
| 6 | Material | `rules` | `MI_<slug>_Blade`, `T_<slug>_Albedo/Normal/ORM` | L0 · `fieldsPopulated` (surface/parentMaterial/textures); links → `materials::mat-weathered-stone` |
| 7 | Icon 2D Art | `gallery` (4) | `T_<slug>_Icon_Common/Magic/Rare/Unique` | **L1** · `selected`; links → `icon-sets::iconset-abilities` |
| 8 | 3D Mesh | `gallery` (3) | `SM_<slug>_LOD0/1/2` | **L1** · `selected` (mesh3dSelected) |
| 9 | Tooltip / Compare | `rules` | — | L0 · `fieldsPopulated` (displayName/description/compareFields) |
| 10 | Test Gate | `checklist` | — | **L3** · `runtimeDeferred(VSItemsDefinitionsTest)` · L2 `cppSymbolExists` + `seedRowPresent(author_items.py)` |
| 11 | UE Packaging | `manifest` | `DA_<slug>`, `DT_Items::<slug>`, 6×`GE_Affix_*`, `GE_Implicit_SwordAccuracy`, `MI_<slug>_Blade`, `SM_<slug>_LOD0`, `T_<slug>_Icon_Rare` | L0 · `minCount` (assets ≥ 3) · L2 `cppSymbolExists` + `seedRowPresent` |

## UE wiring
- **Schema** — `UARPGItemDefinition` (C++), realized as a `DT_Items` row + a `DA_<slug>` data asset.
- **Affix law (canon `arpg-affix-is-ge`)** — every explicit affix is a `GameplayEffect`, *not* a tooltip string. On equip, `UARPGInventoryComponent::EquipItem` creates one Infinite GE handle per affix (+ one for the implicit), targeting a `UARPGAttributeSet` attribute (`MaxHealth`, `BonusPhysicalDamage`, `AttackSpeed`, `FireResistance`, `LightningResistance`, `CriticalStrikeChance`). Handles are removed on unequip. GEs: `GE_Affix_MaximumLife`, `GE_Affix_AddedPhysicalDamage`, `GE_Affix_IncreasedAttackSpeed`, `GE_Affix_FireResistance`, `GE_Affix_LightningResistance`, `GE_Affix_IncreasedCritChance`, `GE_Implicit_SwordAccuracy`.
- **Seed** — `author_items.py` seeds the `DA_<slug>` row into the project.
- **Runtime test** — `VSItemsDefinitionsTest` (in `VSItems.umap`): loads the DA, asserts fields, equips on a dummy ASC, asserts each affix GE handle is active and the attribute deltas are correct.
- **Cross-catalog links** — downstream `loot-tables` (base pool) and `vendors` (buy/sell) reference items; upstream links to `materials` (surface) and `icon-sets` (icon library).

## Acceptance profile
- **L0** dominates (steps 1–6, 9, 11): pure spec/budget checks read from the artifact.
- **L1** human selection at the two generative gallery steps (icon, mesh).
- **L2** static source checks pin the C++ symbol + seed row.
- **L3** is the single deferred runtime gate (`VSItemsDefinitionsTest`); there is no L4 visual gate.
- **Config-complete** = steps 1–9 + 11 pass and step 10's static checks pass, with the runtime test deferred to a gate drain.

## Status & notes
- **Reference implementation.** The Items pipeline has the most complete bespoke step UI in `src/components/layout-lab/steps/` (concept brief, attributes, economy, icon, 3D, material, animations, VFX, SFX, inventory UI, tooltip, test gate, packaging). Other catalogs reuse `ArchetypeStep` until they need bespoke richness.
- **Rarity drives the numbers.** `ilvl` / `requiredLevel` are derived from the entity's seeded `rarity` (Common→ilvl 6, …, Legendary→ilvl 70), with `requiredLevel` held in the `ilvl − 5..15` band (§1c).
- **Rare is the build fantasy.** ≤3 prefix + ≤3 suffix from ilvl-gated tier pools; the in-file "Grief Veil" roll is a descriptive example of a 6-affix Rare at ilvl 45.
- **Damage math (§3):** `base + added → ×(1+Σincreased%) → ×each more%`; crit overlay capped at 95%, base crit-multi ×2.5.
