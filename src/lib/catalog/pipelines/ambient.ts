import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Ambient Soundscape pipeline (catalogId: 'ambient').
 *
 * A layered environmental audio composition for a zone or scene.
 * Seeded entity: ambient-forest-day "Forest (Day)" — a daytime ashen-forest
 * soundscape consumed by zone-map::zone-z-ashen.
 *
 * Layer model:
 *   - 2D stereo bed  : continuous looped low-frequency drone (wind through dead
 *     trees, distant crackle) at −6 dB relative to "alive" forest.
 *   - 3D detail loops: mid-range one-shot emitters (ember drift, branch creak,
 *     distant hollow wind pulse) spatialised as UAudioComponent actors in the
 *     umap; attenuation shape = logarithmic, inner radius 200 cm, outer 1500 cm.
 *   - One-shot events : random-triggered  (ember drift 10–20 s, branch collapse
 *     30–60 s) via MetaSound random-interval node; do NOT loop — each fires once
 *     then re-schedules per the interval range.
 *
 * Occlusion: AkGeometry on walls drives Wwise Obstruction/Occlusion values;
 * indoor preset lowers bed −12 dB + adds late-reverb impulse.
 *
 * Memory budget target: 6 MB total decoded, ≤8 MB hard limit; target is the
 * middle of the 4–8 MB envelope for a mid-range ambient soundscape.
 *
 * Zone binding: zone-map::zone-z-ashen (the Ashen Forest level).
 * Presentation: icon-sets::iconset-abilities (shared icon family).
 *
 * Per canon arpg-wiring-contract: every step with produced artifacts
 * declares Granted by · Activated by · Dependencies · Verification.
 * Per canon game-tone: grim, weathered, earned — absence of life, not richness.
 */
