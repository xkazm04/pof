# Music Pipeline

> Catalog ID `music` · Category Audio & FX · `audio` module · 10 steps · Tracks: audio, test

**Purpose.** Authors a multi-stage adaptive combat music track for PoF's grim, weathered world (canon `game-tone`). A music entity is a shared presentation library: it authors stems, intensity layers, loop points, mix/loudness targets, and trigger-binding rules once — zone and arena rows then link to it for playback. It realizes as a `SC_Music_<Slug>` MetaSound asset + a `DT_Music` row, consumed by `UARPGMusicManager` on the GameState and crossfaded in real time by the GAS `CombatIntensity` attribute.

## Target / starter entity
- **Combat Theme A** (`music-combat-a`, Combat) — An adaptive combat music track with stems (6 shared stems → 4 intensity layers).

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 `minLength` brief ≥ 300 chars |
| 2 | Stems & Layers | rules | — | L0 `fieldsPopulated` (stems/layers/mixRules/wiringContract) |
| 3 | Transitions | rules | — | L0 `fieldsPopulated` (combatEnter/combatExit/beatSyncImplementation/wiringContract) |
| 4 | Loop & Markers | rules | — | L0 `fieldsPopulated` (loopPoints/transitionMarkers/gridSpec/loopAuthoring) |
| 5 | Mix & Loudness | balance | — | L0 `withinPercent` integratedLUFS within ±12.5% of −16 LUFS (14–18 LUFS) |
| 6 | Trigger Binding | rules | — | L0 `fieldsPopulated` (zoneTrigger/arenaTrigger/wiringContract) |
| 7 | Streaming Budget | rules | — | L0 `fieldsPopulated` (memorySizeMB/streamingPolicy/budgetRules) |
| 8 | Icon 2D Art | gallery | T_\<name\>_MusicIcon | L1 `selected` (track icon) |
| 9 | Test Gate | checklist | — | L3 `runtimeDeferred` VSMusicTransitionTest |
| 10 | UE Packaging | manifest | SC_Music_\<name\>, DT_Music, SW_\<name\>_Stem×6 | L0 `minCount` ≥8 + L2 `seedRowPresent` seed_music.py |

## UE wiring
- **C++ / runtime:** `UARPGMusicManager` (GameState component) reads `FARPGMusicRow` from `DT_Music`, instantiates `SC_Music_<Slug>` (MetaSound), and drives the `MusicLayer` parameter from `UARPGAttributeSet.CombatIntensity`. Layer transitions fire on GAS `MusicEvent.*` events (CombatStart/CombatEnd/EliteSpawned/BossClimax) broadcast by `AARPGEncounterArena` / `AARPGGameMode`. No `cppSymbolExists` checks in this pipeline.
- **Assets:** MetaSound `SC_Music_<Slug>`, `DT_Music` row, six SoundWave stems (`SW_<Slug>_StemDrums/StringsLow/StringsHigh/BrassStabs/PercTexture/PadTension`), plus the icon texture.
- **Seed script** (`seedRowPresent`): `seed_music.py` (UE Packaging).
- **Runtime test** (`runtimeDeferred`): `VSMusicTransitionTest` — combat transition crossfades on cue in PIE.
- **Cross-catalog links** (`links:`): `zone-map::zone-z-ashen` (zone-music-trigger), `combat-map::arena-ravaged-courtyard` (combat-music-trigger), and `icon-sets::iconset-abilities` (icon-family) — emitted in Trigger Binding (step 6) and UE Packaging (step 10).

## Acceptance profile
Uses **L0 (data)** for nearly every step (brief, stems/layers, transitions, loop/markers, mix/loudness, trigger binding, streaming budget, manifest), **L1 (human-selection)** for the icon gallery, **L2 (static UE source)** via the `seed_music.py` seed-row check, and **L3 (runtime-deferred)** for `VSMusicTransitionTest`. Config-complete = all L0/L1/L2 pass and the Test Gate is `deferred` with the crossfade-on-cue reason.

## Status & notes
Detail-heavy audio pipeline: 6 stems × 4 layers (ambient-tension / combat-low / combat-high / boss-swell) on a shared 8-bar 96-BPM grid (20 000 ms loop). Beat-synced transitions via a `BarClock`; loudness target −16 LUFS (encoded as absolute 16.0 for `withinPercent`). Obeys `game-tone` "restraint over spectacle" (modal Dorian, no triumphant swell). No bridge-driven steps; production is synchronous data + deferred runtime.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
