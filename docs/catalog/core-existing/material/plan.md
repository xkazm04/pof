# Material — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `materials` (existing) · **Description:** Shader/material definition with parameters and variants.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Weathered Stone** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
Session 2026-05-25 (Phase C row). Built `MI_WeatheredStone` as a `MaterialInstanceConstant`
of the shared master `M_ARPG_Surface_Master` — **reuse over re-author** throughout.
- [x] 1. Concept Brief & Reference  
  _agent: Designer · reuse: existing arena stone textures as reference; aged masonry surface._
- [x] 2. Surface Type Classification  
  _agent: Designer · done: `surfaceType: 'stone'` on the new `MaterialSpec`._
- [x] 3. Shader Logic Graph  
  _agent: Designer · REUSE: inherits the `M_ARPG_Surface_Master` graph — no new graph authored._
- [x] 4. Parameter Exposure  
  _agent: Designer · done: `BaseColorTint` + `TilingScale`/`DetailTiling`/`EmissiveStrength` (exposed by the master)._
- [x] 5. Texture Maps (albedo, normal, ORM, etc.)  
  _agent: Concept2D · REUSE: `/Game/ArenaBuild/Textures/T_wall_{albedo,normal,rough}`. gap: no stone-specific gen._
- [ ] 6. Substance / Procedural Variants  
  _agent: — · GAP: no Substance/procedural-variant pipeline in PoF._
- [~] 7. LOD & Performance Budget  
  _agent: — · PARTIAL: instance inherits the master's shader cost; no per-material LOD/budget tool exists._
- [x] 8. Tiling / UV Strategy  
  _agent: Designer · done: `TilingScale=1.0`, `DetailTiling=8.0` over the master's TexCoord×scale driver._
- [x] 9. Decal & Detail Pass  
  _agent: Designer · done: `DetailNormal` assigned (angle-corrected micro-breakup — the master path arena MIs leave unset). No decals (no decal system)._
- [ ] 10. Wetness / Weather Variants  
  _agent: — · GAP: the master has no wetness/porosity input; a wetness variant needs a master extension._
- [x] 11. Material Instance Library  
  _agent: Designer · done: `MI_WeatheredStone` + the reusable `MaterialSpec` schema + `MATERIALS_RECIPE` make the library repeatable._
- [ ] 12. Visual QA on Reference Meshes  
  _agent: QA · GAP: headless SM5 shader compile falls back to Default Material (project-wide, master included) — needs an RHI/screenshot Gemini check._
- [x] 13. Performance / Test Gate  
  _agent: QA · done (config gate): `build_weathered_stone.py` self-validates → `[gate] RESULT=PASS`. GPU perf measurement is the gap above._
- [x] 14. UE Material Packaging  
  _agent: Packager · done: `/Game/Materials/MI_WeatheredStone.uasset` saved + gated; committed to pof-exp._

## PoF integration
- **Catalog:** `materials` (already registered). First real entity lifted in: `mat-weathered-stone` (Phase 8 substrate → first data lift).
- **Data schema:** new `MaterialSpec` (`src/lib/catalog/types.ts`) — surfaceType, parent/instance paths, texture set, `baseColorTint`, scalar overrides. The app is the **SYNC SOURCE**; `Content/Python/build_weathered_stone.py` mirrors it.
- **Recipe:** new `MATERIALS_RECIPE` (`src/lib/catalog/recipe.ts`) — `author-python → verify`; carries the reuse-the-master + non-sRGB + config-gate gotchas. Makes the other ~29 material entities repeatable.
- **Test gate:** the builder is its own gate (asset/parameter invariants + non-sRGB), judged by the `-abslog`.

## Cross-catalog dependencies
- **Consumes** the shared surface master `M_ARPG_Surface_Master` (textures branch) and the arena `T_wall_*` textures (zone/prop art) — does not own them.
- **Produces** a surface other rows can bind: `props` / `zone-map` / `combat-map` meshes can reference `MI_WeatheredStone` for stone surfaces.

## Session Findings
### Cross-catalog opportunities
- **A shared "surface master + instance-per-entity" pattern is the materials analog of the GAS-codegen engine.** Every `materials` row is a parameter set over `M_ARPG_Surface_Master`; the new `MaterialSpec` + `MATERIALS_RECIPE` turn that into a one-script, self-gating generator. Material CLIs should author instances, never new masters.
- **Material instances are the binding surface for `props` / `zone-map` / `combat-map`.** Those rows should reference an existing `materials` entity (a `CatalogLink role:'material'`) rather than author one-off materials — mirrors the presentation-catalog binding convention.
- **The arena `T_wall_*`/`T_floor_*` stone textures are a reusable PBR set** for any stone/masonry entity; no need to regen until a bespoke look is required.
### Gaps / blockers for future sessions
- **Config gate ≠ render proof.** Headless SM5 shader compile warns "Default Material will be used" for `M_ARPG_Surface_Master` and all its instances (and the pre-existing `M_Arena_*`) — NOT introduced by Weathered Stone. The config gate verifies asset/parameter structure only; a visual gate (RHI screenshot + Gemini) is the missing half for every material/visual row. _(High priority — shared infra.)_
- **No offline way to record a catalog lifecycle transition.** The asset + gate are done, but advancing `mat-weathered-stone` to `verified` in Live State requires the Next.js server + `/api/catalog`; there's no CLI/offline path. Static seeds must stay `planned`. _(Affects every catalog CLI.)_
- **Master has no wetness/weather inputs** (step 10) and **no Substance/procedural-variant pipeline** (step 6) — both need new master features or a procedural-texture path.
- **No per-material LOD/perf budget tooling** (step 7) and **no decal system** (step 9 decals).
