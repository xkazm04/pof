# Item — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `items` (existing) · **Description:** Equippable, consumable, or quest item with stats and presentation.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Iron Longsword** — the real seeded `items` entity `id: item-1` (Weapon / Sword, Common, Damage 12-18 ⇒ numericValue 15, Speed 1.2s, "A standard issue longsword.").

**Status (this session):** 6/15 steps **produced or reused end-to-end**, 2 partial, 7 are presentation/infra gaps (shared with every content row). The real asset exists in UE and the test gate passes against it. Honest dispositions below; findings at the bottom.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief  
  _agent: Designer · **produced**: a common, one-handed iron sword — the baseline melee weapon every new character starts with. Fantasy = "reliable, unremarkable, sharp."_
- [x] 2. Data Schema Definition  
  _agent: Designer · **reuse** `UARPGItemDefinition` (UPrimaryDataAsset, full schema already exists). Mapped item-1 → DisplayName/Description/Type=Weapon/Rarity=Common/MaxStackSize=1/BaseValue=12/Weight=3.5/RequiredLevel=1/AllowedSlots=[Weapon]/OnEquipEffect. No new fields invented._
- [x] 3. Stat & Rules Logic  
  _agent: Designer · **produced**: `UGE_Equip_IronLongsword` (C++) — Infinite GameplayEffect, +15 AttackPower additive, removed on unequip via the inventory component's active handle. Carries the weapon's offense (UARPGItemDefinition has no intrinsic damage field)._
- [~] 4. Economy & Rarity Balancing  
  _agent: Balancer · **reuse/partial**: Common ⇒ 0 affixes (`ARPGAffixRoller`); BaseValue 12 reads as modest tier-1 value; `IRON_LONGSWORD_RADAR` is the app-side power-budget reference (Offense 0.35). ⚠️ the damage **range** (12-18) and attack **speed** (1.2s) are not modeled on the definition — squeezed into a single +15 AttackPower avg (see gaps)._
- [ ] 5. Localization Strings  
  _agent: Writer · ⚠️ **GAP** (same as Fireball): no localization/string-table system. DisplayName/Description are inline FText. Keys would be `Item_IronLongsword_Name`/`_Desc`._
- [ ] 6. Icon 2D Art  
  _agent: Concept2D · ⚠️ **partial** + 🔗: producible via the Leonardo 2D dispatch and bound to the `icon-sets` presentation catalog. Not run this session; `Icon` left null._
- [ ] 7. 3D Mesh Generation  
  _agent: 3DGen · ⚠️ **GAP** + 🔗: no item-mesh pipeline. The Blender MCP path (🔗 `props`) is the candidate. `WorldMesh` left null._
- [ ] 8. Material & Texture Pass  
  _agent: Rigger/VFX · ⚠️ **GAP** + 🔗 `materials`: depends on the mesh; no item-material authoring yet._
- [ ] 9. Pickup / Equip Animation  
  _agent: Animator · ⚠️ **GAP**: no item/equip-animation pipeline (same class of gap as ability animation)._
- [ ] 10. VFX (idle, equip, use)  
  _agent: VFX · ⚠️ **GAP** + 🔗 `vfx`: a common sword needs none, but the bind-to-presentation pattern applies for enchanted variants._
- [ ] 11. SFX (pickup, use, equip)  
  _agent: Audio · ⚠️ **GAP** + 🔗 `audio`: `import_audio_set` could import a swing/pickup/equip SFX set bound to the `audio` catalog. Not authored._
- [~] 12. Inventory UI Integration  
  _agent: Designer · **reuse/partial**: `UARPGInventoryComponent` + equipment slots exist; `AllowedSlots=[Weapon]` + `OnEquipEffect` make the item equip-ready at the config level. Runtime equip/inventory UI not exercised this session (config gate only — see gaps)._
- [x] 13. Tooltip & Compare View  
  _agent: Concept2D/UI · **reuse**: the app-side `ItemCatalog` already renders the Iron Longsword's stats/tooltip/compare (`COMPARABLE_ITEMS`, `IRON_LONGSWORD_RADAR`). In-engine HUD tooltip 🔗 `hud-elements`._
- [x] 14. Test Gate (rules + visuals)  
  _agent: QA · **produced**: strengthened `AVSItemsDefinitionsTest` (`Source/PoF/Test/Items/`) now LOADS the real `DA_IronLongsword` and asserts its canonical fields + that `OnEquipEffect` grants +15 AttackPower. Runs headless: `Project.Functional Tests.Maps.VSItems.VSItemsDefinitionsTest` → **Result={Success}** (19/19 assertions)._