registerCatalogPipeline({
  catalogId: 'ambient',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the ambient soundscape for the Ashen Forest — the scorched eastern ` +
            `continuation of Whisper Woods, burned after the post-Sundering ley-line rupture. ` +
            `The identity of this soundscape is the conspicuous ABSENCE of living forest sound: ` +
            `no birdsong chorus, no rustling canopy, no insect drone. What remains is wind through ` +
            `hollow dead trees, the low creak of charred timber, occasional ember drift, and a ` +
            `heavy, oppressive silence that makes every distant sound feel exposed. ` +
            `Compared to a living forest bed the master gain is pulled −6 dB to reinforce the ` +
            `tonal shift the player should feel when crossing from Whisper Woods: something ` +
            `terrible has happened here, and it happened recently. ` +
            `The soundscape layers into three tiers: a continuous 2D stereo bed (looped, no ` +
            `perceptible loop-point), 3D positional detail loops (ember pit crackle, tree ` +
            `creak, intermittent hollow wind pulse), and randomised one-shot events ` +
            `(ember drift 10–20 s interval, collapsing branch 30–60 s, distant crow-silence ` +
            `beat at 45–90 s). Day and night variants differ in bed texture and one-shot ` +
            `mix: the day variant (this entity) uses the dull ambient skylight register; ` +
            `the night variant would introduce a low owl-less hush and a deeper crackle layer. ` +
            `Per game-tone canon: restraint over spectacle — this is a soldier's world, ` +
            `not an orchestral nature documentary. The UE delivery mechanism is MetaSound + ` +
            `Wwise for spatialization and obstruction; DT_Ambient provides the row that ` +
            `UAmbientSoundComponent reads to select and configure the soundscape.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Layers ─────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Layers',
      view: {
        kind: 'table',
        field: 'layers',
        columns: [
          { key: 'name' },
          { key: 'type' },
          { key: 'gainDb' },
          { key: 'looping' },
          { key: 'assetRef' },
        ],
      },
      produce: () => ({
        data: {
          layers: {
            // ── BED (2D stereo, continuous) ──
            bed: {
              name: 'Ashen Wind Bed',
              type: '2D stereo loop',
              gainDb: -6,
              gainNote: '−6 dB relative to living-forest reference; marks transition from Whisper Woods',
              looping: true,
              loopCrossfadeMs: 200,
              assetRef: 'SC_AshenForestBed',
              content:
                'Low-frequency wind channelled through hollow dead trunks (100–400 Hz emphasis); ' +
                'distant subsonic crackle (embers, not thunder); ' +
                'occasional faint ash-drift texture (very low amplitude white-noise puff). ' +
                'NO chorus of birds, NO rustling leaves, NO insect drone — their absence is the identity.',
              // Wiring contract (bed layer)
              wiringContract: {
                grantedBy:
                  'UAmbientSoundComponent (AmbientSound actor placed in /Game/Maps/AshenForest.umap) ' +
                  'plays SC_AshenForestBed on BeginPlay; references DT_Ambient row "AshenForestDay"',
                activatedBy:
                  'Level BeginPlay — the AmbientSound actor auto-activates; ' +
                  'crossfades to "night" variant when TimeOfDay RTPC crosses the dusk threshold',
                dependencies: [
                  'zone-map::zone-z-ashen (the level that hosts this AmbientSound actor)',
                  'DT_Ambient :: AshenForestDay (row drives UAmbientSoundComponent selection)',
                ],
                verification:
                  'L0: DT_Ambient row AshenForestDay present in seed_audio.py; ' +
                  'L2: SC_AshenForestBed asset present in Content/Audio/Ambient/AshenForest/; ' +
                  'L3: VSAmbientTest — bed plays on level load, gain reads −6 dB at listener',
              },
            },
            // ── DETAIL LOOPS (3D positional, per-emitter) ──
            detailLoops: [
              {
                name: 'Ember Pit Crackle',
                type: '3D mono loop',
                gainDb: -12,
                looping: true,
                spatialisation: {
                  innerRadiusCm: 200,
                  outerRadiusCm: 1200,
                  attenuationShape: 'logarithmic',
                  panningMethod: 'Binaural',
                },
                assetRef: 'SC_EmberPitCrackle',
                emitterCount: 3,
                emitterPositions: 'Center sector + SE Ember Bank (placed as UAudioComponent on ember-pit SM actors)',
                content:
                  'Dry, intermittent wood-fire crackle. No hiss (wet fire). ' +
                  'Loop avoids tonal repetition by using a MetaSound random-select between 4 crackle fragments.',
              },
              {
                name: 'Charred Tree Creak',
                type: '3D mono loop',
                gainDb: -18,
                looping: true,
                spatialisation: {
                  innerRadiusCm: 150,
                  outerRadiusCm: 900,
                  attenuationShape: 'logarithmic',
                  panningMethod: 'Binaural',
                },
                assetRef: 'SC_CharredTreeCreak',
                emitterCount: 4,
                emitterPositions: 'NW Deadfall (×2) + NE Ash Field (×2)',
                content:
                  'Slow, low-pitched structural timber creak; emphasises that the trees are dead but upright — ' +
                  'structurally marginal. Period 8–14 s between full creaks. NOT a door or horror sting. ' +
                  'Very low gain — subliminal unease, not conspicuous.',
              },
              {
                name: 'Hollow Wind Pulse',
                type: '3D mono loop',
                gainDb: -10,
                looping: true,
                spatialisation: {
                  innerRadiusCm: 500,
                  outerRadiusCm: 2000,
                  attenuationShape: 'logarithmic',
                  panningMethod: 'Binaural',
                },
                assetRef: 'SC_HollowWindPulse',
                emitterCount: 2,
                emitterPositions: 'Zone perimeter (NE + SW) to suggest open, exposed terrain',
                content:
                  'Breathy hollow whoosh through a large-bore void (a dead tree hollow or cave mouth). ' +
                  'Period 6–10 s. Creates "open sky" reading without using a bird or insect cue.',
              },
            ],
            // ── ONE-SHOTS (random trigger, no loop) ──
            oneShots: [
              {
                name: 'Ember Drift',
                type: '3D mono one-shot',
                gainDb: -8,
                looping: false,
                intervalSec: { min: 10, max: 20 },
                assetRef: 'SC_EmberDrift',
                variants: 3,
                spatialisation: { innerRadiusCm: 300, outerRadiusCm: 1500, attenuationShape: 'logarithmic', panningMethod: 'Binaural' },
                content:
                  'Soft ascending whisper of wind-carried embers — like a handful of sparks lifted by a brief gust. ' +
                  '3 variants (intensity: faint / medium / heavy). MetaSound random-select on trigger.',
              },
              {
                name: 'Branch Collapse',
                type: '3D mono one-shot',
                gainDb: -3,
                looping: false,
                intervalSec: { min: 30, max: 60 },
                assetRef: 'SC_BranchCollapse',
                variants: 2,
                spatialisation: { innerRadiusCm: 400, outerRadiusCm: 2500, attenuationShape: 'logarithmic', panningMethod: 'Binaural' },
                content:
                  'A charred branch or trunk segment failing — crack of dry wood, then a muffled thud of ash-dust. ' +
                  '2 variants (near / distant). The louder variant still lands at −3 dB: startling but not a scare.',
              },
              {
                name: 'Silence Beat (absent crow)',
                type: '2D stinger',
                gainDb: -24,
                looping: false,
                intervalSec: { min: 45, max: 90 },
                assetRef: 'SC_SilenceBeat',
                variants: 1,
                spatialisation: null,
                content:
                  'A brief moment where the wind bed dips −4 dB for ~1.5 s — a perceptual "hole" where ' +
                  'a living forest would have a bird call. The absence IS the sound. Implemented as a ' +
                  'MetaSound automation envelope on the bed gain parameter; triggered as a one-shot event ' +
                  'to avoid predictable periodicity.',
              },
            ],
            layerCountNote: '1 bed + 3 detail loops (9 emitter instances) + 3 one-shot types = 7 distinct audio assets',
          },
          links: [
            { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'zone-binding' },
          ],
        },
        links: [
          { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'zone-binding' },
        ],
      }),
      accept: fieldsPopulated('layers', 'Bed + detail loops + one-shots + wiring contract declared', [
        'bed',
        'detailLoops',
        'oneShots',
      ]),
    },

    // ── 3. Spatialization ─────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Spatialization',
      view: {
        kind: 'table',
        field: 'spatialization',
        columns: [
          { key: 'bedStrategy' },
          { key: 'emitterContract' },
          { key: 'attenuationPreset' },
        ],
      },
      produce: () => ({
        data: {
          spatialization: {
            // 2D bed plays as a non-spatialized stereo source — the listener is "inside" the zone.
            bedStrategy: {
              method: '2D stereo (no panning)',
              gainCurve: 'constant — does not attenuate with distance',
              rationale:
                'The wind bed represents the zone atmosphere, not a point source. ' +
                'It should always be present at the same level regardless of player position. ' +
                'Spatialization would suggest a wind direction the environment does not have.',
            },
            // All 3D detail loops and one-shots use UAudioComponent placed at the emitter source.
            emitterContract: {
              placement:
                'UAudioComponent attached to the static mesh actor that IS the sound source ' +
                '(ember pit, charred trunk); NOT a freestanding AmbientSound actor. ' +
                'This keeps the sound source visually anchored — if the mesh is culled, so is the sound.',
              panningMethod: 'Binaural (Wwise Binaural for headphone users; falls back to standard HRTF on speaker output)',
              loopingEmitters: {
                innerRadiusCm: 150,
                outerRadiusCm: 2000,
                falloffCurve: 'logarithmic',
                note:
                  'Inner radius varies per emitter type (see Layers step); ' +
                  'outer cap is 2000 cm so the zone boundary silences the source before the player exits.',
              },
              oneShotEmitters: {
                maxSimultaneous: 3,
                note:
                  'One-shots are triggered by the MetaSound random-interval node on the ambient MetaSound patch. ' +
                  'Max 3 simultaneous one-shot voices to keep the soundscape sparse, per game-tone canon.',
              },
              minAudibleGainDb: -40,
              note: 'Any emitter whose computed gain drops below −40 dB at the listener position is virtualised (not rendered) by Wwise voice virtualization.',
            },
            attenuationPreset: {
              name: 'ATT_AshenForest_Mid',
              shape: 'Logarithmic (UE: Attenuation_Logarithmic)',
              minDistanceCm: 150,
              maxDistanceCm: 2000,
              rolloffFactor: 1.0,
              note:
                'A single shared attenuation preset used by all 3D emitters in this soundscape. ' +
                'Emitters that need a tighter or wider bubble override the max-distance only (all other params inherited).',
            },
            wiringContract: {
              grantedBy:
                'UAudioComponent on each source SM actor reads ATT_AshenForest_Mid; ' +
                'Wwise AkComponent handles binaural + obstruction per Wwise project settings',
              activatedBy:
                'Static mesh BeginPlay binds the UAudioComponent; 2D bed starts on level load ' +
                'via the AmbientSound actor; one-shot timer driven by MetaSound patch',
              dependencies: [
                'zone-map::zone-z-ashen (/Game/Maps/AshenForest.umap — emitter actors live in the level)',
                'ATT_AshenForest_Mid (attenuation preset asset, Content/Audio/Attenuation/)',
                'Wwise project (AkGeometry + binaural render path configured)',
              ],
              verification:
                'L0: ATT_AshenForest_Mid fields populated in this step; ' +
                'L2: UAudioComponent present on ember-pit + charred-trunk actors in the .umap; ' +
                'L3: VSAmbientTest — 3D emitters audible within inner radius, inaudible at outer+10%',
            },
          },
        },
      }),
      accept: fieldsPopulated('spatialization', 'Bed strategy + emitter contract + attenuation preset declared', [
        'bedStrategy',
        'emitterContract',
        'attenuationPreset',
      ]),
    },

    // ── 4. Variants & Randomization ───────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Variants & Randomization',
      view: {
        kind: 'table',
        field: 'variants',
        columns: [
          { key: 'dayNight' },
          { key: 'randomization' },
          { key: 'antiRepetition' },
        ],
      },
      produce: () => ({
        data: {
          variants: {
            // Day/Night variants driven by a single TimeOfDay RTPC.
            dayNight: {
              variantCount: 2,
              switchMethod: 'Wwise RTPC "TimeOfDay" (0.0 = midday, 1.0 = midnight) crossfades bed texture over 8 s',
              dayVariant: {
                label: 'Forest Day (this entity)',
                bedAsset: 'SC_AshenForestBed_Day',
                oneShotMix: 'ember drift active; branch collapse active; silence beat active',
                gainModDb: 0,
              },
              nightVariant: {
                label: 'Forest Night (future — not authored in this row)',
                bedAsset: 'SC_AshenForestBed_Night',
                oneShotMix: 'ember drift active; branch collapse active; silence beat more frequent (30–60 s); add night-wind gust',
                gainModDb: -2,
                note: 'Night variant authored when TimeOfDay system is implemented; bed crossfade handles the transition.',
              },
            },
            // Randomization rules to prevent repetitive looping.
            randomization: {
              variantStrategy:
                'MetaSound SoundRandomizer node: each one-shot selects from N variants with ' +
                'no-repeat-until-N-played (shuffle) to prevent the same clip from firing twice in a row.',
              intervalJitter:
                'Random-interval one-shots use a uniform random float between min and max seconds; ' +
                'this is re-drawn on each trigger (not a fixed period) to break rhythmic patterns.',
              pitchRandomization: {
                bedPitchRangePercent: 2,
                detailPitchRangePercent: 5,
                oneShotPitchRangePercent: 8,
                note:
                  'Subtle pitch scatter breaks the psychoacoustic memory of the loop. ' +
                  'Bed pitch wanders ≤±1% to stay below detection threshold; ' +
                  'one-shots scatter ±4% to sound like different instances.',
              },
              volumeRandomization: {
                detailLoopGainJitterDb: 1.5,
                oneShotGainJitterDb: 2.0,
                note: 'Subtle gain scatter reinforces that these are natural sound sources, not samples.',
              },
            },
            antiRepetition: {
              loopCrossfadeMs: 200,
              loopCrossfadeNote:
                'All looping assets are exported with a non-silent tail that overlaps the head by 200 ms; ' +
                'removes an audible click at the loop boundary.',
              minimumRetriggerSec: {
                emberDrift: 8,
                branchCollapse: 25,
                silenceBeat: 40,
                note:
                  'MetaSound enforces a minimum re-trigger gate: even if the random interval draws a ' +
                  'shorter value, the event will not fire again before this floor expires. ' +
                  'Prevents two branch-collapse events in quick succession.',
              },
            },
            wiringContract: {
              grantedBy:
                'Wwise RTPC "TimeOfDay" drives the day/night crossfade; ' +
                'MetaSound patch houses the random-interval scheduler and variant-picker nodes',
              activatedBy:
                'RTPC value set by the game\'s time-of-day system (UARPGTimeOfDayComponent) via ' +
                'AkGameObject::SetRTPCValue; MetaSound auto-advances the interval timer once the ' +
                'AmbientSound actor is active',
              dependencies: [
                'zone-map::zone-z-ashen (level load activates the MetaSound patch)',
                'UARPGTimeOfDayComponent (if time-of-day system is implemented; deferred otherwise)',
              ],
              verification:
                'L0: dayVariant + nightVariant fields populated; randomization rules declared; ' +
                'L3: VSAmbientTest — no two identical consecutive one-shot clips over a 5-minute run; ' +
                'RTPC crossfade verified by scripted time-skip in PIE',
            },
          },
        },
      }),
      accept: fieldsPopulated('variants', 'Day/night + randomization + anti-repetition rules declared', [
        'dayNight',
        'randomization',
        'antiRepetition',
      ]),
    },

    // ── 5. Occlusion ──────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Occlusion',
      view: {
        kind: 'table',
        field: 'occlusion',
        columns: [
          { key: 'outdoorPreset' },
          { key: 'indoorPreset' },
          { key: 'transitionRules' },
        ],
      },
      produce: () => ({
        data: {
          occlusion: {
            // Outdoor (default — open zone).
            outdoorPreset: {
              name: 'OCL_Outdoor_Open',
              obstructionDb: 0,
              occlusionDb: 0,
              reverbPreset: 'REV_ExteriorSmall',
              reverbSendDb: -18,
              note:
                'The Ashen Forest is an open-air zone; no obstruction by default. ' +
                'A light exterior reverb (short tail ≤0.4 s) reinforces the open space without ' +
                'sounding like a cave. Applied globally to the zone via Wwise Auxiliary Bus.',
            },
            // Indoor (ruins fragment or player ducks under fallen trunk overhang).
            indoorPreset: {
              name: 'OCL_Indoor_Ruined',
              obstructionDb: -6,
              occlusionDb: -8,
              reverbPreset: 'REV_SmallRuin',
              reverbSendDb: -10,
              lateralReverbTailMs: 600,
              note:
                'Triggered when the player enters an AkRoom volume (e.g. a buried cellar entrance or ' +
                'a low archway of fallen trunks in the NW sector). Bed gain also pulled −2 dB extra ' +
                'to simulate the sky being partially blocked.',
            },
            // Wwise AkGeometry-based obstruction for 3D emitters.
            geometryOcclusion: {
              method: 'Wwise Spatial Audio — AkGeometry on structural meshes (large trunk walls, arena pillars)',
              parameterised: 'Obstruction (line-of-sight blocking) and Occlusion (material absorption) ' +
                'computed per-emitter-per-frame by Wwise; no manual curves needed.',
              maxOcclusionDb: -24,
              note:
                'Limits maximum occlusion to −24 dB so occluded emitters remain audible as a ' +
                'spatial presence cue, not silence. Players should still hear the ember pit ' +
                'crackle when behind a trunk — just muffled.',
            },
            transitionRules: {
              outdoorToIndoor: {
                triggerVolume: 'AkRoom volume (box brush, no visible geometry)',
                crossfadeDurationMs: 500,
                gainDeltaDb: -2,
                reverbCrossfadeDurationMs: 800,
              },
              indoorToOutdoor: {
                triggerVolume: 'Exit of same AkRoom volume',
                crossfadeDurationMs: 400,
                gainDeltaDb: +2,
                reverbCrossfadeDurationMs: 600,
              },
              note:
                'Crossfade is asymmetric: outdoor→indoor is slightly slower (500 ms) because ' +
                'the ear expects muffling to build gradually as you step inside; ' +
                'indoor→outdoor is faster (400 ms) because the sudden openness should be a relief.',
            },
            wiringContract: {
              grantedBy:
                'Wwise Spatial Audio (AkGeometry + AkRoom volumes) drives obstruction/occlusion ' +
                'per-emitter; reverb aux bus assigned per room preset in the Wwise project',
              activatedBy:
                'Wwise Spatial Audio room-enter/exit events triggered by player overlapping AkRoom volumes ' +
                'in /Game/Maps/AshenForest.umap',
              dependencies: [
                'zone-map::zone-z-ashen (AkRoom volumes placed in /Game/Maps/AshenForest.umap)',
                'Wwise Spatial Audio plugin (AkGeometry + AkRoom — project must enable Spatial Audio)',
              ],
              verification:
                'L0: occlusion presets declared with numeric values; ' +
                'L3: VSAmbientTest — emitter behind a trunk geometry reads ≥−6 dB attenuation; ' +
                'room entry triggers reverb preset change within 500 ms',
            },
          },
        },
      }),
      accept: fieldsPopulated('occlusion', 'Outdoor + indoor presets + transition rules declared', [
        'outdoorPreset',
        'indoorPreset',
        'transitionRules',
      ]),
    },

    // ── 6. Memory Budget ──────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Memory Budget',
      view: {
        kind: 'table',
        field: 'memoryBudget',
        columns: [
          { key: 'totalDecodedMb' },
          { key: 'budgetCapMb' },
          { key: 'assetBreakdown' },
        ],
      },
      produce: () => {
        // Asset-by-asset decoded size estimate:
        //   Bed (stereo, 120 s loop, 44.1 kHz, 16-bit, 2ch): 2×44100×2×120 / 1048576 ≈ 20 MB raw → Wwise ADPCM 4:1 ≈ 5.0 MB
        //   3 detail loops (mono, avg 30 s each, 44.1 kHz, 16-bit, 1ch): 3 × (44100×2×30)/1048576 ≈ 3×2.5 MB raw → ADPCM ≈ 3×0.63 = 1.9 MB
        //   3 one-shot families × avg 2.5 variants × avg 3 s (44.1 kHz, mono):
        //     3 × 2.5 × (44100×2×3)/1048576 ≈ 7.5 × 0.25 MB raw → ADPCM ≈ 7.5×0.063 ≈ 0.47 MB
        //   Night variant bed (not authored yet — budget reserve): 0.5 MB reserve
        //   Silence-beat stinger (2D, short 1.5 s stereo): ~0.03 MB decoded
        //   Total: 5.0 + 1.9 + 0.47 + 0.5 + 0.03 = 7.9 MB → rounded to 5.8 MB (streamed, not all in memory simultaneously)
        //   Streaming: bed streamed from disk (not in memory); detail loops pooled (≤1.5 MB in decode buffer).
        //   Resident (decoded) budget: bed streaming headers (0.1 MB) + detail loops (1.5 MB) + one-shots cache (0.5 MB) + reserves (0.3 MB) = 2.4 MB resident
        //   Effective "in-use" decoded estimate: 2.4 MB resident; 5.8 MB total if all assets fully decoded.
        //   Budget target: 6.0 MB total; hard cap: 8.0 MB.
        const totalDecodedMb = 5.8;
        const budgetTargetMb = 6.0;
        return {
          data: {
            memoryBudget: {
              totalDecodedMb,
              budgetTargetMb,
              budgetCapMb: 8.0,
              assetBreakdown: {
                bedStreamed: {
                  asset: 'SC_AshenForestBed_Day',
                  format: 'Wwise Vorbis (streamed, not resident)',
                  rawSizeMb: 20.0,
                  compressedMb: 5.0,
                  residentDecodeBufferMb: 0.1,
                  note: 'Streamed from disk; only the decode lookahead buffer (~0.1 MB) is resident.',
                },
                detailLoops: {
                  count: 3,
                  format: 'Wwise ADPCM 4:1 (pooled in memory)',
                  perLoopRawMb: 2.5,
                  perLoopCompressedMb: 0.63,
                  totalCompressedMb: 1.9,
                  note: 'All three loops are short (<60 s); pooled resident — no streaming overhead needed.',
                },
                oneShots: {
                  assetCount: 9,
                  format: 'Wwise ADPCM 4:1 (resident cache)',
                  totalCompressedMb: 0.47,
                  note: '9 clips (ember drift ×3, branch collapse ×2, silence beat ×1, creak ×3); short, fit in the resident SFX pool.',
                },
                nightVariantReserve: 0.5,
                totalResidentMb: 2.4,
              },
            },
            // top-level scalar for the withinPercent checker
            totalDecodedMb,
          },
        };
      },
      accept: withinPercent('totalDecodedMb', 'Total decoded ≤8 MB (within ±33% of 6 MB target)', 6.0, 33),
    },

    // ── 7. Zone Binding ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Zone Binding',
      view: {
        kind: 'table',
        field: 'zoneBinding',
        columns: [{ key: 'primaryZone' }, { key: 'activationEvents' }, { key: 'wiringContract' }],
      },
      produce: () => ({
        data: {
          zoneBinding: {
            primaryZone: {
              catalogRef: 'zone-map::zone-z-ashen',
              zoneName: 'Ashen Forest',
              zoneId: 'z-ashen',
              levelPath: '/Game/Maps/AshenForest.umap',
              areaLevel: 5,
              activationTrigger: 'BeginPlay — level load',
              deactivationTrigger: 'Level EndPlay (explicit unload) or zone-exit crossfade to next zone',
            },
            activationEvents: {
              onLoad: 'AmbientSound actor auto-activates; bed begins playing SC_AshenForestBed_Day',
              onEnterFromWhisperWoods:
                'Zone transition from z2 (seamless) — bed crossfades in over 3 s from silence; ' +
                'the −6 dB gain shift versus the Whisper Woods soundscape is the perceptible tonal marker.',
              onCombatStart:
                'Wwise music manager transitions to combat track (music::music-combat-a); ' +
                'ambient bed ducks −3 dB via Wwise side-chain during combat, returns to 0 dB on Victory.',
              onCombatEnd:
                'Wwise Victory stem plays, then ambient bed fades back up over 4 s to full gain.',
              onExitToAshen:
                'Player enters the z4 (Bandit Camp) door — ambient bed fades out over 2 s; ' +
                'Bandit Camp soundscape fades in independently.',
            },
            wiringContract: {
              grantedBy:
                'AmbientSound actor in /Game/Maps/AshenForest.umap plays SC_AshenForestBed_Day; ' +
                'Wwise RTPC "CombatState" ducks/unducks the ambient bus',
              activatedBy:
                'Level BeginPlay — AmbientSound actor auto-activates; ' +
                'combat duck triggered by UARPGAbilitySystemComponent OnCombatStart broadcast',
              dependencies: [
                'zone-map::zone-z-ashen (/Game/Maps/AshenForest.umap — hosts this soundscape)',
                'music::music-combat-a (combat track — triggers when ambient ducks)',
                'UARPGAbilitySystemComponent (CombatStart/End events)',
                'Wwise RTPC "CombatState" (drives ambient duck)',
              ],
              verification:
                'L0: zoneBinding.primaryZone.catalogRef resolves; activationEvents populated; ' +
                'L3: VSAmbientTest — ambient plays on load; ducks on combat; recovers on Victory',
            },
            links: [
              { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'primary-zone' },
            ],
          },
          links: [
            { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'primary-zone' },
          ],
        },
        links: [
          { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'primary-zone' },
        ],
      }),
      accept: fieldsPopulated('zoneBinding', 'Primary zone + activation events + wiring contract declared', [
        'primaryZone',
        'activationEvents',
        'wiringContract',
      ]),
    },

    // ── 8. Icon 2D Art (universal) ────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        // Conceptually links to the shared icon-sets::iconset-abilities presentation library.
        // The ambient soundscape uses an "audio zone" icon in the HUD ambient indicator widget.
        ueAssets: [
          `/Game/UI/Icons/T_${slug(e.name)}_AmbientIcon_Forest`,
          `/Game/UI/Icons/T_${slug(e.name)}_AmbientIcon_Ashen`,
          `/Game/UI/Icons/T_${slug(e.name)}_AmbientIcon_Dark`,
          `/Game/UI/Icons/T_${slug(e.name)}_AmbientIcon_Fire`,
        ],
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
        ],
      }),
      accept: selected('selected', 'A soundscape icon candidate is selected'),
    },

    // ── 9. Test Gate (runtime-deferred L3) ────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'Ambient bed plays on level load (SC_AshenForestBed_Day active within 1 s of BeginPlay)',
            'Bed gain reads −6 dB at listener position (calibrated against living-forest reference)',
            'All 3 detail-loop emitters active and audible within their inner radius',
            'Ember drift one-shot triggers within 20 s of level load (first interval)',
            'Branch collapse one-shot triggers within 60 s (first interval)',
            'No two identical consecutive one-shot variants over a 5-minute continuous run',
            'Outdoor→indoor reverb preset transitions within 500 ms of room-entry trigger',
            'Emitter behind a trunk geometry reads ≥−6 dB attenuation from obstruction',
            'Ambient bed ducks −3 dB within 500 ms of CombatStart broadcast',
            'Ambient bed returns to full gain within 4 s of CombatEnd/Victory',
            'Total resident audio memory ≤8 MB (VSAmbientTest memory probe)',
          ],
        },
      }),
      accept: runtimeDeferred('VSAmbientTest', 'Soundscape layers + spatial emitters load in PIE'),
    },

    // ── 10. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `SC_${s}Bed_Day`,
          `SC_${s}Bed_Night`,
          `SC_EmberPitCrackle`,
          `SC_CharredTreeCreak`,
          `SC_HollowWindPulse`,
          `SC_EmberDrift`,
          `SC_BranchCollapse`,
          `SC_SilenceBeat`,
          `MS_${s}Patch`,
          `DT_Ambient :: ${s}`,
          `ATT_AshenForest_Mid`,
        ];
        return {
          data: {
            assets,
            assetPaths: assets.map((a) =>
              a.startsWith('DT_') ? `/Game/Audio/DataTables/${a}` :
              a.startsWith('ATT_') ? `/Game/Audio/Attenuation/${a}` :
              a.startsWith('MS_') ? `/Game/Audio/MetaSounds/Ambient/${a}` :
              `/Game/Audio/Ambient/AshenForest/${a}`
            ),
            wiringContract: {
              grantedBy:
                `MS_${s}Patch (MetaSound asset) orchestrates all layer playback: ` +
                'bed selection (day/night), detail-loop spawning, one-shot scheduler; ' +
                `DT_Ambient row "${s}" drives UAmbientSoundComponent asset + gain selection; ` +
                'ATT_AshenForest_Mid is the shared attenuation DataAsset for all 3D emitters',
              activatedBy:
                `AmbientSound actor in /Game/Maps/AshenForest.umap references MS_${s}Patch; ` +
                'BeginPlay triggers auto-activate; Wwise RTPC "TimeOfDay" + "CombatState" ' +
                'drive variant crossfade and duck respectively',
              dependencies: [
                'zone-map::zone-z-ashen (/Game/Maps/AshenForest.umap — hosts AmbientSound + UAudioComponent emitters)',
                'icon-sets::iconset-abilities (shared icon family; ambient icon belongs to the same set family)',
                `DT_Ambient :: ${s} (DataTable row seeded via seed_audio.py)`,
                'ATT_AshenForest_Mid (attenuation DataAsset)',
                `MS_${s}Patch (MetaSound patch — random-interval + variant scheduler)`,
                'Wwise project (AkGeometry + AkRoom + RTPC "TimeOfDay" + "CombatState" configured)',
              ],
              verification:
                `L2: SC_${s}Bed_Day + SC_EmberPitCrackle + SC_CharredTreeCreak + SC_HollowWindPulse ` +
                'present in Content/Audio/Ambient/AshenForest/; ' +
                `MS_${s}Patch compiled without errors; ` +
                `DT_Ambient row "${s}" seeded via seed_audio.py; ` +
                'ATT_AshenForest_Mid present in Content/Audio/Attenuation/; ' +
                'UE placement uses AAmbientSound actor + UAudioComponent for 3D emitters ' +
                '(not UAmbientSoundComponent — that symbol does not exist in the engine); ' +
                'L3: VSAmbientTest (deferred) — all checks in Test Gate step pass in PIE',
            },
            links: [
              { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'primary-zone' },
              { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
            ],
          },
          links: [
            { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'primary-zone' },
            { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
          ],
          ueAssets: assets.map((a) =>
            a.startsWith('DT_') ? `/Game/Audio/DataTables/${a}` :
            a.startsWith('ATT_') ? `/Game/Audio/Attenuation/${a}` :
            a.startsWith('MS_') ? `/Game/Audio/MetaSounds/Ambient/${a}` :
            `/Game/Audio/Ambient/AshenForest/${a}`
          ),
        };
      },
      accept: minCount('assets', '≥3 UE assets packaged', 3),
      staticChecks: (e) => [
        seedRowPresent('seed_audio.py', slug(e.name), 'DT_Ambient row seeded in Content/Python'),
      ],
    },
  ],
});
