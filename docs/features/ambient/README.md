# Ambient Pipeline

> Catalog ID `ambient` · Category Audio & FX · `audio` module · 10 steps · Tracks: audio, test

**Purpose.** Authors a layered environmental audio composition for a zone or scene — a continuous 2D stereo bed, 3D positional detail loops, and randomised one-shot events. The identity of the seeded soundscape is the conspicuous *absence* of living forest sound (canon `game-tone`: grim, weathered, earned). It realizes through MetaSound + Wwise (spatialization, obstruction/occlusion); a `DT_Ambient` row drives the `AAmbientSound` actor + `UAudioComponent` emitters that the level hosts.

## Target / starter entity
- **Forest Day** (`ambient-forest-day`, Outdoor) — A daytime forest soundscape (bed + one-shots); the Ashen Forest day variant consumed by `zone-map::zone-z-ashen`.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 `minLength` brief ≥ 300 chars |
| 2 | Layers | rules | — | L0 `fieldsPopulated` (bed/detailLoops/oneShots) |
| 3 | Spatialization | rules | — | L0 `fieldsPopulated` (bedStrategy/emitterContract/attenuationPreset) |
| 4 | Variants & Randomization | rules | — | L0 `fieldsPopulated` (dayNight/randomization/antiRepetition) |
| 5 | Occlusion | rules | — | L0 `fieldsPopulated` (outdoorPreset/indoorPreset/transitionRules) |
| 6 | Memory Budget | balance | — | L0 `withinPercent` totalDecodedMb within ±33% of 6 MB target |
| 7 | Zone Binding | rules | — | L0 `fieldsPopulated` (primaryZone/activationEvents/wiringContract) |
| 8 | Icon 2D Art | gallery | T_\<name\>_AmbientIcon_×4 | L1 `selected` (soundscape icon) |
| 9 | Test Gate | checklist | — | L3 `runtimeDeferred` VSAmbientTest |
| 10 | UE Packaging | manifest | SC_\<name\>Bed_Day/Night, SC detail loops + one-shots, MS_\<name\>Patch, DT_Ambient, ATT_AshenForest_Mid | L0 `minCount` ≥3 + L2 `seedRowPresent` seed_audio.py |

## UE wiring
- **Runtime / assets:** `MS_<Slug>Patch` (MetaSound) orchestrates bed selection, detail-loop spawning, and the one-shot scheduler; `DT_Ambient` row drives `AAmbientSound` actor + gain selection; `ATT_AshenForest_Mid` is the shared attenuation DataAsset for all 3D emitters (placed as `UAudioComponent` on source meshes in `/Game/Maps/AshenForest.umap`). Wwise Spatial Audio (AkGeometry + AkRoom) drives obstruction/occlusion; RTPCs `TimeOfDay` (day/night crossfade) and `CombatState` (combat duck) modulate playback. The UE Packaging verification explicitly notes the engine uses `AAmbientSound` + `UAudioComponent` (not a `UAmbientSoundComponent`, which does not exist). No `cppSymbolExists` checks.
- **Seed script** (`seedRowPresent`): `seed_audio.py` (UE Packaging) — `DT_Ambient` row.
- **Runtime test** (`runtimeDeferred`): `VSAmbientTest` — soundscape layers + spatial emitters load in PIE.
- **Cross-catalog links** (`links:`): `zone-map::zone-z-ashen` (zone-binding / primary-zone) in steps 2, 7, 10; `icon-sets::iconset-abilities` (icon-family) in steps 8, 10. Zone Binding also depends on `music::music-combat-a` (combat duck) and `UARPGAbilitySystemComponent` (CombatStart/End).

## Acceptance profile
Uses **L0 (data)** for the bulk (brief, layers, spatialization, variants, occlusion, memory budget, zone binding, manifest), **L1 (human-selection)** for the icon gallery, **L2 (static UE source)** via the `seed_audio.py` seed-row check, and **L3 (runtime-deferred)** for `VSAmbientTest`. Config-complete = all L0/L1/L2 pass and the Test Gate is `deferred` with the layers-load reason.

## Status & notes
Three-tier layer model (1 bed + 3 detail loops over 9 emitter instances + 3 one-shot types = 7 distinct assets). Memory budget targets 6 MB decoded / 8 MB hard cap (`withinPercent` ±33%). Wwise-driven spatialization with day/night RTPC variants (night variant reserved, not authored in this row). Obeys `game-tone` (absence-as-identity, restraint over spectacle). No bridge-driven steps; production is synchronous data + deferred runtime.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
