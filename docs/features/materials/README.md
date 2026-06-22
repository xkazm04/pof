# Materials Pipeline

> Catalog ID `materials` · Category Core / Existing · 10 steps

**Purpose.** Authors a PBR environment surface as a `MaterialInstanceConstant` (`MI_<slug>`) over the shared master `M_ARPG_Surface_Master` — **never a new master material** (art-material canon: "reuse over re-author"). Three maps are required on every surface: Albedo, Normal, ORM. Exposed MI parameters follow the master's interface (`BaseColorTint`, `TilingScale`, `DetailTiling`, `WearAmount`, `RoughnessMultiplier`, `EmissiveStrength`). Registered in `FARPGSurfaceMaterialDef` (`ARPGEnvironmentMaterialSet.h`). Wiring: props / zone-map / combat-map mesh components reference the MI by path; the shared master shader graph is the authority.

## Target / starter entity
- **Weathered Stone** (`mat-weathered-stone`, Surfaces / Stone — the only seeded materials entity) — a `MaterialInstanceConstant` of `M_ARPG_Surface_Master`, base color `#8a857a`, built + config-gated by `Content/Python/build_weathered_stone.py` (the app is the SYNC SOURCE for the parameter set). The headless build + gate has already passed (`[gate] RESULT=PASS`).

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Surface Type | schema | — | L0 · `fieldsPopulated(class/physicsPreset/footstepCue/decalResponse)` |
| 3 | Shader Graph | rules | `M_ARPG_Surface_Master` | L0 · `fieldsPopulated(masterPath/exposedPins/restrictions)` |
| 4 | Parameters | schema | — | L0 · `fieldsPopulated(BaseColorTint/TilingScale/WearAmount/RoughnessMultiplier/EmissiveStrength)` |
| 5 | Maps | gallery | `T_<slug>_albedo/normal/orm` | L1 · `selected` |
| 6 | LOD/Perf Budget | balance | — | L0 · `withinPercent(instructionCount, 200, ±20%)` |
| 7 | Instance Library | rules | `MI_<slug>` | L0 · `fieldsPopulated(instancePath/parentMaterial/recipe)` |
| 8 | Icon 2D Art | gallery | `T_<slug>_Icon` | L1 · `selected` |
| 9 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSMasterMaterialInstanceTest)` |
| 10 | UE Packaging | manifest | `MI_<slug>`, `T_<slug>_albedo/normal/orm`, `DA_<slug>_MaterialSpec` | L0 · inline `minCount(assets, 3)`; L2 `cppSymbolExists(FARPGSurfaceMaterialDef)` |

## UE wiring
- **C++ symbol** (`cppSymbolExists`): `FARPGSurfaceMaterialDef` (surface-material definition struct in `ARPGEnvironmentMaterialSet.h`).
- **Assets:** `M_ARPG_Surface_Master` (shared master — the only master), `MI_<slug>` instance, `T_<slug>_{albedo,normal,orm}` texture set (Albedo sRGB ON, ORM Linear/non-sRGB, Normal DX), `DA_<slug>_MaterialSpec`.
- **Recipe** (named in produce): `MATERIALS_RECIPE` (`src/lib/catalog/recipe.ts`) — author-python (`build_<slug>.py` mirrors app data into the MI) → verify (config gate checks asset/parameter structure + non-sRGB ORM invariant). Every materials entity is a one-script, self-gating generator.
- **Runtime test:** `VSMasterMaterialInstanceTest` (MI compiles in SM5, parent is `M_ARPG_Surface_Master`, all three texture slots sample non-null, PhysicalMaterial slot set).
- **Cross-catalog links:** `icon-sets::iconset-abilities` (swatch-icon family). Consumer catalogs (props / zone-map / combat-map) reference `MI_<slug>` by path via mesh material slots.

## Acceptance profile
**L0 (data)** for brief/surface-type/shader-graph/parameters/perf-budget/instance-library (the perf-budget step gates shader instruction count `withinPercent(200, ±20%)`), **L1 (human selection)** for the Maps and Icon galleries, **L2 (static UE source)** on UE Packaging (`cppSymbolExists(FARPGSurfaceMaterialDef)`), plus one **L3 runtime-deferred** gate (`VSMasterMaterialInstanceTest`). The UE Packaging step uses a bespoke inline accept (≥3 assets, tier L0). Config-complete = all L0/L1/L2 steps pass and the editor-compile test sits `deferred` until a UE editor runner executes it.

## Status & notes
The single hard law: never author a sibling master — all surfaces are parameter sets over `M_ARPG_Surface_Master` (a new shared pin requires a chassis-change ticket). The perf budget uses the master's ~180 SM5 instruction baseline (a correct MI cannot exceed it); GPU-ms measurement requires an RHI build and is deferred (plan.md §12 — config gate ≠ render proof). All ~30 planned material entities follow the same recipe (new `MaterialSpec` in `seed-materials.ts` → `build_<slug>.py` → config gate). The app is the authoritative SYNC SOURCE; the MI is never hand-authored in the UE editor.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
