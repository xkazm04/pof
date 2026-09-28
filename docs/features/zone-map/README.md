# Zone Map Pipeline

> Catalog ID `zone-map` · Category Core / Existing · 12 steps

**Purpose.** An explorable region that HOSTS combat encounters (arena slices) and drives encounter density + loot ilvl through its `areaLevel`. Per ARPG-LAWS §11 + canon `arpg-area-level`, `areaLevel` is the master scalar — monster level and dropped-item ilvl derive from it; per-enemy numbers are never hand-tuned per area. The reference entity is the **Ashen Forest**, realised as a baked monolithic `/Game/Maps/AshenForest.umap` (committed to pof-exp @1ec6353) with MOVABLE lighting to avoid a Lightmass bake in headless CI.

## Target / starter entity
- **Ashen Forest** (`zone-z-ashen` — seeded from `ZONES` via `zoneToEntry`) — a ~44 m scorched clearing at areaLevel 5 (levelRange 3–5), the leveling bridge between Whisper Woods and Bandit Camp. Hosts the Ravaged Courtyard arena, ~38 enemies across 5 sectors, loot at ilvl 5.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Macro Layout & POIs | rules | — | L0 · `fieldsPopulated(sectors/pois/navigationContract)` |
| 3 | Area Level & Density | rules | — | L0 · `fieldsPopulated(areaLevel/monsterLevel/lootIlvl/totalEnemies)`; L2 `cppSymbolExists(AARPGEncounterVolume)` |
| 4 | Encounter Placement | rules | — | L0 · `fieldsPopulated(hostedArena/packPlacements/wiringContract)`; L2 `cppSymbolExists(ASpawnVolume)` |
| 5 | Streaming / LOD | rules | — | L0 · `fieldsPopulated(budgets/lodStrategy)` |
| 6 | 3D / Biome | gallery | `SM_CharredTrunk/AshenRock/EmberPit` | L1 · `selected(biome)` |
| 7 | Material | rules | `MI_<slug>_Ground/Trunk` | L0 · `fieldsPopulated(surfaceFamily/instances/wiringContract)` |
| 8 | Ambient & Music | rules | — | L0 · `fieldsPopulated(ambient/music/wiringContract)` |
| 9 | Minimap UI | rules | `WBP_MinimapZone` | L0 · `fieldsPopulated(discoveryPct/fastTravelNode/hudBinding)` |
| 10 | Icon 2D Art | gallery | `T_<slug>_ZoneIcon_*` | L1 · `selected` |
| 11 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSZoneTest)` |
| 12 | UE Packaging | manifest | `AshenForest.umap`, `DT_ZoneMap::zone-z-ashen`, `AARPGEncounterVolume`, `ASpawnVolume ×5`, `MI_<slug>_*`, `T_<slug>_ZoneIcon` | L0 · `minCount(assets, 3)`; L2 `cppSymbolExists(AARPGEncounterVolume, ASpawnVolume)` |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `AARPGEncounterVolume` (areaLevel source, propagates monsterLevel + lootIlvl), `ASpawnVolume` (wave orchestration). Wiring contracts also reference `UARPGLootDropComponent` (ilvl = areaLevel on kill) and `AARPGVegetationScatter` (future HISM scatter path).
- **Assets:** `/Game/Maps/AshenForest.umap` (baked, reload-verified: DirLight 1 / SkyLight 1 / PPV 1 / StaticMeshes 30), `DT_ZoneMap` row, `MI_<slug>_Ground/Trunk` (weathered-stone instances), `WBP_MinimapZone`.
- **Runtime test:** `VSZoneTest` (level loads without crash, bonfire reachable, Brutes spawn at monsterLevel 5, arena waves trigger, loot ilvl 5, ambient/music transitions, minimap discovery updates).
- **Cross-catalog links:** `combat-map::arena-ravaged-courtyard` (hosted arena), `bestiary::bestiary-brute` (encounter packs), `materials::mat-weathered-stone` (surface family), `ambient::ambient-forest-day` (zone soundscape), `music::music-combat-a` (combat music), `icon-sets::iconset-abilities` (icon family).

## Acceptance profile
**L0 (data)** for every authoring step (layout/density/placement/streaming/material/audio/minimap), **L1 (human selection)** for the biome and icon galleries, **L2 (static UE source)** on Area-Level-&-Density, Encounter Placement, and UE Packaging (`cppSymbolExists(AARPGEncounterVolume, ASpawnVolume)`), plus one **L3 runtime-deferred** gate (`VSZoneTest`). Several wiring contracts also cite an **L0** check that `ZONE_EDGES`/`ZONE_POIS`/`FAST_TRAVEL_NODES` seed entries are present, and the Material step cites an **L4 visual-deferred** "burned earth" RHI+Gemini render read. Config-complete = all L0/L1/L2 steps pass with the runtime/visual gates `deferred`.

## Status & notes
`areaLevel 5` drives the entire chain (monsterLevel 5, loot ilvl 5, life ×1.26 / damage ×1.20 per §6c). Documented gaps surfaced in the produce code: NavMesh (RecastNavMesh) bake + `ProcGenWalkTest` are unbuilt — the config gate proves lighting/PP, not traversal (plan.md §Finding-Nav); World Partition / OFPA / HLOD are not wired (single monolithic .umap, plan.md §4); HISM instancing for scatter is still individually-placed StaticMeshActors. Streaming budgets come from `STREAMING_BUDGETS` in `sub_world/_shared/data.ts`.

## World analytics model
Playtime figures for zones (per-zone estimate, cumulative critical/all path, interest curve, lever sizing) come from one pure, IO-free module: `src/lib/world/world-model.ts`.
- **Input:** `WorldModel { zones, edges, enemiesByZoneId, bossPhasesByZoneId, explorationSecByZoneId? }`, keyed by zone id, never by row index. The static world is `STATIC_WORLD` in `sub_world/_shared/data.ts`, built from `ZONES`, `ZONE_EDGES`, `ENEMY_DENSITY_BY_ZONE_ID` and `BOSS_ARENAS`. `worldFromZones(zones)` adapts any zone list whose topology is in `connections` (a `generateZoneGraph` candidate, catalog zone-map entries). Each edge becomes critical with a 0 s transition, and no enemy data is attached.
- **Cost table:** `DEFAULT_PLAYTIME_COSTS` (8 s/enemy, 90 s/boss phase, exploration 120/300/180 s by hub/combat/boss) is the only copy. `computeZonePlaytime`, `computeCumulativePath`, `suggestLevers` and `buildInterestPoints` all take an optional `Partial<PlaytimeCosts>`.
- **Unmeasured ≠ zero:** a zone with no density entry reports `enemyCount: null` and `combatMeasured: false`. The five KOTOR zones have never been authored. The generator panel labels its estimate "combat not measured".
- **Path walk:** `computeCumulativePath(world, mode)` starts at every hub, falling back to zones with no incoming edge. A DFS drops back edges, so bidirectional or cyclic graphs terminate and each zone is priced once. The longest arrival is then relaxed in topological order. `CRITICAL_PATH`, `ALL_PATHS` and `ZONE_PLAYTIME` in `data.ts` are this model's output for `STATIC_WORLD`.
- **Tests:** `src/__tests__/lib/world/world-model.test.ts`.
- **What-if scenarios:** `src/lib/world/playtime-scenario.ts`. A `WorldLever { zoneId, kind, amount }` edits one `WorldModel` field of one zone: `enemies` → `enemiesByZoneId`, `bossPhases` → `bossPhasesByZoneId`, `exploration` / `sideBeat` → `explorationSecByZoneId`. `applyLevers(world, levers)` is pure and returns the input itself when no lever is applied. `scenarioReducer` (toggle / reset) is the Try / Undo / Reset state, held in a `useReducer` in `sub_world/index.tsx`. The scenario world goes to all four playtime panels. `suggestLevers` returns these structured levers, and `LeverList` renders each one with a Try / Undo button.
- **Per-zone budgets:** `allocateZoneBudgets` (`playtime/playtime-target.ts`) splits the path target by level span (`levelMax − levelMin + 1`). It splits only over the `bindingChain`, the zones whose time sets the path total, so a parallel branch or the disconnected KOTOR sub-world does not dilute it. A budget never depends on the zone's current time, which lets one zone be flagged over while the others are under or on. The earlier fair-share split flagged every zone the same way at every target. Levers are sized against the baseline, so a lever keeps its Undo while it is applied. Tests: `src/__tests__/lib/world/playtime-scenario.test.ts`, `src/__tests__/components/sub_world/playtime-what-if.test.tsx`.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
