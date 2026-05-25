# Zone Map — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `zone-map` (existing) · **Description:** Explorable region with POIs, navigation, and ambient systems.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Ashen Forest** — the seeded zone-map entity `id: 'z-ashen'` (combat, lvl 3–5, a scorched continuation of Whisper Woods). Drive this single entity idea → real UE asset → passing test gate.

**Status (this session = the lead / reflection vehicle for zone-map):** real artifacts produced on both sides — the zone seeds into the app catalog (validate-green) and a real `/Game/Maps/AshenForest.umap` was baked and its functional-test gate returned `Result={Success}` headless. 8/15 steps produced or reused, 4 partial, 3 are gaps. Honest dispositions below.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief & Theme
  _agent: Designer · **produced**: once-verdant eastern reach of Whisper Woods, burned by wildfire/cataclysm. Charred trunks, drifting ash, smouldering ember pits, smoke haze. Fantasy = "the green you knew, burned." Mood = desaturated greys + dull ember orange + a low dusk sun through smoke._
- [x] 2. Macro Layout & POI Plan
  _agent: Designer · **produced**: a ~44 m scorched clearing ringed by charred deadfall, central walkable clearing. POIs persisted in `ZONE_POIS` (quest ×3, treasure ×2, shrine ×1, bonfire ×1, discovery 0 %). Greybox places the ember Bonfire (point light), a Shrine, and a Treasure marker._