- [x] 15. UE Asset Packaging  
  _agent: Packager · **produced**: `/Game/Data/Items/DA_IronLongsword.uasset` + `UGE_Equip_IronLongsword.{h,cpp}` + reusable `Content/Python/author_items.py` — committed to `pof-exp` (`70f35fe`)._

## PoF integration
- **Catalog:** `items` (already registered); entity `id: item-1`.
- **Reuse:** `UARPGItemDefinition` schema · `UARPGInventoryComponent`/affix/loot systems · `UARPGAttributeSet.AttackPower` + `UARPGDamageExecution` · `GE_Buff_WarCry` pattern (equip-GE template) · the registered `ITEMS_RECIPE` · `VSItems.umap` + `place_items_test.py`.
- **New, reusable:** `author_items.py` (the items catalog's missing authoring engine — table-driven, idempotent load-or-create; ready to author the other item rows).
- **Gaps:** damage-range/attack-speed schema fields, item equip-GE codegen, icon/mesh/material/animation/SFX pipelines, localization, runtime equip test harness.

## Cross-catalog dependencies
- **`loot-tables` ← Item**: `DA_IronLongsword` is now a real drop candidate the loot-table row can reference (producer → consumer).
- **`spellbook`/GAS codegen ↔ Item**: an item's offense is a GameplayEffect, exactly like an ability's — the same GE-generation engine should serve both.
- **`status-effects` ↔ Item**: the +AttackPower equip GE is also a "buff" status effect (same UE artifact, two catalogs).
- **Presentation:** `icon-sets` (icon), `materials` (texture), `audio` (SFX), `hud-elements` (tooltip), 3D-mesh via `props`/Blender.

## Session Findings
### Cross-catalog opportunities
- **An item's offense is a GameplayEffect — items and abilities share the GE engine.** `UGE_Equip_IronLongsword` (+15 AttackPower) is structurally identical to an ability's effect GE. The B3 `generate-gas-effects` codegen that emits ability GEs should be generalized to emit **item equip GEs**, so the items row reuses the same generation engine instead of hand-writing a C++ class per weapon.
- **An equip buff IS a `status-effects` entry** — the same UE artifact viewed from two catalogs (echoes the Fireball GE = status-effect finding). Generating an item's equip GE can seed the `status-effects` "buff" catalog too.
- **`items` → `loot-tables` is a real producer→consumer edge.** Now that `DA_IronLongsword` exists as a `UARPGItemDefinition`, the loot-table row can reference it as a weighted drop — the first concrete item a loot table can point at.
- **The presentation steps (Icon/Mesh/Material/SFX/VFX/Tooltip) bind to shared catalogs**, same as Fireball: produce `icon-sets`/`materials`/`audio`/`hud-elements` entries once and reference them; don't author per-item. 3D mesh is the one genuinely new pipeline (shared with `props`/Blender).

### Gaps / blockers for future sessions
- **The items gate validated a transient fixture, not a real asset — FIXED this session.** `AVSItemsDefinitionsTest` now loads `/Game/Data/Items/DA_IronLongsword` and asserts its canonical fields + the equip GE's +15 AttackPower. This is the items analog of the Fireball "fixture, not the entity" fix; future item rows extend the same gate.
- **No item authoring script existed — FIXED this session.** `Content/Python/author_items.py` is table-driven and idempotent (load-or-create, never delete+create — `create_asset` won't recreate a just-deleted path in-session). Ready to author the remaining item rows by adding spec dicts.
- **`UARPGItemDefinition` has no damage-range or attack-speed fields.** The seeded 12-18 damage + 1.2s speed collapse to a single +15 AttackPower equip GE — variance and speed are lost. **Fix:** add `MinDamage/MaxDamage` + `AttackSpeed` to the definition (and an `AttackSpeed` attribute — none exists on `UARPGAttributeSet`), or model weapons via richer equip GEs.
- **Per-item C++ equip GEs don't scale.** Hand-writing `UGE_Equip_<Weapon>` for 30+ items is untenable — generalize the GAS codegen (above) or use one generic SetByCaller equip GE whose magnitude the definition supplies.
- **Python cannot set `FGameplayTag.TagName` (read-only).** `ItemTags` was left empty (non-gated, non-functional). Needs a native tag helper or a C++ default. Minor.
- **No lightweight per-asset runtime test harness** (same gap Fireball flagged). The gate is a CONFIG gate — it does not assert "equip → AttackPower actually rises on a live ASC." A reusable "equip item on a dummy ASC, assert attribute delta" fixture would let every item/ability row gate runtime behaviour.
- **Icon / 3D-mesh / material / animation / SFX / localization pipelines are absent** — the same presentation/infra gaps Fireball logged, now confirmed for items. The 3D-mesh pipeline is the highest-value new one (every equippable + prop needs it).
