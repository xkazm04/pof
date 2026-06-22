# Icon Sets Pipeline

> Catalog ID `icon-sets` · Category UI · `ui-hud` module · 7 steps · Tracks: art-2d, test

**Purpose.** Defines the multi-stage authoring process for a coherent ARPG icon family: family brief + taxonomy → art selection → accessibility checks → atlas packaging. Per canon `art-icon-family`, icons within a set share silhouette weight, line treatment, palette, rarity-frame, and light direction; per `art-icons` they are 256 px, 3/4 view, strong silhouette, rarity-framed, lit from the upper-left. The atlas wires into `UHUDWidget` / `UW_SpellBar` / `UW_StatusRow` via a single `T_<Slug>_Atlas` texture sampled in `MI_HUDIconSheet` plus a `FIconSetRow` DataTable row.

## Target / starter entity
- **Ability Icons** (`iconset-abilities`, Abilities) — a coherent ability-icon family.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Family Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Taxonomy | rules | — | L0 · `fieldsPopulated(members/naming/count)` |
| 3 | Icon 2D Art | gallery | `T_<slug>_Atlas` | L1 · `selected` |
| 4 | Accessibility | checklist | — | L0 · `minCount(checks, 3)` |
| 5 | Atlas | rules | `T_<slug>_Atlas` | L0 · `fieldsPopulated(texture/packing/slots)` |
| 6 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSIconSetAtlasTest)` |
| 7 | UE Packaging | manifest | `T_<slug>_Atlas`, `MI_HUDIconSheet_<slug>`, `DT_IconSets::<slug>` | L0 + L2 · `minCount(assets, 3)`; `cppSymbolExists(FIconSetRow)` + `seedRowPresent(seed_icon_sets.py)` |

## UE wiring
- **C++ symbol** (`cppSymbolExists`): `FIconSetRow` (icon-set row struct, holds `AtlasU`/`AtlasV` cell indices).
- **Assets:** `T_<Slug>_Atlas` (4096×4096, 256 px cells, 16×16 grid, BC7), `MI_HUDIconSheet` master-material instance, `DT_IconSets` DataTable. Widget UV = `vec2(AtlasU, AtlasV)/16.0 + uv_in_cell/16.0`.
- **Seed script** (`seedRowPresent`): `seed_icon_sets.py` (row count ≥224).
- **Runtime test:** `VSIconSetAtlasTest` (all widget slots resolve valid UVs, no missing-row logs in PIE; contrast + 32 px legibility).
- **Cross-catalog dependencies:** `hud-elements` (UHUDWidget/UW_SpellBar/UW_StatusRow declare the icon material slot), `items` (`DT_Items.IconKey`), `spellbook` (`DT_GeneratedAbilities.IconKey`), `status-effects` (`State.*` tag), `currencies` (`DT_Currencies.IconKey`).

## Acceptance profile
**L0 (data)** for the brief/taxonomy/accessibility/atlas steps, **L1 (human selection)** for the Icon 2D Art gallery, **L2 (static UE source)** on UE Packaging (`cppSymbolExists` + `seedRowPresent`), and one **L3 runtime-deferred** gate (`VSIconSetAtlasTest`). Config-complete = all data/static steps pass and the atlas-import/runtime test sits `deferred` with a reason until a UE bridge runs.

## Status & notes
Compact 7-step authoring pipeline. Taxonomy spans Item (64), Ability (64), Status (64), Currency (32) = 224 of 256 atlas cells (32 reserved). Single-source-of-truth atlas: no icon is a separate texture — all go through the atlas UV lookup. This catalog is upstream of items/spellbook/status-effects/currencies via shared `IconCategory_Name` → `DT_IconSets` row keys.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