- [x] 3. Navigation Graph Logic
  _agent: Designer · **reuse** (app) / ⚠️ **partial** (UE): `ZONE_EDGES` = seamless from Whisper Woods (`navMeshContinuity: true` — contiguous burnt forest) + a door onward to Bandit Camp; `z2.connections` updated to mirror it. UE floor is flat/walkable but **no RecastNavMesh** is baked (the config gate doesn't need nav; runtime traversal is a gap — see #14)._
- [ ] 4. Streaming / LOD Strategy
  _agent: Designer · ⚠️ **partial/GAP**: `STREAMING_BUDGETS` + the `ASSET_FEATURES` list (Level Streaming / World Partition / HLOD) exist app-side, and `buildStreamingZonePrompt` (`src/lib/prompts/level-design.ts`) is the reusable planner. The shipped `.umap` is a single monolithic level — no World Partition / streaming wired._
- [x] 5. Encounter Density Balancing
  _agent: Balancer · **produced** (data): an `ENEMY_DENSITY_CONFIG` row (~38 enemies, on par with Whisper Woods, scaled for lvl 3–5); `ZONE_PLAYTIME` derives combat/exploration time from it. ⚠️ no enemies are spawned into the greybox — encounter placement is cross-catalog to `bestiary` (gap, see findings)._
- [ ] 6. Quest Hook Placement
  _agent: Writer · ⚠️ **partial** + 🔗: 3 quest POIs declared in `ZONE_POIS`; actual quest entities live in the `quests` catalog (cross-catalog dependency). No quest assets wired this session._
- [ ] 7. Heightmap & Sculpt
  _agent: 3DGen · ⚠️ **GAP/substituted**: no landscape heightmap — the greybox uses a flat scaled-cube floor. App-side terrain generators exist (`src/lib/visual-gen/generators/terrain.ts` — Diamond-Square/Perlin) but there is **no UE landscape-import recipe**. Candidate shared-infra._
- [x] 8. Biome Painting & Foliage
  _agent: 3DGen · **produced** (greybox) + 🔗 reuse-candidate: 26 seeded, deterministic charred trunks scattered (Python `random(SEED)`). The scale path is `scatter_biome_ue.py` + `AARPGVegetationScatter` (the `biome-scatter` dispatch → HISM instancing); the greybox uses individual `StaticMeshActor`s, fine for a clearing._
- [ ] 9. Material Library Pass
  _agent: 3DGen · ⚠️ **GAP/greybox** + 🔗: trunks/floor are untextured greybox. Bind targets are the `materials` catalog + the proven `M_Arena_*` materials + `material-configurator.ts`. Ashen read is achieved via lighting + fog + post-process instead of textures._
- [x] 10. Lighting & Time of Day
  _agent: VFX · **produced**: MOVABLE DirectionalLight (low dusk sun, warm-dim intensity 2.5) + SkyLight + an ember PointLight at the bonfire. MOVABLE so **no Lightmass bake** is needed headlessly (folder-05 lesson). Time-of-day = smoky dusk._
- [ ] 11. Ambient VFX (weather, particles)
  _agent: VFX · ⚠️ **partial** + 🔗: `ExponentialHeightFog` (ashen smoke) + an unbound `PostProcessVolume` (desaturate + warm gain + vignette + bloom) supply the ambient haze. Real particle VFX (drifting ash, embers) need **Niagara — no authoring pipeline** (gap, shared with the Fireball findings); the `vfx` presentation catalog is the bind target._
- [ ] 12. Ambient SFX & Music Zones
  _agent: Audio · ⚠️ **GAP** + 🔗: no audio authored. Bind targets — `ambient` (wind through dead trees, crackling embers) and `music` (a sombre zone theme) presentation catalogs via `presentationLink('ambient'|'music', 'z-ashen')`; `import_audio_set` is the import path._
- [x] 13. Minimap & Discovery Logic
  _agent: Designer · **reuse** (data) / ⚠️ GAP (UE): `FAST_TRAVEL_NODES` "Ashen Crossing" + `discoveryPct` + the POI discovery model exist app-side. No UE minimap/discovery widget — that is the `hud-elements` presentation catalog (cross-catalog)._
- [x] 14. Traversal Test Gate
  _agent: QA · **produced**: the baked `AshenForestSetupTest` (reuses the compiled `AVSArenaSetupTest`) asserts the zone's lighting/PP setup invariants. Ran headless: `Automation RunTests Project.Functional Tests.Maps.AshenForest` → **`Result={Success}`** (DirectionalLight + SkyLight + PostProcessVolume all present). ⚠️ a *true* traversal gate (player walks the clearing, like `ProcGenWalkTest`) needs nav + a player — a documented gap; the config gate is what was automatable **without a C++ recompile** of the shared module this session._
- [x] 15. UE World Partition Packaging
  _agent: Packager · **produced** (single `.umap`) / ⚠️ partial (no WP): `/Game/Maps/AshenForest.umap` authored, saved, reload-verified (DirLight 1 / SkyLight 1 / PPV 1 / StaticMeshes 30 / Test 1), committed to `pof-exp` (`1ec6353`). Full World Partition packaging (OFPA, grid, HLOD) is a gap — the recipe ships a monolithic `.umap`._

## PoF integration
- **Catalog:** `zone-map` (already registered); new seeded entity `id: 'z-ashen'` (appended to `ZONES` in `sub_world/_shared/data.ts`, so it auto-seeds via `seedZoneEntries`).
- **Reuse:** `ZONE_MAP_RECIPE` (author-python + verify) · `build_procgen_dungeon.py` level pattern · the compiled `AVSArenaSetupTest` gate · the `biome-scatter` / `procgen-dungeon` dispatches · `level-design.ts` prompts · the existing `ZONE_*` data model (edges/POIs/density/hazards/fast-travel/playtime — all consumed by name or by derived index).
- **Gaps:** RecastNavMesh bake, landscape/heightmap import recipe, World Partition packaging, Niagara ambient VFX, ambient/music audio, UE minimap widget, a runtime traversal/encounter gate.

## Cross-catalog dependencies
- **`bestiary`** → enemy encounter placement (the density row is balanced; spawns are bestiary archetypes placed at `ZONE_EDGES`/sector positions).
- **`quests`** → the 3 quest hooks declared in `ZONE_POIS`.
- **`vfx`** → ambient ash/ember Niagara (impact/weather). **`ambient`** + **`music`** → soundscape + zone theme. **`hud-elements`** → minimap/discovery. **`materials`** → trunk/ground material pass. All via `presentationLink(role, 'z-ashen')`.

## Session Findings
### Cross-catalog opportunities
- **A zone `.umap` is the host every other Game-Asset row gets placed into.** `bestiary` enemies, `props`, ability VFX, and quest triggers all need a level to live in — the zone-map row produces that substrate. Encounter density (#5) is already a balanced **contract for the bestiary row** (how many of which archetype per sector); a future bestiary→zone resolver can read `ENEMY_DENSITY_CONFIG` + `ZONE_EDGES` to auto-place spawns.
- **The greybox-level recipe generalizes far beyond zone-map.** `build_ashen_forest.py` (new-level → MOVABLE lights → PlayerStart → seeded scatter → atmosphere → **bake a reused compiled FunctionalTest actor** → save → reload-verify) is the reusable shape for `combat-map`, boss arenas, and any `props`/`vfx` showcase map. Factor it into a shared `build_zone_base.py` helper.
- **Reusing a compiled `AFunctionalTest` subclass as the per-section gate avoids a C++ recompile entirely** — the whole session touched only Python + a new `.umap`, never the shared `Source/` module. This is the cheapest "real test gate" pattern for every map-bearing row on the shared UE tree (no rebuild, no collision with concurrent sessions editing C++).
- **Atmosphere (fog + post-process + light colour) carries the art read in a greybox.** Ashen Forest "looks burned" with zero textures — a cheap win that lets the Material/VFX steps stay honest gaps while the asset still reads as its concept.

### Gaps / blockers for future sessions
- **No `<id>` → map-name sanitization in `ZONE_MAP_RECIPE`.** It interpolates `/Game/Maps/${entity.data.id}.umap`, which for `z-ashen` yields the hyphenated `z-ashen.umap`. This session hand-mapped it to PascalCase `AshenForest`. **Fix:** the recipe should sanitize ids to PascalCase map names (`z-ashen` → `AshenForest`) so generated scripts produce clean UE asset names. _(Low effort, affects every zone.)_
- **No NavMesh / runtime traversal gate.** The gate proves *config* (lights/PP present), not that the zone is *walkable*. A reusable nav bake + a `ProcGenWalkTest`-style "player crosses the clearing" test (the recipe text's intended `VSZone_<id>Test`) needs nav data + a player and currently a new C++ test class (recompile). _(Shared with the per-asset runtime-harness gap noted by the Fireball session — a "spawn player, assert traversal" fixture would gate every zone's runtime behaviour.)_
- **No landscape/heightmap → UE import recipe.** Terrain generators exist app-side (`terrain.ts`) but there's no path to a UE Landscape; zones are flat greybox floors until one exists. _(Blocks step 7 for every zone.)_
- **No Niagara ambient-VFX, no ambient/music audio, no UE minimap pipeline.** Steps 11/12/13's UE halves are gaps shared across every presentation-bearing catalog — candidate shared-infra investments (same list the Fireball session opened).
- **`ENEMY_DENSITY_CONFIG.cells` uses hand-indexed `row` numbers** while `rows` is derived from `ZONES`. New zones MUST be appended to the end of `ZONES` (as Ashen Forest was, row 11) or the hard-coded heatmap rows silently mis-align. _(Brittle; a name-keyed cell model would remove the footgun.)_
- **`pof-exp` push 403s for the `kazimi66` account** (same as the app repo). The UE commit (`1ec6353`) is **local-only**; the user must push. _(Was previously believed to work — corrected.)_
