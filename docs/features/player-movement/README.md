# Player Movement Pipeline

> Catalog ID `player-movement` · Category Game Assets · `arpg-character` module · 10 steps · Tracks: animation, test

**Purpose.** The autonomously-built Tier-2 locomotion pipeline: Mixamo + WASD + Shift sprint + Space roll, driving the player from no animation to a PIE-and-feel playable gate. **Bridge-driven** — every step that builds UE assets dispatches a Python module on the editor thread via `/pof/python/run`, and acceptance reads the module's structured return envelope (`{created, skipped, failed, ...}`) from the persisted artifact. (See `docs/superpowers/specs/2026-05-27-player-movement-design.md`.)

## Target / starter entity
- **Manny Locomotion** (`player-locomotion-manny`, Movement; tags `mixamo`, `locomotion`) — WASD + Shift sprint + Space roll, from no animation to a PIE-and-feel playable gate.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets / Python module) | Acceptance |
|---|------|-----------|--------------------------------------|------------|
| 1 | Mesh + Skeleton | rules | `player_movement.verify_mesh` | L2/L3 bridge · `pythonStepOk` (BP_VSPlayer mesh = SKM_Manny + IMC/IA present) |
| 2 | Mixamo Source | checklist | — (human drop of 10 FBX) | L1 · `humanConfirmed('confirmed')` — 10 Mixamo FBX in `Content/Source/Mixamo/Raw/` |
| 3 | Import Mixamo Clips | manifest | `player_movement.import_clips` | L2/L3 bridge · `pythonStepSuccess(≥10)` — 10 AnimSequences under `/Game/Mixamo/Raw/` |
| 4 | IK Rigs | manifest | `player_movement.build_ik_rigs` | L2/L3 bridge · `pythonStepSuccess(≥3)` — `IK_Mixamo` + `IK_Manny` + `RTG_MixamoToManny` |
| 5 | Retarget Clips | manifest | `player_movement.retarget` | L2/L3 bridge · `pythonStepSuccess(≥10)` — 10 `_RT` clips under `/Game/Mixamo/Retargeted/SKM_Manny/` |
| 6 | Blend Space Grid | rules | `player_movement.build_blend_space` | L2/L3 bridge · `pythonStepSuccess(≥11)` — 11-sample 8-way strafe grid in `BS_Locomotion` |
| 7 | PoFEditor Build | rules | `player_movement.verify_anim_bp_lib` | L2/L3 bridge · `pythonStepOk` — `UPoFAnimBPAuthoringLibrary` symbol resolves |
| 8 | ABP_VSPlayer | graph | `player_movement.build_anim_bp` | L2/L3 bridge · `pythonStepSuccess(≥1)` — `ABP_VSPlayer` authored + compiled |
| 9 | AM_Roll Montage | rules | `player_movement.build_montage` | L2/L3 bridge · `pythonStepSuccess(≥1)` — `AM_Roll` with iframe notify at frame 2 |
| 10 | Playable Gate | custom | `player_movement.run_playable_gate` | L4 visual deferred · `visualDeferred` — PIE + WASD/Sprint/Roll + 4-frame variance proves not-T-pose |

## UE wiring
- **Python modules dispatched** (`{ python: { module, function: 'run' } }`, all under `player_movement.*`): `verify_mesh`, `import_clips`, `build_ik_rigs`, `retarget`, `build_blend_space`, `verify_anim_bp_lib`, `build_anim_bp`, `build_montage`, `run_playable_gate` — executed on the editor thread via `/pof/python/run`.
- **C++ symbol probed by Python:** `UPoFAnimBPAuthoringLibrary` (PoFEditor module; step 7 rebuilds PoFEditor then restarts the editor, step 8 calls into this library to author the AnimBP).
- **Realized UE assets:** `BP_VSPlayer` (mesh `SKM_Manny`), 10 imported AnimSequences, `IK_Mixamo`/`IK_Manny`/`RTG_MixamoToManny`, 10 `_RT` retargeted clips, `BS_Locomotion` (X=direction, Y=speed), `ABP_VSPlayer`, `AM_Roll` (+ `AnimNotify_DodgeWindow` iframe at frame 2).
- **Playable gate (L4):** drives PIE, injects WASD + Shift + Space, captures 4 frames, asserts walked/sprinted/rolled and that frame variance proves the AnimBP is driving the mesh (not a T-pose).

## Acceptance profile
Unique to this pipeline: **bridge-driven** via the `pythonStep` checkers. Step 2 is **L1** (`humanConfirmed`). Steps 1, 3–9 are **L2** on a clean Python run (no `failed` entries, enough `created`+`skipped`); before any run they report **L3 `deferred`** (`pending bridge run`), keeping them config-complete/walkable in stub mode. Step 10 is **L4 visual-deferred** (`visualDeferred`). Deferred gates: every Python step pre-run (L3) and the Playable Gate (L4). Config-complete = the dispatch is authored and each step sits `deferred` with a reason until the editor bridge runs the module live.

## Status & notes
**The only bridge-driven pipeline in the catalog** — no `cppSymbolExists`/`seedRowPresent` static checks; truth comes from the Python return envelope, not UE source parsing. Surfaced in `NEW_CATALOGS` (Game Assets) specifically to retire its previously orphaned / walker-skip status. The pipeline self-registers on import; `PLAYER_MOVEMENT_STEPS_TEST_HELPER` is a test-only export. Step 7 is effectively a once-per-PoFEditor-source-change L0 symbol probe; the AnimBP author (step 8) depends on it resolving.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
