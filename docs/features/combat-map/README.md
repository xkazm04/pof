# Combat Map Pipeline

> Catalog ID `combat-map` · Category Core / Existing · 12 steps

**Purpose.** Represents a tactical encounter arena entity — the **Ravaged Courtyard** Arena Slice, a 20 m scorched Sith-temple courtyard. Obeys ARPG-LAWS §6/§11 + canon `arpg-area-level`: `areaLevel` is the only master scalar (`monsterLevel = areaLevel`, loot ilvl derives from it); wave composition uses real seeded bestiary archetypes; a hazard is a GE (`AARPGEnvironmentalHazard` applies `GE_Hazard_FireFloor` via SetByCaller). The entire runtime arena stack (`AARPGEncounterArena` + `ASpawnVolume` + `AARPGCoverPoint` + `AARPGEnvironmentalHazard`) already exists.

## Target / starter entity
- **Ravaged Courtyard** (`arena-ravaged-courtyard`, Combat Map / Arenas — seeded from `ARENA_SLICES`) — two kill-gated waves (Kath Hounds → Mandalorian Warriors) over a fire-floor centre, four corner pillars for cover.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Encounter Layout | rules | — | L0 · `fieldsPopulated(extentCm/elevated/highGround/tacticalPoints/coverPoints)`; L2 `cppSymbolExists(AARPGEncounterArena)` |
| 3 | Waves & Spawns | rules | — | L0 · `fieldsPopulated(areaLevel/waveCount/waveDetails)` |
| 4 | Win/Loss Rules | rules | — | L0 · `fieldsPopulated(winCondition/lossCondition/failSafe)` |
| 5 | Hazards | rules | — | L0 · `fieldsPopulated(hazardList/wiringContract)` |
| 6 | Balance | balance | — | L0 · `withinPercent(derivedThreatScore, 100, ±10%)` |
| 7 | 3D / Terrain | gallery | `SM_<slug>_Floor/Wall/Pillar` | L1 · `selected(mesh)` |
| 8 | Material | rules | `MI_WeatheredStone_Floor/Wall/Pillar` | L0 · `minCount(links, 1)` |
| 9 | Ambient / Audio | rules | — | L0 · `minLength(audio, ≥100)` |
| 10 | Icon 2D Art | gallery | `T_<slug>_Icon_A..D` | L1 · `selected` |
| 11 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSArenaSliceRulesTest)` |
| 12 | UE Packaging | manifest | `AARPGEncounterArena`, `ASpawnVolume`, `AARPGCoverPoint ×4`, `AARPGEnvironmentalHazard`, `GE_Hazard_FireFloor`, `GE_Mod_ExtraFast`, `MI_WeatheredStone_*` | L0 · `minCount(assets, 3)`; L2 `cppSymbolExists(AARPGEncounterArena)` |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `AARPGEncounterArena` (arena actor, `LevelDesign.h` — `FArenaTacticalPoint`, `EArenaTier`, `ScanArena`). Wiring contracts also reference `AARPGCoverPoint`, `ASpawnVolume` (`FSpawnWaveConfig`, `bWaitForKillsBeforeNextWave`), `AARPGEncounterVolume` (`EEncounterPosition`), `AARPGEnvironmentalHazard` (`EHazardType`, `DamageEffect`, `bAIAvoidance`).
- **Assets / GEs:** `GE_Hazard_FireFloor` (SetByCaller Fire damage, 15/tick at 1 s), `GE_Mod_ExtraFast` (Magic-tier modifier), `MI_WeatheredStone_*` instances, `build_arena.py` (20 m floor + walls + 4 pillars).
- **Runtime test:** `VSArenaSliceRulesTest` (waves fire in order, `OnAllWavesComplete` after wave 2, hazard ticks, win/loss delegates) — reuses the existing `VSArenaSetupTest` for geometry/lighting/collision.
- **Cross-catalog links:** `bestiary::bestiary-kath-hound` + `bestiary::bestiary-mandalorian-warrior` (spawns, from `KOTOR_ARCHETYPES`), `loot-tables::lt-Brute` (encounter loot), `materials::mat-weathered-stone` (surface family), `icon-sets::iconset-abilities` (icon family).

## Acceptance profile
**L0 (data)** for brief/layout/waves/win-loss/hazards/balance/material/audio, **L1 (human selection)** for the terrain and icon galleries, **L2 (static UE source)** on Encounter Layout and UE Packaging (`cppSymbolExists(AARPGEncounterArena)`), plus one **L3 runtime-deferred** gate (`VSArenaSliceRulesTest`). Config-complete = all L0/L1/L2 steps pass and the arena-rules test sits `deferred` until a live-UE runner executes it.

## Status & notes
Threat budget carries a fully worked derivation scaling wave-1 (4 Normal hounds) + wave-2 (2 Normal + 1 Magic warrior) + hazard pressure to a `derivedThreatScore` of 100 (±10% target), with an explicit §8 EHP one-shot check. Two documented gaps surfaced in the produce code: (a) no first-class WinCondition evaluator actor yet exists — Win/Loss encodes intent, runtime eval is a blocker (plan.md §15); (b) the hazard/ambient audio slots on the UE actor are unbound pending the audio catalog (plan.md §12). `areaLevel` drives the whole chain; hand-tuning per-wave numbers is explicitly forbidden.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
