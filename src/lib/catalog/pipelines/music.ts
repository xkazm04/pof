import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Music pipeline (catalogId: 'music').
 *
 * Defines the multi-stage authoring process for an adaptive combat music track
 * in PoF's grim, weathered world (canon game-tone).  A music entity is a
 * shared presentation library: it authors stems, intensity layers, loop points,
 * mixing targets, and trigger-binding rules once — zone and arena rows then
 * link to it for playback.
 *
 * Per canon arpg-wiring-contract every step that produces a UE artifact declares
 * Granted by · Activated by · Dependencies · Verification.
 *
 * Resolvable cross-catalog links (real seeded ids only):
 *   zone-map::zone-z-ashen          — Ashen Forest zone where this track plays
 *   combat-map::arena-ravaged-courtyard — the combat arena that triggers the track
 *   icon-sets::iconset-abilities     — shared icon presentation library
 */
registerCatalogPipeline({
  catalogId: 'music',
  steps: [
    // ── 1. Concept Brief ─────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is an adaptive combat music track for PoF — a grim, weathered ARPG set in a ` +
            `post-Sundering dark fantasy world (canon game-tone). The track scores the "earned tension" ` +
            `of the Ashen Forest's Ravaged Courtyard arena encounter: two waves of brutes pressing in ` +
            `across scarred stone, fire-floor hazard radiating from centre. ` +
            `Tone is restrained threat — the music never tips into triumphant or grandiose, but into ` +
            `a grinding inevitability that rewards discipline. ` +
            `Instrumentation: low-register string ostinato (war bows and cello), sparse war-drum ` +
            `pulse (military cadence, 96 BPM), muted brass stab accents on wave entry, and a thin ` +
            `upper-register dissonant violin layer that heightens under the elite Brute's presence. ` +
            `The composition respects the game-tone pillar "restraint over spectacle" — no swelling ` +
            `choir, no triumphant brass swell. The melodic content is modal (Dorian), referencing the ` +
            `Ashen Order's militant austerity, not the hero's journey. ` +
            `The track is authored as four intensity layers (ambient-tension / combat-low / ` +
            `combat-high / boss-swell) built from six shared stems so the MetaSound asset can ` +
            `crossfade stems in real time driven by the GAS CombatIntensity attribute. ` +
            `Delivery: MetaSound asset SC_Music_${slug(e.name)} + DataTable row in DT_Music, consumed ` +
            `by UARPGMusicManager on the game state and triggered by GAS events from the encounter.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Stems & Layers ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Stems & Layers',
      view: {
        kind: 'table',
        field: 'stemsLayers',
        columns: [{ key: 'stems' }, { key: 'layers' }, { key: 'mixRules' }],
      },
      produce: () => ({
        data: {
          stemsLayers: {
            stems: [
              {
                id: 'stem-drums',
                name: 'War Drums',
                description:
                  'Military cadence at 96 BPM; kick-like thud on beats 1 and 3, snare hit on beat 2. ' +
                  'Tight decay (~120 ms reverb tail) to stay dry and grounded. Present in all layers except ambient-tension.',
                format: '48 kHz / 24-bit WAV, mono',
                presenceInLayers: ['combat-low', 'combat-high', 'boss-swell'],
              },
              {
                id: 'stem-strings-low',
                name: 'Low Strings Ostinato',
                description:
                  'Cello + war-bow section on a repeating 4-bar Dorian figure. Foundation of all layers; ' +
                  'volume and filter envelope modulated per layer (fully open at combat-high, half-filtered in ambient-tension). ' +
                  'Loop length: 8 bars (5 s at 96 BPM).',
                format: '48 kHz / 24-bit WAV, stereo',
                presenceInLayers: ['ambient-tension', 'combat-low', 'combat-high', 'boss-swell'],
              },
              {
                id: 'stem-strings-high',
                name: 'High Strings Dissonance',
                description:
                  'Violin cluster on a half-step dissonance (B–C above the ostinato root) — thin, unsettling. ' +
                  'Fades in at combat-high; full presence only at boss-swell. Absent in ambient-tension and combat-low. ' +
                  'Reinforces threat escalation without spectacle.',
                format: '48 kHz / 24-bit WAV, stereo',
                presenceInLayers: ['combat-high', 'boss-swell'],
              },
              {
                id: 'stem-brass-stabs',
                name: 'Brass Stabs',
                description:
                  'Muted French horn / trombone stabs on the downbeat of every other bar during wave entries. ' +
                  'Volume envelope: fast attack (≤20 ms), medium decay (~300 ms). ' +
                  'Triggered via a MetaSound parameter wave on WaveEntry event, not baked into a continuous loop.',
                format: '48 kHz / 24-bit WAV, stereo',
                presenceInLayers: ['combat-low', 'combat-high', 'boss-swell'],
              },
              {
                id: 'stem-perc-texture',
                name: 'Percussion Texture',
                description:
                  'Low-pitched rock scrapes, chain rattle, and boot-thud atop the drum stem — builds the ' +
                  '"soldiers on rubble" texture without melodic content. Gentle in combat-low; full at combat-high.',
                format: '48 kHz / 24-bit WAV, stereo',
                presenceInLayers: ['combat-low', 'combat-high', 'boss-swell'],
              },
              {
                id: 'stem-pad-tension',
                name: 'Tension Pad',
                description:
                  'Slow-attack (400 ms) string-pad cluster on the root + flat-seventh — sits under the ostinato ' +
                  'in ambient-tension only. Conveys latent danger without momentum. Fades fully by combat-low.',
                format: '48 kHz / 24-bit WAV, stereo',
                presenceInLayers: ['ambient-tension'],
              },
            ],
            layers: [
              {
                id: 'ambient-tension',
                label: 'Ambient / Tension',
                stemsActive: ['stem-strings-low', 'stem-pad-tension'],
                description: 'Pre-combat state: player in zone but no enemies aggroed. Low-energy, watchful.',
                volumeProfile: { stringsLow: 0.55, tensionPad: 0.70 },
              },
              {
                id: 'combat-low',
                label: 'Combat — Low',
                stemsActive: ['stem-strings-low', 'stem-drums', 'stem-brass-stabs', 'stem-perc-texture'],
                description: 'Wave 1 (normal Brute pack): drums + strings + light brass. Pulse without panic.',
                volumeProfile: { stringsLow: 0.80, drums: 0.85, brassStabs: 0.60, percTexture: 0.55 },
              },
              {
                id: 'combat-high',
                label: 'Combat — High',
                stemsActive: ['stem-strings-low', 'stem-strings-high', 'stem-drums', 'stem-brass-stabs', 'stem-perc-texture'],
                description: 'Wave 2 (elite Rare Brute): dissonance layer added. Heightened threat.',
                volumeProfile: { stringsLow: 0.85, stringsHigh: 0.60, drums: 1.00, brassStabs: 0.80, percTexture: 0.75 },
              },
              {
                id: 'boss-swell',
                label: 'Boss / Climax Swell',
                stemsActive: ['stem-strings-low', 'stem-strings-high', 'stem-drums', 'stem-brass-stabs', 'stem-perc-texture'],
                description: 'Elite Rare Brute below 30% HP: all stems at full; brass and dissonance peak. ' +
                  'Short-form only (≤30 s) before returning to combat-high on kill.',
                volumeProfile: { stringsLow: 0.90, stringsHigh: 0.85, drums: 1.00, brassStabs: 1.00, percTexture: 0.85 },
              },
            ],
            mixRules: [
              'All stems share the same loop grid (8 bars at 96 BPM = 5.000 s per bar × 8 = 40.000 s). Crossfades must be beat-synced.',
              'Stem volume crossfade duration: 2 full bars (≈5.0 s) for layer transitions; ≤0.5 bar (≈1.25 s) for wave-entry brass stab onset.',
              'A stem absent in the target layer must fade to silence (not mute abruptly) over 1 bar (≈2.5 s) to avoid an audible click.',
              'Layer selection is driven by UARPGMusicManager reading the CombatIntensity float attribute on UARPGAttributeSet ' +
                '(ambient-tension=0.0–0.2, combat-low=0.2–0.6, combat-high=0.6–0.9, boss-swell=0.9–1.0).',
              'MetaSound trigger parameter MusicLayer (FName enum) controls which mix profile is active.',
            ],
            wiringContract: {
              grantedBy:
                'UARPGMusicManager (GameState component) reads DT_Music row keyed by music entity slug, ' +
                'instantiates SC_Music_<Slug> MetaSound asset, and sets the initial MusicLayer parameter.',
              activatedBy:
                'GAS GameplayEvent "MusicEvent.LayerChanged" broadcast by UARPGMusicManager when ' +
                'CombatIntensity attribute crosses a layer threshold; MetaSound responds via a trigger wired ' +
                'to a StemBlend node.',
              dependencies: [
                'zone-map::zone-z-ashen (zone hosts this track; areaLevel triggers CombatIntensity)',
                'combat-map::arena-ravaged-courtyard (arena encounter raises CombatIntensity on wave entry)',
              ],
              verification:
                'L0: stemsLayers.stems.length ≥ 6 and layers.length = 4; ' +
                'L3 (deferred): VSMusicTransitionTest — layer transitions occur within ≤0.5 bar of the CombatIntensity threshold crossing in PIE.',
            },
          },
        },
      }),
      accept: fieldsPopulated('stemsLayers', 'stems / layers / mixRules / wiringContract populated', [
        'stems',
        'layers',
        'mixRules',
        'wiringContract',
      ]),
    },

    // ── 3. Transitions ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Transitions',
      view: {
        kind: 'table',
        field: 'transitions',
        columns: [{ key: 'combatEnter' }, { key: 'combatExit' }, { key: 'beatSync' }],
      },
      produce: () => ({
        data: {
          transitions: {
            combatEnter: {
              trigger: 'GAS event "MusicEvent.CombatStart" broadcast by UARPGMusicManager on first enemy aggro',
              fromLayer: 'ambient-tension',
              toLayer: 'combat-low',
              crossfadeDuration: '2 bars (≈5.0 s at 96 BPM)',
              beatSyncRule:
                'Transition queued immediately but stem crossfade begins only at the next bar boundary ' +
                '(≤2.5 s wait) to keep the grid locked. War-drum onset must land on beat 1 of the transition bar.',
              brassStabOnset:
                'Brass stab parameter "WaveEntry" triggered at bar 1, beat 1 of the first combat-low bar — ' +
                'signals the encounter start without a telegraphed countdown.',
            },
            combatExit: {
              trigger: 'GAS event "MusicEvent.CombatEnd" broadcast when encounter waves complete (all enemies defeated)',
              fromLayer: 'combat-low OR combat-high',
              toLayer: 'ambient-tension',
              crossfadeDuration: '4 bars (≈10.0 s) — slower fade to signal earned relief without abruptness',
              beatSyncRule:
                'Crossfade begins at next bar boundary; drums fade first (2 bars), then brass/perc (2 bars), ' +
                'leaving only strings-low + tension-pad at ambient-tension profile.',
              resolveRule:
                'If CombatIntensity is still > 0.2 at bar 4 of the exit crossfade (e.g. straggler enemy), ' +
                'crossfade is interrupted and layer reverts to combat-low. No restart — resume in-progress.',
            },
            eliteEscalation: {
              trigger: 'GAS event "MusicEvent.EliteSpawned" (Rare Brute wave-2 entry) raises layer to combat-high',
              fromLayer: 'combat-low',
              toLayer: 'combat-high',
              crossfadeDuration: '1 bar (≈2.5 s) — fast escalation on elite spawn',
              stringsHighOnset:
                'High-strings dissonance stem fades in over the 1-bar transition window; ' +
                'must reach target volume profile by beat 1 of the next bar.',
            },
            bossClimax: {
              trigger: 'UARPGMusicManager detects elite HP ≤ 30% via HP_Percent attribute on target',
              fromLayer: 'combat-high',
              toLayer: 'boss-swell',
              crossfadeDuration: '0.5 bar (≈1.25 s) — near-immediate urgency',
              returnRule:
                'On elite kill: return to combat-high (or combat-low if no other enemies) over 2 bars. ' +
                'Boss-swell is never sustained beyond ≤30 s to avoid fatiguing the player.',
            },
            beatSyncImplementation:
              'UARPGMusicManager maintains a BarClock (float, 0.0–1.0 per bar at 96 BPM) driven by ' +
              'a UE AudioComponent callback. Transition requests are queued and flushed at the next ' +
              'BarClock = 0.0 tick. This is the only beat-sync point — no sub-bar sync in this track.',
            wiringContract: {
              grantedBy:
                'UARPGMusicManager reads DT_Music.transitionRules to build the MetaSound parameter map. ' +
                'Each transition is a named MetaSound trigger (CombatStart / CombatEnd / EliteSpawned / ' +
                'BossClimax / BossKilled) dispatched via FMetaSoundParameterName.',
              activatedBy:
                'GAS events MusicEvent.* broadcast from encounter actor (AARPGEncounterArena) on: ' +
                'first-aggro, wave-complete, elite-spawn, elite-HP-threshold, all-waves-complete.',
              dependencies: [
                'combat-map::arena-ravaged-courtyard (encounter actor broadcasts the GAS events)',
                'zone-map::zone-z-ashen (zone-level CombatEnd on full-zone clear)',
              ],
              verification:
                'L0: all 4 transitions declared with trigger + fromLayer + toLayer + crossfadeDuration; ' +
                'L3 (deferred): VSMusicTransitionTest — crossfades begin at the correct bar boundary in PIE; ' +
                'no audible click on any layer switch over 50 test transitions.',
            },
          },
        },
      }),
      accept: fieldsPopulated('transitions', 'combatEnter / combatExit / beatSyncImplementation / wiringContract', [
        'combatEnter',
        'combatExit',
        'beatSyncImplementation',
        'wiringContract',
      ]),
    },

    // ── 4. Loop & Markers ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Loop & Markers',
      view: {
        kind: 'table',
        field: 'loopMarkers',
        columns: [{ key: 'loopPoints' }, { key: 'transitionMarkers' }, { key: 'gridSpec' }],
      },
      produce: () => ({
        data: {
          loopMarkers: {
            gridSpec: {
              bpm: 96,
              timeSignature: '4/4',
              barDurationMs: 2500,
              stemLoopBars: 8,
              stemLoopMs: 20000,
              note:
                '8-bar loop at 96 BPM = 20 000 ms exactly. All stems are authored to this exact length. ' +
                'The 8-bar grid is the single shared loop unit — every stem loops independently at 20 000 ms. ' +
                'All crossfades are measured in integer bar multiples to stay on-grid.',
            },
            loopPoints: [
              {
                stemId: 'stem-drums',
                loopStartMs: 0,
                loopEndMs: 20000,
                loopCrossfadeMs: 20,
                note: 'Zero-crossing loop; minimal tail; confirm in MetaSound waveform editor before import.',
              },
              {
                stemId: 'stem-strings-low',
                loopStartMs: 0,
                loopEndMs: 20000,
                loopCrossfadeMs: 50,
                note: 'Sustain-tail crossfade of 50 ms to smooth the string resonance across the boundary.',
              },
              {
                stemId: 'stem-strings-high',
                loopStartMs: 0,
                loopEndMs: 20000,
                loopCrossfadeMs: 80,
                note: 'Slightly longer crossfade (80 ms) — dissonance cluster needs to breathe at the seam.',
              },
              {
                stemId: 'stem-brass-stabs',
                loopStartMs: 0,
                loopEndMs: 20000,
                loopCrossfadeMs: 10,
                note: 'Near-instant loop; brass stabs are event-driven (MusicEvent.WaveEntry trigger), so ' +
                  'the looping body is mostly silence — crossfade only needs to cover the sustain tail.',
              },
              {
                stemId: 'stem-perc-texture',
                loopStartMs: 0,
                loopEndMs: 20000,
                loopCrossfadeMs: 30,
                note: 'Short crossfade; percussion texture has no sustained tail.',
              },
              {
                stemId: 'stem-pad-tension',
                loopStartMs: 0,
                loopEndMs: 20000,
                loopCrossfadeMs: 200,
                note: 'Long slow-attack pad needs a generous crossfade to maintain harmonic continuity at the loop point.',
              },
            ],
            transitionMarkers: [
              {
                name: 'MarkerBar01',
                positionMs: 0,
                purpose: 'Loop start / beat 1 — the only valid beat-sync transition point (BarClock = 0.0)',
              },
              {
                name: 'MarkerBar03',
                positionMs: 5000,
                purpose: 'Mid-point reference for combat-enter crossfade progress monitoring',
              },
              {
                name: 'MarkerBar05',
                positionMs: 10000,
                purpose: 'Mid-loop reference; combat-exit drums-done marker (drums should reach silence here)',
              },
              {
                name: 'MarkerBar09',
                positionMs: 20000,
                purpose: 'Loop boundary (= MarkerBar01 + 20 000 ms) — for MetaSound internal loop-sync assertion',
              },
            ],
            loopAuthoring: [
              'All stems delivered at exactly 20 000 ms (960 samples of silence padding at 48 kHz if needed).',
              'Zero-crossing check required on every loop point before UE import; MetaSound waveform editor confirmation mandatory.',
              'Stems authored in the same project session (same tempo map, same sample clock) to guarantee grid alignment.',
              'Import as SoundWave assets in Content/Audio/Music/<Slug>/Stems/; loop points embedded in the .wav cue chunk.',
            ],
          },
        },
      }),
      accept: fieldsPopulated('loopMarkers', 'loopPoints / transitionMarkers / gridSpec / loopAuthoring', [
        'loopPoints',
        'transitionMarkers',
        'gridSpec',
        'loopAuthoring',
      ]),
    },

    // ── 5. Mix & Loudness ────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Mix & Loudness',
      view: {
        kind: 'table',
        field: 'loudness',
        columns: [{ key: 'integratedLUFS' }, { key: 'truePeak' }, { key: 'stemBalance' }],
      },
      produce: () => {
        // Loudness target: −16 LUFS integrated (game music delivery standard, headroom for SFX mix)
        // withinPercent uses a numeric field; encode as a positive value offset from 0:
        // integratedLUFS is the absolute value: 16.0 → checked within ±12.5% of 16 = 14–18 LUFS range
        const integratedLUFS = 16.0; // absolute value of the negative dBLUFS target
        return {
          data: {
            loudness: {
              integratedLUFS: -16.0,
              integratedLUFSTarget: '−16 LUFS ±2 LUFS (range −14 to −18 LUFS integrated)',
              truePeakMax: '−1.0 dBTP (all stems individually and combined)',
              dynamicRange:
                'ambient-tension layer: ≈ −22 LUFS; combat-low: ≈ −18 LUFS; ' +
                'combat-high: ≈ −16 LUFS; boss-swell: ≈ −14 LUFS (peak, ≤4 s bursts). ' +
                'Intentional loudness ramping across layers mirrors combat intensity progression.',
              stemBalance: {
                'stem-drums': 'kick peak at −6 dBFS; compressed to 4:1 with 10 ms attack; punchy, not boomy',
                'stem-strings-low': 'peak at −9 dBFS; lightly compressed 2:1; must not mask drum transients in the low-mid',
                'stem-strings-high': 'peak at −14 dBFS; thin (shelved below 400 Hz at −12 dB); presence without weight',
                'stem-brass-stabs': 'peak at −7 dBFS per stab event; 10 ms attack, 300 ms decay limiter',
                'stem-perc-texture': 'peak at −12 dBFS; mid-forward (bandpass 250 Hz–2 kHz) to layer under drums',
                'stem-pad-tension': 'peak at −15 dBFS; low-cut at 120 Hz; present only in ambient-tension layer',
              },
              masterBus: [
                'Limiter ceiling: −0.3 dBTP (hard limiter, not a clipper).',
                'No master-bus compression (transparency preferred; dynamics are musical).',
                'EQ: +1 dB shelf at 8 kHz (subtle air); −1 dB shelf at 120 Hz (prevent mud in SFX mix).',
                'Target measured with BS.1770-4 via the Fairlight or an offline LUFS meter before import.',
              ],
              spatialDelivery: 'Stereo (L/R). Music bus in UE does not use 3D spatialization; ' +
                'output through UAudioMixerBus::MusicBus with a 100 % direct send (no reverb on the music bus).',
              note:
                'In-engine the music bus sits below the master bus. SFX and voice buses are separate. ' +
                'The −16 LUFS target reserves ≥8 LU of headroom for combat SFX peaks, per game-audio practice.',
            },
            integratedLUFS, // numeric field for withinPercent (absolute value of target)
          },
        };
      },
      // −16 LUFS target expressed as absolute value 16.0; ±12.5% covers 14–18 LUFS acceptable range
      accept: withinPercent('integratedLUFS', 'Integrated LUFS within ±12.5% of −16 LUFS target (14–18 LUFS range)', 16.0, 12.5),
    },

    // ── 6. Trigger Binding ───────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Trigger Binding',
      view: {
        kind: 'table',
        field: 'triggerBinding',
        columns: [{ key: 'zoneTrigger' }, { key: 'arenaTrigger' }, { key: 'wiringContract' }],
      },
      produce: () => ({
        data: {
          triggerBinding: {
            zoneTrigger: {
              catalogLink: 'zone-map::zone-z-ashen',
              event: 'MusicEvent.AmbientStart',
              layer: 'ambient-tension',
              trigger:
                'UARPGMusicManager on zone load (AARPGGameMode::OnZoneLoaded) reads DT_Music row by slug, ' +
                'instantiates SC_Music_<Slug>, and immediately sets layer=ambient-tension. ' +
                'No delay after zone streaming completes.',
              stopEvent: 'MusicEvent.ZoneExit — zone transition or fast-travel queues a 4-bar fade-out.',
            },
            arenaTrigger: {
              catalogLink: 'combat-map::arena-ravaged-courtyard',
              event: 'MusicEvent.CombatStart',
              layer: 'combat-low',
              trigger:
                'AARPGEncounterArena::OnFirstEnemyAggroed broadcasts MusicEvent.CombatStart via UAbilitySystemBlueprintLibrary::SendGameplayEventToActor. ' +
                'UARPGMusicManager receives the event and queues a beat-synced layer transition to combat-low.',
              intensityMapping:
                'Wave 1 aggroed → CombatIntensity = 0.4 (combat-low); ' +
                'Wave 2 elite spawned → CombatIntensity = 0.75 (combat-high); ' +
                'Elite HP ≤ 30% → CombatIntensity = 0.95 (boss-swell). ' +
                'Values written by UARPGMusicManager to UARPGAttributeSet.CombatIntensity on the GameState.',
            },
            exclusivityRule:
              'Only one music track plays per zone. Zone-load triggers replace any prior track with a 2-bar crossfade. ' +
              'Music is never stacked or layered across zones.',
            priorityStack:
              'Boss-swell > combat-high > combat-low > ambient-tension. ' +
              'MusicManager enforces priority — a lower-priority request while a higher layer is active is silently dropped ' +
              '(not queued) unless the current encounter context changes first.',
            wiringContract: {
              grantedBy:
                'UARPGMusicManager (GameState component) — reads DT_Music row on zone load and manages the active track lifecycle.',
              activatedBy:
                'GAS events MusicEvent.AmbientStart (zone load) + MusicEvent.CombatStart (first aggro) ' +
                'broadcast by AARPGGameMode and AARPGEncounterArena respectively.',
              dependencies: [
                'zone-map::zone-z-ashen (zone-load event source)',
                'combat-map::arena-ravaged-courtyard (encounter combat events source)',
              ],
              verification:
                'L0: triggerBinding fields populated and both catalogLinks present; ' +
                'L2: DT_Music row seeded via seed_music.py; UARPGMusicManager.cpp compiled in Source/PoF/; ' +
                'L3 (deferred): VSMusicTransitionTest — ambient-tension plays on zone load, combat-low on first aggro.',
            },
          },
        },
        links: [
          { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'zone-music-trigger' },
          { catalogId: 'combat-map', entityId: 'arena-ravaged-courtyard', role: 'combat-music-trigger' },
        ],
      }),
      accept: fieldsPopulated('triggerBinding', 'zoneTrigger / arenaTrigger / wiringContract populated', [
        'zoneTrigger',
        'arenaTrigger',
        'wiringContract',
      ]),
    },

    // ── 7. Streaming Budget ──────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Streaming Budget',
      view: {
        kind: 'table',
        field: 'streamingBudget',
        columns: [{ key: 'memorySizeMB' }, { key: 'streamingPolicy' }, { key: 'budgetRules' }],
      },
      produce: () => ({
        data: {
          streamingBudget: {
            // Six stems × 8 bars × 2 ch × 48 kHz × 24-bit ÷ 8 = 6 × 20 s × 2 × 48000 × 3 bytes ≈ 34.56 MB raw
            // Compressed (Vorbis Q6, ≈ ×10 reduction): ≈ 3.5 MB resident; streaming pulls from disk on demand.
            rawStemSizeMBEach: 5.76,
            rawStemSizeMBTotal: 34.56,
            compressedSizeMBEach: 0.58,
            compressedSizeMBTotal: 3.48,
            memorySizeMB: 3.48,
            streamingPolicy: {
              format: 'Vorbis quality 6 (≈128 kbps per stem, stereo)',
              loadingPriority: 'Medium (below ambient beds, above one-shot SFX)',
              streamingChunkSizeKB: 256,
              prebufferBars: 2,
              note:
                'Stems are streamed, not fully resident. Only the currently active layer\'s stems are ' +
                'prebuffered (2 bar / 5 s lookahead). Inactive stems are demand-loaded on layer switch ' +
                'with the 2-bar beat-sync delay providing sufficient time to avoid a loading stall.',
            },
            budgetRules: [
              'Total compressed resident memory ≤ 4 MB (all 6 stems pre-loaded in ambient-tension; combat stems streamed on demand).',
              'Streaming peak: 4 stems simultaneously active (combat-high) × 128 kbps = 512 kbps — well within platform streaming bandwidth.',
              'Do not author stems longer than 8 bars (20 000 ms) to contain chunk count.',
              'MetaSound asset uses SoundAsset references, not inline PCM baking, to keep the asset small.',
              'UE SoundClass: Music — inherits master Music volume slider; routed through AudioMixerBus::MusicBus.',
              'Compression format for packaged game: OGG Vorbis; preview format in editor: PCM (no re-encode during iteration).',
            ],
          },
        },
      }),
      accept: fieldsPopulated('streamingBudget', 'memorySizeMB / streamingPolicy / budgetRules populated', [
        'memorySizeMB',
        'streamingPolicy',
        'budgetRules',
      ]),
    },

    // ── 8. Icon 2D Art (universal L1 gallery step) ────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_MusicIcon`],
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
        ],
      }),
      accept: selected('selected', 'A track icon candidate is selected'),
    },

    // ── 9. Test Gate (runtime-deferred L3) ───────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'ambient-tension layer plays on zone-z-ashen load (MusicEvent.AmbientStart received)',
            'combat-low layer transitions on first enemy aggro in arena-ravaged-courtyard (MusicEvent.CombatStart, beat-synced)',
            'combat-high layer transitions when elite Brute wave-2 spawns (MusicEvent.EliteSpawned, ≤1 bar delay)',
            'boss-swell triggers when elite HP ≤ 30% (≤0.5 bar delay)',
            'combat-exit crossfade completes over 4 bars (≈10 s) with no audible click',
            'integrated LUFS measured at −16 ±2 LUFS in the MetaSound profiler (50 consecutive loops)',
            'true peak of combined stems ≤ −1.0 dBTP',
            'all 6 stem loop points are click-free over 100 loop iterations in PIE audio profiler',
            'DT_Music row present; UARPGMusicManager resolves the row key without a missing-row warning in PIE log',
            'no audio stalls on layer switch (stream prebuffer completes within 2-bar beat-sync window)',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSMusicTransitionTest',
        'Combat transition crossfades on cue in PIE',
      ),
    },

    // ── 10. UE Packaging ─────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `SC_Music_${s}`,
          `DT_Music :: ${s}`,
          `SW_${s}_StemDrums`,
          `SW_${s}_StemStringsLow`,
          `SW_${s}_StemStringsHigh`,
          `SW_${s}_StemBrassStabs`,
          `SW_${s}_StemPercTexture`,
          `SW_${s}_StemPadTension`,
        ];
        return {
          data: {
            assets,
            contentPaths: {
              metaSound: `/Game/Audio/Music/${s}/SC_Music_${s}`,
              dataTable: `/Game/Audio/Music/DT_Music`,
              stemsFolder: `/Game/Audio/Music/${s}/Stems/`,
              iconTexture: `/Game/UI/Icons/T_${s}_MusicIcon`,
            },
            wiringContract: {
              grantedBy:
                `UARPGMusicManager (AARPGGameState component) reads FARPGMusicRow from DT_Music keyed by "${s}", ` +
                `instantiates SC_Music_${s} MetaSound asset, and manages stem-layer playback lifecycle.`,
              activatedBy:
                'AARPGGameMode::OnZoneLoaded → UARPGMusicManager::StartTrack("' + s + '") → ' +
                'MetaSound MusicLayer parameter set to "ambient-tension". ' +
                'Subsequent GAS events (MusicEvent.*) control layer transitions per transition rules.',
              dependencies: [
                'zone-map::zone-z-ashen (zone-load trigger; must declare music CatalogLink to this row)',
                'combat-map::arena-ravaged-courtyard (encounter events broadcast by AARPGEncounterArena)',
                'icon-sets::iconset-abilities (icon family for UI music track display)',
              ],
              verification:
                `L2: SC_Music_${s} present in Content/Audio/Music/${s}/; ` +
                `DT_Music row seeded via seed_music.py (row key "${s}"); ` +
                `UARPGMusicManager.cpp compiled in Source/PoF/; ` +
                'L3 (deferred): VSMusicTransitionTest — all 10 test checks pass in PIE audio profiler.',
            },
          },
          ueAssets: [
            `/Game/Audio/Music/${s}/SC_Music_${s}`,
            `/Game/Audio/Music/DT_Music`,
            ...['StemDrums', 'StemStringsLow', 'StemStringsHigh', 'StemBrassStabs', 'StemPercTexture', 'StemPadTension']
              .map((stem) => `/Game/Audio/Music/${s}/Stems/SW_${s}_${stem}`),
            `/Game/UI/Icons/T_${s}_MusicIcon`,
          ],
          links: [
            { catalogId: 'zone-map', entityId: 'zone-z-ashen', role: 'zone-music-trigger' },
            { catalogId: 'combat-map', entityId: 'arena-ravaged-courtyard', role: 'combat-music-trigger' },
            { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
          ],
        };
      },
      accept: minCount('assets', '≥8 UE assets packaged (MetaSound + DT row + 6 stems)', 8),
      staticChecks: (e) => [
        seedRowPresent('seed_music.py', slug(e.name), 'Music row seeded in Content/Python'),
      ],
    },
  ],
});
