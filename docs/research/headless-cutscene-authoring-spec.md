# Headless Cutscene Authoring — LevelSequence from a Beat Sheet (spec)

> **Status: authoring PROVEN headless (2026-08-17) — build not started.**
> Source: *"I Built a Souls-Like Game in 3 Days — Every Asset Made by AI"* (Stefan 3D AI,
> youtube `9kejfKCb0S8`, [23:10]) — the one task the author let Claude do *unattended* was the
> in-game cinematic (the boss-reveal camera move when the gate is entered): "surprisingly
> interesting use case … it can do a good job, and with some extra help you can do it way nicer".
> Verified by a live headless probe on the installed UE 5.8.0.
> Probe: `<UE project>/Content/Python/sequencer_probe.py` (markers `POF_SEQ:`).

## What this is

The `cutscenes` catalog pipeline has 12 steps and **no engine for the shot itself**: per
`src/lib/status/step-facts.json` its *Beat Sheet & Shot List* is "unverified prose" (Claude text,
`minCount(1)` shape check), *Blocking / Body Anim* has `trueEngine: None`, *Lighting* / *VFX* /
*Music & SFX* are text-config with no render. Nothing turns the beat sheet's camera assignments and
timings into a `LevelSequence` — the artifact UE actually plays.

This spec names the engine: **beat sheet → LevelSequence asset**, authored by the same
`-run=pythonscript` commandlet path every other headless PoF engine uses (Dataflow rig-transfer,
Chaos Cloth, ARDY import). A camera-only cinematic is a pure asset-authoring problem — no ticking
world, no physics, no PIE — so it sits on the *proven* side of the commandlet boundary
(unlike physics settle, `ue-gotchas` `headless-physics-settle`).

## Proven headless (probe, 2026-08-17)

Under `-run=pythonscript -nullrhi -EnablePlugins=SequencerScripting,LevelSequenceEditor`, judged
by `POF_SEQ:` markers in the abslog (exit code 0 as well):

- `AssetTools.create_asset(name, pkg, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())` →
  a LevelSequence asset created (`/Game/PoF/Probes/LS_ProbeBossReveal`).
- `set_display_rate(FrameRate(30,1))`, `set_playback_start/end(0, 150)` → range 0–150 read back.
- `seq.add_spawnable_from_class(unreal.CineCameraActor)` → a **spawnable** CineCamera binding
  (`RELOAD_BINDINGS ['Cine Camera Actor']`) — the sequence owns its camera, no level actor needed.
- `binding.add_track(MovieScene3DTransformTrack)` → `add_section()` → `set_range(0,150)` →
  `get_all_channels()` = **9 double channels** (Loc XYZ, Rot XYZ, Scale XYZ) → `ch.add_key(FrameNumber, value)`
  — 4 keys (a dolly + crane) written and **read back after save+reload: `keys 4 range (0, 150)`**.
- `seq.add_track(MovieSceneCameraCutTrack)` → `add_section()` → `set_range` →
  `set_camera_binding_id(MovieSceneSequenceExtensions.get_binding_id(seq, cam_binding))` — the
  camera cut is bound to the spawnable camera (`RELOAD_CUT_BINDING … range 0 150`).
- `EditorAssetLibrary.save_asset` → `True`; reload lists `['MovieSceneCameraCutTrack']` + the
  binding's `MovieSceneSpawnTrack` (infinite range — normal) + the transform track.

Pitfalls recorded (each cost one run):
- `-script=` **relative paths resolve against `Engine/Binaries/Win64`**, not the project — pass an
  absolute path (or `cd` there first).
- Binding-id helpers are on the extensions class, and the 5.8 names are
  `MovieSceneSequenceExtensions.get_binding_id / get_portable_binding_id / resolve_binding_id`
  (no `make_binding_id`).
- A `MovieSceneSpawnSection` has no start/end frame — guard with `has_start_frame()` before
  reading ranges on reload.
- `MovieSceneObjectBindingID` exposes no `.guid` in Python; don't log it that way.
- `LevelSequenceEditorBlueprintLibrary` resolves but drives the *open Sequencer UI* — do not use it
  headless; author through `MovieScene*Extensions` only.

## Build plan (L — not started)

1. **`src/lib/visual-gen/cutscene-runner.ts`** (mirror `mesh-finish.ts`: pure `buildArgs`/`parse`
   + injectable spawn seam) driving a committed `scripts/ue/pof_cutscene_author.py` that takes a
   JSON **shot list** — `{ fps, shots: [{ start, end, camera: { from, to, fovFrom?, fovTo? },
   lookAt?: actorTagOrPath }] }` — and writes one LevelSequence: one spawnable CineCamera per shot
   (or one camera + cuts), transform keys from `from/to`, a camera-cut per shot, `Focal Length`
   keys on the camera component when `fov*` are given.
2. **Beat Sheet & Shot List step → shot-list JSON.** The step already authors ordered beats with
   camera assignments + timings; make its produce body emit the machine-readable `shots[]` beside
   the prose (spec-linter rule: the field is required), so the sequence is derived, not re-prompted.
3. **`look-at` resolution** by actor tag through the existing bridge (`pof_ue_manifest` /
   `EditorActorSubsystem.get_all_level_actors` in the same script) — a boss reveal needs to aim at
   the boss, and tags are how the composition solver already names actors.
4. **Acceptance = artifact, not marker:** re-load the saved sequence and assert
   `bindings ≥ 1`, `camera-cut sections == shots.length`, `transform keys ≥ 2 × shots.length`, and
   playback range = last shot end. That is the *Beat Sheet* step's first meaningful checker; the
   render-and-look pass (`-DumpMovie` filmstrip → VLM critique) is the L4 that follows and is
   already a proven pattern (`docs/research/vlm-critique-experiment.md`).
5. **Not in scope:** blocking / body anim (needs ARDY / MHA clips), lipsync, VFX — those steps stay
   honest about their gaps; the camera engine does not pretend to cover them.

## Status-map impact

`cutscenes` · *Beat Sheet & Shot List* → `powers-engine` (Claude prose → real LevelSequence
asset) + `hardens-checker` (reload-verified track/key counts replace `minCount(1)`), and the row's
*Test Gate* gains a real artifact to time (`VSCutsceneTimingTest` currently defers with nothing to
test).
