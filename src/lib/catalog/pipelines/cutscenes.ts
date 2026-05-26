import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Cutscenes pipeline (catalogId: 'cutscenes').
 *
 * Represents a scripted in-engine LevelSequence (Unreal Sequencer) cutscene —
 * timed beats, animated actors, camera cuts, VO, VFX, music, and skip/replay
 * logic.  The system-of-record for the playback contract is Unreal Sequencer +
 * a UARPGCinematicComponent that wraps the LevelSequence asset, handles
 * skip/replay input, and fires GameplayEvents at named beat markers.
 *
 * Target entity: "Prologue: The Fall" (cutscene-prologue) — the opening
 * in-engine cinematic that establishes the post-Sundering world and introduces
 * Captain Vael as the player's first contact with the Ashen Order.
 *
 * Post-Sundering tone: grim, weathered, earned.  No triumphant fanfares.
 * Events are witnessed at ground level — smoke, ruin, soldiers carrying the
 * wounded.  The Sundering is already over; this sequence is the aftermath.
 *
 * Top-level cross-catalog links:
 *   characters::char-captain-vael  — primary on-screen actor (role: 'actor')
 *   music::music-combat-a          — adaptive combat track (role: 'underscoring-music')
 *
 * Wiring: UARPGCinematicComponent on the GameMode/PlayerController starts the
 * LevelSequence asset (LS_Prologue_TheFall) at game start; skip/replay are
 * handled via the component — never raw UE SequencePlayer calls in Blueprint
 * without the wrapper.  Beat markers in the Sequencer timeline fire
 * GameplayEvents that advance quest state or enable UI.
 */
