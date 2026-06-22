# Cutscenes Pipeline

> Catalog ID `cutscenes` · Category Quests & Narrative · `dialogue-quests` module · 13 steps · Tracks: animation, audio, vfx, test

**Purpose.** Authors a scripted in-engine `LevelSequence` (Unreal Sequencer) cutscene — timed beats, animated actors, camera cuts, VO, VFX, music, and skip/replay logic. The system-of-record for the playback contract is Unreal Sequencer + a `UARPGCinematicComponent` that wraps the LevelSequence asset, handles skip/replay input, and fires GameplayEvents at named beat markers. The component starts the sequence at game start (pre-first-gameplay-frame); beat-marker EventTrack notifies advance quest state or enable UI — never raw `SequencePlayer` calls in Blueprint without the wrapper.

## Target / starter entity
- **Prologue: The Fall** (`cutscene-prologue`) — The opening ~90-second in-engine cinematic, set in the smouldering ruins of the Thornwall garrison three days after the Sundering. Establishes the post-Sundering world without exposition and introduces Captain Vael as the player's first Ashen Order contact. Skippable after a 3-second grace window, replayable from the main menu.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength('brief', ≥300)` |
| 2 | Beat Sheet & Shot List | rules | — | L0 · `minCount('beats', ≥1)` |
| 3 | Blocking / Body Anim | checklist | — | L0 · `minCount('blockingChecks', ≥1)` |
| 4 | Facial / Lipsync | checklist | — | L0 · `minCount('facialChecks', ≥1)` |
| 5 | Lighting | rules | — | L0 · `fieldsPopulated('lighting', [globalSetup, beatSetups])` |
| 6 | VFX | rules | `NS_FireImpactBurst` (from vfx) | L0 · `fieldsPopulated('vfx', [systems, wiringContract])` |
| 7 | Music & SFX | rules | `SC_Prologue_*` audio | L0 · `fieldsPopulated('musicSfx', [music, ambience, sfxCues, wiringContract])` |
| 8 | VO | checklist | — | L0 · `minCount('voChecks', ≥1)` |
| 9 | Subtitles & Loc | checklist | — | L0 · `minCount('subtitleChecks', ≥1)` |
| 10 | Skip / Replay Rules | rules | `WBP_CinematicSkipPrompt` | L0 · `fieldsPopulated('skipReplay', [skipGraceWindowSecs, skipInput, skipBehavior, replayAvailability, noRetrigger])` |
| 11 | Icon 2D Art | gallery | `T_<name>_CinematicIcon` | L1 · `selected('selected')` |
| 12 | Test Gate | checklist | — | L3 · `runtimeDeferred('VSCutsceneTimingTest')` |
| 13 | UE Packaging | manifest | `LS_<s>`, `T_<s>_CinematicIcon`, `V_PP_<s>_Cinematic`, `NS_<s>_AshFall`, `NS_<s>_RubbleDust`, `SC_<s>_WindEmbers`, `SC_<s>_DistantCollapse`, `WBP_CinematicSkipPrompt` | L0 · `minCount('assets', ≥3)` |

## UE wiring
- **C++ symbols:** `UARPGCinematicComponent` (on PlayerController/GameMode; `PlayCutscene` / `SkipCutscene` / `ReplayCutscene` / `NotifyBeat`; the shared cinematic component — no per-cutscene C++ symbol is invented, so step 13 deliberately omits `cppSymbolExists`).
- **Primary asset:** `LS_<s>` LevelSequence at `/Game/Cinematics/<s>/` (`primaryAssetClass: 'LevelSequence'`).
- **Beat markers (EventTrack → `NotifyBeat`):** `Cutscene.Beat.VaelIntroEnter@38`, `Cutscene.Beat.VaelEyeContact@58`, `Cutscene.Beat.EmberCrescendo@72`, `Cutscene.Beat.End@82`; `State.Prologue.CutsceneWatched` tag applied on End/skip (GameMode bypasses the cutscene if already set).
- **Other assets:** `NS_Prologue_AshFall` / `NS_Prologue_RubbleDust` / `NS_FireImpactBurst` (Niagara, ember burst fired from AnimNotify per canon art-vfx), `V_PP_<s>_Cinematic` post-process volume, `SC_*` ambient/SFX cues, `WBP_CinematicSkipPrompt`, `IA_Skip`/`IMC_Cinematic` Enhanced Input.
- **Runtime test:** `VSCutsceneTimingTest` (PIE — sequence plays full 90 s, beats fire at declared tc ±0.1 s, skip/replay function).
- **Cross-catalog links:** characters (`char-captain-vael` on-screen actor), music (`music-combat-a` low-tension/silence stem switch via `UARPGMusicComponent.FadeToSilence`), vfx (`vfx-fire-impact` palette-overridden ember burst at beat 6), icon-sets (`iconset-abilities` cinematic icon family).

## Acceptance profile
Tiers used: **L0** (data — brief/beats/lighting/vfx/music/skip-replay/assets and the GAP-noting checklists), **L1** (human selection — icon gallery), **L3** (runtime-deferred — `VSCutsceneTimingTest`). No L2 static checks or L4 visual gates. Config-complete means: the brief and beat sheet are present, lighting/VFX/music/skip-replay rule fields populate, an icon is selected, and ≥3 UE cinematic assets are packaged — full-timing playback and skip/replay behavior deferred to PIE.

## Status & notes
13-step pipeline, the largest of the Quests & Narrative group. Honest gap acknowledged across two steps: **no dedicated lipsync pipeline exists** (Vael delivers no lines, sidestepping the gap cleanly) and **no mocap pipeline** (animation via Control Rig / Mixamo retarget). The VO step is deliberately empty ("[NO VO]") — narrative is environmental and performative. Post-Sundering tone (restraint over spectacle) is encoded in the brief, lighting, and SFX. Bridge-driven runtime verification is deferred to `VSCutsceneTimingTest`.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
