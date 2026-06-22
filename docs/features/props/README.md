# Props Pipeline

> Catalog ID `props` · Category Game Assets · `models` module · 11 steps · Tracks: art-3d, vfx, audio, test

**Purpose.** Authors interactable / destructible world objects in PoF. The starter is the Reinforced Crate — a loot container that can be opened (intact) or destroyed (Chaos fracture) to spill its contents. Wires into UE5 via `AARPGDestructibleActor` (the Chaos-backed base class) with a `UARPGLootDropComponent` that, on the `OnBroken` delegate, executes the `loot-tables::lt-Brute` drop roll at ilvl = areaLevel. The prop never authors item stats inline (canon `proj-links`); per ARPG-LAWS §7 the loot table sets weights and ilvl.

## Target / starter entity
- **Reinforced Crate** (`prop-reinforced-crate`) — A destructible loot container: iron-banded hardwood placed alongside enemy packs in dungeons/arenas, opened or struck to yield a single `lt-Brute` roll at the current area level.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Interaction | rules | — | L0 · `fieldsPopulated(interaction: interactType/triggerCondition/prompt/healthThreshold)` |
| 3 | 3D & LODs | gallery | `SM_<name>`, `GC_<name>` | L1 · `selected` |
| 4 | Collision & Physics | rules | — | L0 · `fieldsPopulated(physics: collisionPreset/massKg/chaosEnabled)` |
| 5 | Material | rules | `MI_<name>` | L0 · `fieldsPopulated(material: instance/parentMaterial/parameters)` |
| 6 | Destruction States | rules | — | L0 · `fieldsPopulated(destructionStates: intact/damaged/destroyed)` |
| 7 | Loot on Destroy | rules | — | L0 · `minCount(links, ≥1)` + L2 static |
| 8 | VFX / Audio | rules | — | L0 · `fieldsPopulated(vfxAudio: destructionVfx/openAudio/impactAudio)` |
| 9 | Icon 2D Art | gallery | `T_<name>_Icon` | L1 · `selected` |
| 10 | Test Gate | checklist | — | L3 · `runtimeDeferred(VSPropInteractTest)` |
| 11 | UE Packaging | manifest | `SM_`, `GC_`, `BP_`, `MI_`, `A_<name>_Open`, `NS_<name>_Destroy` | L0 · `minCount(assets, ≥4)` + L2 statics |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UARPGLootDropComponent` (step 7, `Source/PoF/Loot/`), `AARPGDestructibleActor` + `UARPGLootDropComponent` (step 11, `Source/PoF/Physics/` + `Source/PoF/Loot/`). `BP_ReinforcedCrate` extends `AARPGDestructibleActor`; Chaos `GeometryCollection` (`GC_ReinforcedCrate`) authored separately from the `SM` LOD0 source.
- **DataTables**: `DT_LootTables` (the `lt-Brute` binding); material parent `M_ARPG_Surface_Master` (`MI` is a `MaterialInstanceConstant`, canon art-material).
- **Runtime test** (`runtimeDeferred`): `VSPropInteractTest` — destroy → drops loot + spawns debris in PIE.
- **Cross-catalog `links`**: `loot-tables::lt-Brute` (loot-on-destroy, steps 7/11), `materials::mat-weathered-stone` (surface-family, steps 5/11), `vfx::vfx-fire-impact` (destruction VFX / `NS_FireImpactBurst`, steps 8/11), `icon-sets::iconset-abilities` (icon-family, steps 9/11).

## Acceptance profile
Uses L0 (data: brief, interaction, physics, material, destruction states, vfx/audio, link counts, asset counts), L1 (gallery selections: mesh, icon), L2 (static UE source: `AARPGDestructibleActor`, `UARPGLootDropComponent`), and one L3 deferred gate (`VSPropInteractTest`). L4 visual is not used. "Config-complete" means all data/selection/static steps reach `pass`, and the Test Gate terminates `deferred` (its reason: the destroy → `OnBroken` → fracture + VFX + `ExecuteDrop` chain is verified in PIE).

## Status & notes
11-step pipeline spanning environment art, physics, and loot. Obeys ARPG-LAWS §7 (loot table sets weights + ilvl = areaLevel; the prop never self-assigns ilvl or item stats) and the `vfx-budget` / `art-3d` / `art-material` canon rules (Nanite LOD0, restrained Niagara fired from AnimNotify not BeginPlay, MI over a project master never a standalone master). Bridge-driven runtime behavior (Chaos fracture, debris physics, drop resolution) is deferred to PIE via `VSPropInteractTest`. Notable detail: world-object HP (crate baseline 80) lives in BP defaults, not `DT_AttributeDefaults`.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