registerCatalogPipeline({
  catalogId: 'cutscenes',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the opening in-engine cutscene of PoF — a ~90-second LevelSequence ` +
            `set in the smouldering ruins of the Thornwall garrison, three days after the Sundering. ` +
            `It establishes the post-Sundering world without exposition: a player character ` +
            `regaining consciousness among the fallen, the garrison in ruin, and the first ` +
            `glimpse of Captain Vael — Ashen Order — pulling a survivor clear of the fire. ` +
            `Vael does not speak to the player; the sequence ends with his eyes locking onto ` +
            `the player and a cut to gameplay. ` +
            `Tone: restraint over spectacle. No heroic swells. Ash in the air, distant fire, ` +
            `the sound of wind and embers. The Sundering won — this is what it left behind. ` +
            `Design intent: 90 s, skippable after a 3-second grace window, replayable from the ` +
            `main menu. The sequence drives the player into the first act without narration or ` +
            `on-screen text — the world context is environmental and performative. ` +
            `Cross-catalog: Captain Vael (char-captain-vael) is the on-screen named actor. ` +
            `Music underscoring is the adaptive combat track music-combat-a (low-tension stem). ` +
            `The closing VFX beat uses vfx-fire-impact (embers / dying fire variant, muted palette). ` +
            `Facial/lipsync pipeline: NO dedicated lipsync pipeline exists today; this is an ` +
            `honest gap — Vael delivers no lines in this sequence, which sidesteps the gap cleanly.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Beat Sheet & Shot List ─────────────────────────────────────────────
    // archetype: 'rules' — ordered narrative beats with camera assignments, timing.
    // Wiring: these beats map 1:1 to Sequencer sub-sections; beat markers fire GameplayEvents.
    {
      archetype: 'rules',
      label: 'Beat Sheet & Shot List',
      view: {
        kind: 'table',
        field: 'beats',
        columns: [
          { key: 'index' },
          { key: 'tcIn', unit: 's' },
          { key: 'tcOut', unit: 's' },
          { key: 'description' },
          { key: 'shot' },
          { key: 'event' },
        ],
      },
      produce: () => ({
        data: {
          beats: [
            {
              index: 1,
              tcIn: 0,
              tcOut: 8,
              description: 'BLACK. Distant rumble — the echo of the Sundering. Fade from black to ash-grey sky, smoke drifting left-to-right.',
              shot: 'Wide aerial — Thornwall garrison from above, 300 m elevation.  Slow push-in, lens ~35 mm.  Depth of field locked on ruins.',
              event: 'none — establishing hold',
            },
            {
              index: 2,
              tcIn: 8,
              tcOut: 20,
              description: 'Cut to ground level.  Player character lies face-down in rubble.  Hand twitches.  Character slowly pushes upright, coughing.',
              shot: 'Extreme close-up of hand on stone, then rack-focus pull to a medium-close on the player face (partial, not full reveal).  Handheld feel — slight drift.',
              event: 'none — player orientation beat',
            },
            {
              index: 3,
              tcIn: 20,
              tcOut: 38,
              description: 'Player character stands.  POV sweep of the garrison — burning beams, soldiers down, ash falling.  A survivor reaches out from rubble, then goes still.',
              shot: 'OTS (over-the-shoulder) push forward, 360° slow orbit half-complete.  One insert cut: low-angle on the still survivor hand.',
              event: 'none — world-state reveal',
            },
            {
              index: 4,
              tcIn: 38,
              tcOut: 58,
              description: 'Captain Vael enters frame left, moving at purpose.  He reaches a wounded soldier and hauls them clear of a collapsed arch — professional, no hesitation.',
              shot: 'Medium long-shot, Vael left-screen, fire-orange background right.  Cut to medium two-shot: Vael crouching over wounded, player watching in background (MG soft-focus).',
              event: 'Gameplay event marker "Cutscene.Beat.VaelIntroEnter" fires at tcIn:38 (UARPGCinematicComponent notified; no player input at this beat)',
            },
            {
              index: 5,
              tcIn: 58,
              tcOut: 72,
              description: 'Vael stands.  Pauses.  Turns.  Eyes find the player character across the debris field.  Two-second hold on eye contact — Vael unreadable.',
              shot: 'Push-in on Vael face: bust shot, slight Dutch angle +3°, 50 mm lens.  Then match-cut reverse on player (Vael POV), similar framing.',
              event: 'Beat marker "Cutscene.Beat.VaelEyeContact" fires at tcIn:58',
            },
            {
              index: 6,
              tcIn: 72,
              tcOut: 82,
              description: 'VFX: dying fire collapses in foreground, embers scatter across frame.  Wide pull-back to aerial match of Beat 1 — but the camera keeps rising.',
              shot: 'Wide shot matching Beat 1, then a slow crane-up exit.  VFX ember burst keyed to an AnimNotify at tcIn:72 (links vfx::vfx-fire-impact, muted palette variant).',
              event: 'Beat marker "Cutscene.Beat.EmberCrescendo" at tcIn:72 — music-combat-a shifts from low-tension to silence stem over 10 s',
            },
            {
              index: 7,
              tcIn: 82,
              tcOut: 90,
              description: 'HARD CUT TO BLACK.  Two seconds of silence.  Then the first gameplay frame appears.',
              shot: 'Fade-to-black over 0.4 s.  Hold 2 s.  DISSOLVE to gameplay.',
              event: 'Beat marker "Cutscene.Beat.End" at tcIn:82 — UARPGCinematicComponent fires Cutscene.End, re-enables player input, loads gameplay frame',
            },
          ],
          totalDurationSecs: 90,
          skipWindowSecs: 3,
          note:
            'Beat indices are contiguous; no gaps in timeline. ' +
            'Total runtime 90 s — all beats sum exactly.  ' +
            'GameplayEvent names follow Cutscene.<Sequence>.<BeatName> convention per proj-naming. ' +
            'Beat markers in the Sequencer timeline use an EventTrack bound to UARPGCinematicComponent. ' +
            'Wiring: UARPGCinematicComponent.NotifyBeat(name) dispatches events to the owning PlayerController; ' +
            'Cutscene.Beat.End re-enables Enhanced Input and removes the cinematic input context.',
          wiringContract: {
            grantedBy:
              'UARPGCinematicComponent on the PlayerController/GameMode loads LS_Prologue_TheFall ' +
              'at game-start (pre-first-gameplay-frame); beat markers are EventTrack notifies ' +
              'bound to UARPGCinematicComponent.NotifyBeat.',
            activatedBy:
              'Game start (pre-gameplay) → PlayerController.BeginPlay → ' +
              'UARPGCinematicComponent.PlayCutscene("cutscene-prologue") → ' +
              'LS_Prologue_TheFall begins; beat events fire at marked frames.',
            dependencies: [
              'characters (char-captain-vael — animated actor in the sequence)',
              'music (music-combat-a — low-tension/silence stem switch at beat 6)',
              'vfx (vfx-fire-impact — ember burst at beat 6, muted palette)',
            ],
            verification:
              'L2: LS_Prologue_TheFall asset path registered; UARPGCinematicComponent.cpp compiled; ' +
              'L3: VSCutsceneTimingTest — sequence plays full 90 s, beat events fire at declared tc, ' +
              'skip/replay function in PIE (deferred)',
          },
        },
        links: [
          { catalogId: 'characters', entityId: 'char-captain-vael', role: 'actor' },
          { catalogId: 'music',      entityId: 'music-combat-a',    role: 'underscoring-music' },
          { catalogId: 'vfx',        entityId: 'vfx-fire-impact',   role: 'ember-burst-vfx' },
        ],
      }),
      accept: minCount('beats', '≥1 beat with tc/shot/event defined', 1),
    },

    // ── 3. Blocking / Body Animation ──────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Blocking / Body Anim',
      view: { kind: 'checklist', field: 'blockingChecks' },
      produce: () => ({
        data: {
          blockingChecks: [
            'Player character: regain-consciousness recovery animation (A_PCinema_Prologue_Wakeup) authored or selected from Manny base set',
            'Player character: stand-up + cough loop (A_PCinema_Prologue_StandUp) — ≤4 s, loopable tail',
            'Player character: idle-observe loop while watching Vael (A_PCinema_Prologue_Observe) — still, weight in feet',
            'Captain Vael: purposeful-walk entry from frame-left (A_Vael_Prologue_WalkEntry) — military cadence, no bounce',
            'Captain Vael: crouch-and-haul wounded soldier clear of arch (A_Vael_Prologue_HaulSurvivor) — contact anim, IK hands on wounded',
            'Captain Vael: stand-and-turn (A_Vael_Prologue_TurnToPlayer) — held on last frame until eye-contact beat',
            'Captain Vael: sustained eye-contact idle (A_Vael_Prologue_EyeContactIdle) — 2 s hold, micro shoulder breathe only',
            'Wounded soldier: collapse-and-still transition (A_NPC_Prologue_CollapseStill) — generic, reuse from Manny morph if available',
            'All clips are authored in the LevelSequence timeline with correct blend-in/-out frames (≥4 frames blend)',
            'Root motion baked for all walk/haul clips; no Z-swimming on Vael or player',
          ],
          gapNote:
            'Mocap pipeline is not available.  All animations are authored via UE Control Rig or imported ' +
            'Mixamo base clips (Manny retarget).  Bespoke facial animation (Vael eye-contact beat) relies on ' +
            'Control Rig pose-to-pose key-framing — no dedicated facial/lipsync pipeline.  This is an honest gap ' +
            'acknowledged below in the Facial/Lipsync step.',
        },
      }),
      accept: minCount('blockingChecks', '≥1 blocking/body anim check listed', 1),
    },

    // ── 4. Facial / Lipsync ───────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Facial / Lipsync',
      view: { kind: 'checklist', field: 'facialChecks' },
      produce: () => ({
        data: {
          facialChecks: [
            '[GAP] No dedicated lipsync pipeline exists — Vael delivers no dialogue in this sequence, which sidesteps the gap for this cutscene',
            '[GAP] Facial performance is key-framed manually via UE Control Rig: Vael eyebrow micro-compression (eye-contact beat), eye-direction track, jaw-closed throughout',
            'Facial tracks authored in Sequencer on Vael\'s FaceRig layer: FACIAL_VaelBrowCompression (t=58–60), FACIAL_VaelEyeContact (t=58–72)',
            'Player character face is not shown in close-up during this sequence (partial reveal only) — no facial track required',
            'If a lipsync pipeline (Wav2Lip / MetaHuman Animator) is added in a future session, facial performance on this cutscene should be revisited',
          ],
          gapNote:
            'Lipsync is deferred — no spoken VO exists in this sequence, making the gap non-blocking for this entity. ' +
            'Future cutscenes with VO must author a lipsync plan before the Facial/Lipsync step is considered config-complete.',
        },
      }),
      accept: minCount('facialChecks', '≥1 facial/lipsync check or gap-note listed', 1),
    },

    // ── 5. Lighting ───────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Lighting',
      view: {
        kind: 'table',
        field: 'lighting',
        columns: [{ key: 'beat' }, { key: 'mood' }, { key: 'setup' }],
      },
      produce: () => ({
        data: {
          lighting: {
            globalSetup: {
              timeOfDay: 'Overcast dawn — approximately 06:00, no direct sun',
              skyLight: 'L_SkyLight_CinematicPrologue (intensity 0.4, Lux; diffuse-only to avoid harsh bounce)',
              fogDensity: 'ExponentialHeightFog density 0.06 — ash-grey, horizon obscured past 400 m',
              colorTemp: '6200 K (neutral-cool, desaturated earth tones to match art-identity palette)',
            },
            beatSetups: [
              {
                beat: '1–3 (aerial + rubble)',
                mood: 'Cold desolation — no warmth',
                setup: 'Dominant key: large-area soft directional from NNW at -8° elevation (no sharp shadows). ' +
                  'Rim from fire glow off-screen right (~1800 K warm orange, 0.15 intensity) to separate silhouettes from rubble.',
              },
              {
                beat: '4–5 (Vael enters + eye contact)',
                mood: 'Tense, purposeful — fire as antagonist light source',
                setup: 'Hero fill: spot attached to Vael BP, 5500 K, intensity 1.2 — keeps face legible. ' +
                  'Background fire glow boosted to 0.35 intensity for contrast separation. ' +
                  'Dutch-angle camera at beat 5 paired with a slight left-eye rim from the fire side.',
              },
              {
                beat: '6–7 (ember crescendo + black)',
                mood: 'Fade to silence — warmth extinguishing',
                setup: 'Key fades 20% over 8 s. Fire glow ramps to 0.0 by tcOut:82. ' +
                  'A single cool-white backlight (0.08 intensity) keeps ash-fall particle legible on black fade.',
              },
            ],
            notes:
              'All lights authored in the LevelSequence lighting track — no persistent world lights modified. ' +
              'Cinematic post-process volume (V_PP_Prologue_Cinematic) overrides bloom 0.25, vignette 0.4, ' +
              'contrast 1.05 for the cinematic look; deactivated at Cutscene.Beat.End.',
          },
        },
      }),
      accept: fieldsPopulated('lighting', 'global setup and per-beat setups defined', [
        'globalSetup',
        'beatSetups',
      ]),
    },

    // ── 6. VFX ────────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'VFX',
      view: {
        kind: 'table',
        field: 'vfx',
        columns: [{ key: 'beat' }, { key: 'system' }, { key: 'note' }],
      },
      produce: () => ({
        data: {
          vfx: {
            systems: [
              {
                beat: 'Persistent (beats 1–7)',
                system: 'NS_Prologue_AshFall',
                description:
                  'Continuous ambient ash / ember drift.  Spawn rate 30 particles/s, velocity drift left (matches sky-light direction). ' +
                  'GPU budget: ~0.12 ms (well within per-class limit ~0.48 ms).  ' +
                  'Authored as a persistent Niagara actor spawned at Sequencer start, destroyed at Cutscene.Beat.End.',
                note: 'Original asset — no catalog link needed.',
              },
              {
                beat: 'Beat 3 (tcIn:20) — survivor reach',
                system: 'NS_Prologue_RubbleDust',
                description:
                  'One-shot dust burst as player character rises from rubble.  0.3 s burst, 80-particle count. ' +
                  'Keyed via Sequencer particle track at tc=20.  GPU budget: ~0.04 ms peak.',
                note: 'Original asset — no catalog link needed.',
              },
              {
                beat: 'Beat 6 (tcIn:72) — ember crescendo',
                system: 'NS_FireImpactBurst (from vfx::vfx-fire-impact)',
                description:
                  'Dying fire collapses: ember burst fore-ground.  Uses vfx-fire-impact Niagara system with a muted, de-saturated palette override ' +
                  '(emitter parameter FireColorTint = (0.4, 0.25, 0.1) — ash-grey ember tone, not combat orange). ' +
                  'Spawn count 200, spread cone 180°, gravity 0.6.  Duration 2 s. ' +
                  'Keyed via AnimNotify at tc=72 on the cinematic camera track (canon art-vfx: fired from notify, not BeginPlay). ' +
                  'GPU budget: ~0.18 ms peak (within ~0.48 ms cap).',
                catalogLink: 'vfx::vfx-fire-impact',
                note: 'Palette override via Niagara emitter parameter, not a new asset — reuses the seeded vfx-fire-impact system.',
              },
            ],
            wiringContract: {
              grantedBy:
                'Niagara actors spawned from the LevelSequence actor track (NS_Prologue_AshFall, NS_Prologue_RubbleDust) ' +
                'or from an AnimNotify on the cinematic camera track (NS_FireImpactBurst at tc=72).',
              activatedBy:
                'Sequencer playback — actors are spawned/enabled at the declared tc values; ' +
                'the ember burst fires via AnimNotify (canon art-vfx: never BeginPlay/timer).',
              dependencies: [
                'vfx (vfx-fire-impact — NS_FireImpactBurst, palette-overridden for the muted ember beat)',
              ],
              verification:
                'L2: NS_FireImpactBurst asset path present under /Game/VFX/; vfx-fire-impact seeded in new-catalogs.ts; ' +
                'L3: VSCutsceneTimingTest — ember burst fires at tc=72 ± 0.1 s in PIE (deferred)',
            },
          },
        },
        links: [
          { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'ember-burst-vfx' },
        ],
      }),
      accept: fieldsPopulated('vfx', 'VFX systems and wiring contract defined', [
        'systems',
        'wiringContract',
      ]),
    },

    // ── 7. Music & SFX ────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Music & SFX',
      view: {
        kind: 'table',
        field: 'musicSfx',
        columns: [{ key: 'element' }, { key: 'description' }, { key: 'timing' }],
      },
      produce: () => ({
        data: {
          musicSfx: {
            music: {
              track: 'music-combat-a (low-tension stem)',
              description:
                'The adaptive combat track music-combat-a is used in its lowest-tension stem configuration — ' +
                'sparse strings and low drone, no percussion.  This is the ambient underscoring layer, not a combat cue. ' +
                'Stem switch: at beat 6 (tcIn:72, "Cutscene.Beat.EmberCrescendo"), music-combat-a fades its active stems ' +
                'to silence over 10 s via UARPGMusicComponent.FadeToSilence(duration=10).  ' +
                'The sequence ends in silence (tc=82–90), giving the cut-to-gameplay a clean audio start.',
              startTime: 0,
              fadeOutAtBeat: 6,
              fadeOutDurationSecs: 10,
              catalogLink: 'music::music-combat-a',
            },
            ambience: {
              description:
                'Two ambient SFX layers run from the Sequencer audio track: ' +
                '(1) SC_Prologue_WindEmbers — looping wind + crackle, 0.5 volume, panning left. ' +
                '(2) SC_Prologue_DistantCollapse — one-shot structural-collapse impact at tc=8 (beat 1 end), ' +
                'sub-bass emphasis, reinforcing the aerial reveal.',
              assets: ['SC_Prologue_WindEmbers', 'SC_Prologue_DistantCollapse'],
            },
            sfxCues: [
              { tc: 20, cue: 'SC_PCinema_Cough', description: 'Player character cough — short, dry, 1 hit. Authored from SC pool.' },
              { tc: 38, cue: 'SC_Vael_Footstep_Stone', description: 'Vael boot on stone rubble — cadenced, 3 impacts over 1.5 s as he crosses.' },
              { tc: 58, cue: 'SC_Prologue_BreathHold', description: '0.4 s near-silence breath-hold on eye-contact beat — dramatic beat pause.' },
              { tc: 72, cue: 'SC_FireImpactBurst_Muted', description: 'Soft whoosh + ember crackle timed to the NS_FireImpactBurst VFX. Derived from fire SFX pool, filtered through a low-pass shelf to match the muted VFX palette.' },
            ],
            wiringContract: {
              grantedBy:
                'Music: UARPGMusicComponent on PlayerController plays music-combat-a low-tension stem from tc=0; ' +
                'fades to silence at beat 6 via Cutscene.Beat.EmberCrescendo event. ' +
                'SFX: Sequencer audio tracks carry the ambient loops and one-shot cues directly — no external trigger needed.',
              activatedBy:
                'Music: UARPGCinematicComponent.PlayCutscene fires StartMusic(music-combat-a, stem:low-tension) at start; ' +
                'beat event "Cutscene.Beat.EmberCrescendo" at tc=72 calls FadeToSilence(10). ' +
                'SFX: Sequencer timeline — audio sub-tracks play at declared tc values.',
              dependencies: [
                'music (music-combat-a — adaptive combat track, low-tension stem)',
              ],
              verification:
                'L2: music-combat-a seeded in new-catalogs.ts; SC_ assets present under /Game/Audio/Cinematics/; ' +
                'L3: VSCutsceneTimingTest — music-combat-a stem plays from tc=0, FadeToSilence fires at tc=72, ' +
                'SFX cues play at declared tc values in PIE (deferred)',
            },
          },
        },
        links: [
          { catalogId: 'music', entityId: 'music-combat-a', role: 'underscoring-music' },
        ],
      }),
      accept: fieldsPopulated('musicSfx', 'music / ambience / sfxCues / wiring contract defined', [
        'music',
        'ambience',
        'sfxCues',
        'wiringContract',
      ]),
    },

    // ── 8. VO ─────────────────────────────────────────────────────────────────
    // No spoken VO in this sequence — honest gap documented.
    {
      archetype: 'checklist',
      label: 'VO',
      view: { kind: 'checklist', field: 'voChecks' },
      produce: () => ({
        data: {
          voChecks: [
            '[NO VO] This sequence contains no spoken dialogue — all narrative is environmental and performative',
            'Vael has no lines in this cutscene (deliberate design: his character is established through action, not speech)',
            'Player character has no lines (pre-class-selection; VO identity undefined at prologue stage)',
            'VO hooks in UARPGCinematicComponent exist for future cutscenes — the wiring contract supports SC_ assets bound to beat markers',
            'If VO is added in a revised version, VO lines must follow the ≤10-word-per-line cap and be authored in Content/Localization/Cinematics/',
          ],
          voNote:
            'No VO required for this entity.  VO pipeline readiness is noted for future cutscenes with spoken lines.',
        },
      }),
      accept: minCount('voChecks', '≥1 VO entry or gap-note listed', 1),
    },

    // ── 9. Subtitles & Loc ────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Subtitles & Loc',
      view: { kind: 'checklist', field: 'subtitleChecks' },
      produce: (e: LabEntity) => ({
        data: {
          subtitleChecks: [
            '[NO VO → no spoken subtitles] Sequence has no dialogue lines requiring subtitle text',
            `Accessibility caption for the sequence title: CINEMATIC_${slug(e.name).toUpperCase()}_TITLE — displayed in the skip-prompt overlay (e.g. "[A] Skip Cinematic: Prologue: The Fall")`,
            `Skip-prompt loc key: CINEMATIC_${slug(e.name).toUpperCase()}_SKIP_PROMPT — format "{ButtonIcon} Skip Cinematic: {CinematicTitle}"`,
            `Replay-prompt loc key: CINEMATIC_${slug(e.name).toUpperCase()}_REPLAY_PROMPT — format "{ButtonIcon} Replay Cinematic: {CinematicTitle}"`,
            'All loc keys follow the CINEMATIC_<SLUG>_<KEY> convention in Content/Localization/Cinematics/',
            'Non-English translations must preserve the skip/replay prompt length so the overlay widget does not overflow at 1080p',
            'On-screen text accessibility: skip-prompt font ≥ 16 pt, white on 50% dark panel, AA contrast (canon art-icon-a11y)',
          ],
          locNotes:
            'No spoken subtitle keys are required for this entity.  The loc surface is limited to the ' +
            'skip/replay UI overlay.  Future voiced cutscenes must author CINEMATIC_<SLUG>_NODE_<N>_LINE keys.',
        },
      }),
      accept: minCount('subtitleChecks', '≥1 subtitle or loc check listed', 1),
    },

    // ── 10. Skip / Replay Rules ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Skip / Replay Rules',
      view: {
        kind: 'table',
        field: 'skipReplay',
        columns: [{ key: 'rule' }, { key: 'detail' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          skipReplay: {
            skipGraceWindowSecs: 3,
            skipInput: 'IA_Skip (Enhanced Input action; any face button / Space key); input mapping in IMC_Cinematic context',
            skipBehavior:
              'After the 3-second grace window, the skip-prompt overlay becomes visible. ' +
              'On skip input: UARPGCinematicComponent.SkipCutscene() — immediately fires Cutscene.Beat.End, ' +
              'stops the LevelSequence, re-enables player input, and transitions to gameplay. ' +
              'World state is force-set to match the post-cutscene state (State.Prologue.CutsceneWatched applied even on skip).',
            replayAvailability:
              'Replayable from the main menu via Settings → Gallery → Cinematics. ' +
              `Replay key: '${e.id}' (cutscene-prologue).  UARPGCinematicComponent.ReplayCutscene("${e.id}") ` +
              'sets a ReplayMode flag that suppresses world-state mutation effects during replay.',
            noRetrigger:
              'State.Prologue.CutsceneWatched tag applied on Cutscene.Beat.End (or on skip). ' +
              'GameMode.BeginPlay checks the tag — if set, bypasses the cutscene entirely and goes directly to gameplay.',
            hudBehavior:
              'HUD is fully suppressed during the cutscene (input mode GameOnly, HUD hidden). ' +
              'Only the skip-prompt overlay (WBP_CinematicSkipPrompt) is visible after the grace window. ' +
              'Widget class reference in ProjectSettings → ARPG → CinematicSkipWidgetClass (canon proj-hud-binding).',
            wiringContract: {
              grantedBy:
                'UARPGCinematicComponent on the PlayerController handles skip/replay logic. ' +
                'WBP_CinematicSkipPrompt is added to viewport after the grace window timer expires.',
              activatedBy:
                'IA_Skip action (Enhanced Input) → UARPGCinematicComponent.OnSkipInput() after grace window. ' +
                'Replay: main-menu UI → UARPGCinematicComponent.ReplayCutscene(id).',
              dependencies: [
                'UARPGCinematicComponent (PlayerController component — handles playback, skip, replay, beat events)',
              ],
              verification:
                'L2: UARPGCinematicComponent.cpp compiled; IA_Skip input action declared in IMC_Cinematic; ' +
                'WBP_CinematicSkipPrompt in /Game/UI/Cinematics/; ' +
                'L3: VSCutsceneTimingTest — skip fires Cutscene.Beat.End, State.Prologue.CutsceneWatched applied, ' +
                'replay suppresses world-state mutation (deferred)',
            },
          },
        },
      }),
      accept: fieldsPopulated('skipReplay', 'skip/replay rules defined', [
        'skipGraceWindowSecs',
        'skipInput',
        'skipBehavior',
        'replayAvailability',
        'noRetrigger',
      ]),
    },

    // ── 11. Icon 2D Art (universal) ───────────────────────────────────────────
    // Every row includes an Icon 2D Art gallery step (L1, archetype: 'gallery').
    // Linked to icon-sets::iconset-abilities (the seeded shared icon family).
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-source' },
        ],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_CinematicIcon`],
      }),
      accept: selected('selected', 'A cinematic thumbnail/icon is selected'),
    },

    // ── 12. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'Sequence plays from tc=0 to tc=90 without stalls or hitches in PIE',
            'Beat events fire at declared tc values (±0.1 s tolerance): VaelIntroEnter@38, VaelEyeContact@58, EmberCrescendo@72, End@82',
            'Skip input fires Cutscene.Beat.End and transitions to gameplay within 1 frame',
            'State.Prologue.CutsceneWatched tag applied after sequence completes OR after skip',
            'GameMode.BeginPlay skips the cutscene entirely if State.Prologue.CutsceneWatched is already set',
            'Replay mode: cutscene plays correctly from the gallery menu; world-state mutation suppressed',
            'music-combat-a FadeToSilence fires at tc=72; no audio artifact on fade',
            'NS_FireImpactBurst ember burst triggers at tc=72 (AnimNotify pathway)',
            'All actor blocking animations complete without IK/foot-skating artifacts on char-captain-vael',
            'HUD is fully hidden during the sequence; WBP_CinematicSkipPrompt visible only after 3 s grace window',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSCutsceneTimingTest',
        'Sequence plays + skip/replay work in PIE',
      ),
    },

    // ── 13. UE Packaging ──────────────────────────────────────────────────────
    // LevelSequence is the primary UE artifact.
    // No cppSymbolExists staticCheck: no custom C++ class unique to cutscenes is required
    // (UARPGCinematicComponent is the shared component — its existence would be checked by a
    // platform-level test, not per-cutscene).  Honest: omit staticChecks rather than invent a symbol.
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `LS_${s}`,
          `T_${s}_CinematicIcon`,
          `V_PP_${s}_Cinematic`,
          `NS_${s}_AshFall`,
          `NS_${s}_RubbleDust`,
          `SC_${s}_WindEmbers`,
          `SC_${s}_DistantCollapse`,
          `WBP_CinematicSkipPrompt`,
        ];
        return {
          data: {
            assets,
            primaryAssetClass: 'LevelSequence',
            primaryAssetPath: `/Game/Cinematics/${s}/LS_${s}`,
            wiringContract: {
              grantedBy:
                `UARPGCinematicComponent on the PlayerController references LS_${s} ` +
                `(the LevelSequence asset at /Game/Cinematics/${s}/LS_${s}). ` +
                `WBP_CinematicSkipPrompt is spawned by the component after the grace window.`,
              activatedBy:
                `PlayerController.BeginPlay (first game load, no State.Prologue.CutsceneWatched tag) → ` +
                `UARPGCinematicComponent.PlayCutscene("${e.id}") → LS_${s} plays; ` +
                `beat EventTrack notifies bound to UARPGCinematicComponent.NotifyBeat(name). ` +
                `Skip: IA_Skip → UARPGCinematicComponent.SkipCutscene(). ` +
                `Replay: gallery menu → UARPGCinematicComponent.ReplayCutscene("${e.id}").`,
              dependencies: [
                'characters (char-captain-vael — animated NPC actor spawned/referenced in LS track)',
                'music (music-combat-a — low-tension stem started at PlayCutscene; faded at EmberCrescendo beat)',
                'vfx (vfx-fire-impact — NS_FireImpactBurst palette-overridden in Sequencer VFX track at tc=72)',
                'icon-sets (iconset-abilities — cinematic icon art family)',
              ],
              verification:
                `L2: LS_${s} asset path registered under /Game/Cinematics/; ` +
                `UARPGCinematicComponent.cpp compiled; WBP_CinematicSkipPrompt in /Game/UI/Cinematics/; ` +
                `char-captain-vael actor referenced in LS_${s} track; ` +
                `L3: VSCutsceneTimingTest — sequence plays full 90 s, beats fire at declared tc, ` +
                `skip/replay work in PIE (deferred)`,
            },
          },
          ueAssets: [
            `/Game/Cinematics/${s}/LS_${s}`,
            `/Game/UI/Icons/T_${s}_CinematicIcon`,
            `/Game/Cinematics/${s}/V_PP_${s}_Cinematic`,
            `/Game/VFX/NS_${s}_AshFall`,
            `/Game/VFX/NS_${s}_RubbleDust`,
            `/Game/Audio/Cinematics/SC_${s}_WindEmbers`,
            `/Game/Audio/Cinematics/SC_${s}_DistantCollapse`,
            `/Game/UI/Cinematics/WBP_CinematicSkipPrompt`,
          ],
        };
      },
      accept: minCount('assets', '≥3 UE cinematic assets packaged', 3),
    },
  ],
});
