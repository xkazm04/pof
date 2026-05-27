# Player Movement (Tier-2 Mixamo) Design

**Date:** 2026-05-27
**Status:** Design — approved sections 1–4, awaiting user review of the written spec.
**Goal:** From terminal to a playable UE5 character — WASD locomotion, Shift sprint, Space roll — with Mixamo-quality animations and a PIE+visual-capture acceptance gate, all driven from the PoF app, zero UE editor adjustments after a one-time Mixamo download.

---

## Locked Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Animation tier = Mixamo (Tier-2) from the start.** | User wants long-term scalability to hundreds of ability/spell anims. UE Manny default clips would block at ~5 clips. Mixamo's standardized skeleton + UE5 IK Retargeter = one pipeline, unlimited content. |
| 2 | **Movement style = 8-way strafe blend with cursor aim.** | Matches existing `bCursorAimActive` cursor-aim code in `ARPGPlayerCharacter`. Visually correct for ARPG genre. Costs 9 locomotion clips vs 5 for face-direction-of-travel. |
| 3 | **Architecture = Approach A (catalog-pipeline shape).** | 10 `StepSpec` rows in the existing `/layout` lab. Reuses the chassis the project already proved on 30 catalog rows + the one-shot mode. Per-step rollback. Composable with future Tier-3 (Lyra clips, Motion Matching). |
| 4 | **AnimBP authoring = fully procedural via `UPoFAnimBPAuthoringLibrary`.** | ~200 LOC C++ in PoFEditor module. Pays the cost once; every future AnimBP becomes a 30-line Python script. No binary template assets in repo. Justified by "experiment with animations more" requirement. |
| 5 | **Bridge surface = new `POST :30040/run-python` route.** | Existing `run-automation` returns only bool PASS/FAIL — we need structured JSON. New route uses the same `FHttpRouter` plumbing; takes `{module, function, args}`, returns `{ok, data\|error, logs}`. |
| 6 | **Headline gate = L4 (PIE + input simulation + visual capture).** | Frame-variance check catches silent "AnimBP compiled but not driving the mesh" failures (a known recurring bug class in the project). Worth the ~2s capture cost. |
| 7 | **Idempotency = every Python module re-entry-safe.** | Drop one new clip in `Raw/` → rerun only step 5 → only that clip retargets. The experimentation handle the user asked for. |

---

## Architecture

```
PoF app (/layout lab)
  characters / player-movement / v1-default-player
  └─ 10 StepSpec rows (View / Produce / Acceptance)
       ↓ Produce: POST :30040/run-python {module, function, args}
       ↓ Acceptance: derived from on-disk artifacts (asset registry, BP introspection)

PoF Bridge plugin (UE editor)
  /run-python   → executes python_module.function(args) on the editor thread
  /run-automation → existing; used by step 10 to trigger FVSPlayerMovementTest
  /capture      → existing; used by step 10 for the L4 visual snapshot

UE editor Python (Content/Python/player_movement/)
  import_clips.run({raw_dir})         → step 3
  build_ik_rigs.run({})               → step 4
  retarget.run({clip_names?})         → step 5
  build_blend_space.run({})           → step 6
  build_anim_bp.run({})               → step 8 (after step 7 builds the library)
  build_montage.run({})               → step 9

PoFEditor C++ module (UPoFAnimBPAuthoringLibrary)
  CreateAnimBlueprint(skel, path, name)
  AddStateMachine(abp, sm_name)
  AddBlendSpaceState(abp, sm_name, state_name, bs, speed_var, dir_var)
  AddDefaultSlot(abp, slot_name)
  ConnectStateMachineToOutputPose(abp, sm_name, slot_name)
  CompileAndSave(abp)

Existing UE code (already shipping)
  Source/PoF/Player/ARPGPlayerController.cpp   IMC + IA bindings (WASD/Shift/Space)
  Source/PoF/Player/ARPGPlayerCharacter.cpp    StartSprinting/StopSprinting/cursor aim
  Source/PoF/Character/ARPGCharacterBase.cpp   character base
  Content/Input/Actions/IA_Move|IA_Sprint|IA_Dodge.uasset
  Content/Input/IMC_VerticalSlice.uasset
  Content/Characters/Player/Animations/BS_Locomotion.uasset (sample-data populated by step 6)
  Content/VerticalSlice/BP_VSPlayer.uasset     (mesh + ABP set by step 1 + step 8)
```

---

## The 10-Step Pipeline

Each step lists: **Produce** (what runs), **Accept** (what's asserted), **Tier** (L0–L4).

### Step 1 — mesh-and-skeleton

**Produce:** Python loads `BP_VSPlayer`, ensures `Mesh.SkeletalMesh = SKM_Manny` and `Capsule.HalfHeight = 90`. Also asserts existence of `IA_Move`, `IA_Sprint`, `IA_Dodge`, `IMC_VerticalSlice` (folded in here so step 10 doesn't fail with a confusing "input not consumed").
**Accept:** `BP_VSPlayer.CDO.Mesh.SkeletalMesh != null`, mesh path == `/Game/Characters/Manny/SKM_Manny`, capsule half-height == 90, all 3 IA assets present, IMC has key bindings for `IA_Move(W/A/S/D)`, `IA_Sprint(Shift)`, `IA_Dodge(Space)`.
**Tier:** L2 (deterministic asset + CDO check)

### Step 2 — mixamo-source

**Produce:** App-side panel. User points to `<repo>/Content/Source/Mixamo/Raw/` (or drag-drop the FBXs in). Panel lists the 10 expected filenames and flags missing.
**Expected file set:**
```
Standard_Idle.fbx          (with skin — brings the X Bot rig)
Walking.fbx                 (without skin)
Walking_Backwards.fbx       (without skin)
Left_Strafe_Walking.fbx     (without skin)
Right_Strafe_Walking.fbx    (without skin)
Running.fbx                 (without skin)
Running_Backward.fbx        (without skin)
Left_Strafe.fbx             (without skin)
Right_Strafe.fbx            (without skin)
Forward_Roll.fbx            (without skin, In Place OFF — root motion drives the dodge)
```
**Mixamo settings (all):** FBX Binary, 30 fps, no keyframe reduction, Character = X Bot, "In Place" ON for all except Forward_Roll.
**Accept:** All 10 filenames present, each ≥ 20 KB (catches accidental empty downloads).
**Tier:** L1 (human selection — user explicitly confirms the file set)

### Step 3 — mixamo-import

**Produce:** Python `import_clips.run({raw_dir})`. Per file, builds `AssetImportTask` with Mixamo-tuned `FbxAnimSequenceImportData` (use_default_sample_rate=False, import_meshes_in_bone_hierarchy=False, animation_length=AnimatedKey). First file (Standard_Idle, has skin) imports the skeletal mesh + skeleton too. Subsequent files reuse the skeleton.
**Accept:** 10 `AnimSequence` assets present under `/Game/Mixamo/Raw/`, each with frame count ≥ 30.
**Tier:** L2

### Step 4 — ik-rigs

**Produce:** Python `build_ik_rigs.run({})`. Idempotent.
- Creates `IK_Mixamo` (root = Hips, chain definitions for Spine, ArmL, ArmR, LegL, LegR, Head)
- Creates `IK_Manny` (root = pelvis, chains for matching limbs on Manny's skeleton)
- Creates `RTG_MixamoToManny` source=IK_Mixamo, target=IK_Manny, retarget pose = identity (Mixamo & Manny share A-pose family — verified empirically)
**Accept:** All 3 assets exist; retargeter source/target rigs are correctly assigned; retarget pose max bone delta < 0.001 rad (identity pose sanity check).
**Tier:** L2

### Step 5 — retarget

**Produce:** Python `retarget.run({clip_names?=null})`. Default = all clips in `/Game/Mixamo/Raw/` that don't have a counterpart in `/Game/Mixamo/Retargeted/SKM_Manny/`. Uses `unreal.IKRetargeterController.batch_retarget`.
**Accept:** 10 retargeted assets under `/Game/Mixamo/Retargeted/SKM_Manny/`, each with frame count == source clip's frame count.
**Tier:** L2

### Step 6 — blend-space

**Produce:** Python `build_blend_space.run({})`. Loads existing `BS_Locomotion`, programs sample grid (X=direction −1..1, Y=speed 0..1):
```
(-1, 0)= Idle               (0, 0)= Idle               ( 1, 0)= Idle
(-1, 0.5)= Left_Strafe_Walking_RT   (0, 0.5)= Walking_RT      ( 1, 0.5)= Right_Strafe_Walking_RT
(-1, 1)= Left_Strafe_RT     (0, 1)= Running_RT         ( 1, 1)= Right_Strafe_RT
                            (0, -0.5)= Walking_Backwards_RT
                            (0, -1)= Running_Backward_RT
```
(suffix `_RT` = retargeted, full path `/Game/Mixamo/Retargeted/SKM_Manny/<Name>_RT`.)
**Accept:** `BS_Locomotion.SampleData.Num() == 11` (9 positive-Y grid samples — Idle shares the 3 zero-speed positions — plus 2 negative-Y back samples), each sample's animation reference matches the expected retargeted asset path.
**Tier:** L2

### Step 7 — pof-editor-build

**Produce:** Bridge invokes MSBuild on `PoFEditor.Build.cs`. If `PoFEditor` module doesn't exist, scaffolds it (Build.cs, Module.h/cpp, ~30 LOC boilerplate). Adds `UPoFAnimBPAuthoringLibrary.h/cpp` (~200 LOC: 6 UFUNCTION wrappers around `KismetEditorUtilities::SpawnNodeFromTemplate`, `FAnimGraphNode_StateMachine::SpawnNode`, `UEdGraphSchema_K2::TryCreateConnection`, `FKismetEditorUtilities::CompileBlueprint`). User must restart UE editor after this step.
**Accept:** `PoFEditor.dll` rebuilt after current source SHA; `unreal.PoFAnimBPAuthoringLibrary` symbol resolvable from Python.
**Tier:** L0 (source-tree state check — file mtimes + symbol presence)

### Step 8 — anim-blueprint

**Produce:** Python `build_anim_bp.run({})`. Calls into the freshly-loaded `unreal.PoFAnimBPAuthoringLibrary`:
```python
lib = unreal.PoFAnimBPAuthoringLibrary
abp = lib.create_anim_blueprint(skel, "/Game/Characters/Player", "ABP_VSPlayer")
lib.add_state_machine(abp, "Locomotion")
lib.add_blend_space_state(abp, "Locomotion", "Strafe",
                          bs_locomotion, "Velocity.Size", "Direction")
lib.add_default_slot(abp, "DefaultSlot")
lib.connect_state_machine_to_output_pose(abp, "Locomotion", "DefaultSlot")
lib.compile_and_save(abp)
```
Also sets `BP_VSPlayer.Mesh.AnimClass = ABP_VSPlayer.GeneratedClass`.
**Accept:** `ABP_VSPlayer` exists, parent class is `AnimInstance`, target skeleton = Manny, compile status = `EBlueprintStatus::BS_UpToDate`, state machine `Locomotion` present with `BS_Locomotion` as the only blend space referenced. `BP_VSPlayer.CDO.Mesh.AnimClass == ABP_VSPlayer.GeneratedClass`.
**Tier:** L2

### Step 9 — roll-montage

**Produce:** Python `build_montage.run({})`. Creates `AM_Roll` from `Forward_Roll_RT`. Single slot section using `DefaultGroup.DefaultSlot`. Adds `AnimNotify_DodgeWindow` notify at frame 2 (the iframe window — the existing C++ side will read this to drive invuln).
**Accept:** `AM_Roll` exists, slot anim track references `Forward_Roll_RT`, has exactly 1 notify of type `UAnimNotify_DodgeWindow` at frame 2.
**Tier:** L2

### Step 10 — playable-gate (the L4 headline)

**Produce:** Bridge `/run-automation { filter: "VSPlayerMovement" }` → triggers `FVSPlayerMovementTest`. Then bridge `/capture` for the final visual snapshot.
**FVSPlayerMovementTest.cpp behavior (full sequence):**
1. Open PIE at `/Game/Maps/TestLevel_PlayerMovement` (small flat plane, single PlayerStart, no enemies). Map is built by an idempotent helper if missing.
2. Wait up to 1s for `PlayerController->GetPawn()` to return an `AARPGPlayerCharacter`.
3. Record `L0 = Player.GetActorLocation()`.
4. Inject `IA_Move = (0, 1)` for 1.5s via `UEnhancedInputLocalPlayerSubsystem::InjectInputForAction`.
5. **Assert** `(Player.Location - L0).Size() >= 300`. (walks forward)
6. Inject `IA_Sprint = true` (held).
7. Tick 0.5s. **Assert** `CharacterMovement->MaxWalkSpeed >= 750`. (sprint engaged)
8. Inject `IA_Move = (1, 1)` for 1s. (strafe-forward-right)
9. **Assert** `BS_Locomotion`'s active sample is in `(X>0, Y>0)` quadrant. (strafe blend lit)
10. Release `IA_Sprint`, release `IA_Move`.
11. Inject `IA_Dodge` pulse.
12. **Assert** `Mesh->GetAnimInstance()->Montage_IsPlaying(AM_Roll)`. (roll fires)
13. Wait montage end (poll `Montage_IsPlaying` with 3s timeout).
14. During the 1.5s walk window, the test calls bridge `/capture` 4 times at 0.4s intervals. Snapshots saved as `Saved/PlayerMovementGate/frame_N.png`.
15. **Assert** mean luminance variance across the 4 frames > threshold (catches silent T-pose where AnimBP isn't driving the mesh).

**Failure modes return specific reasons:**
- `"WalkSpeed too low (got 420, expected ≥ 750) — sprint not engaged"`
- `"AM_Roll not playing — montage wiring broken or HandleDodge not invoked"`
- `"Frame variance below threshold — possible T-pose"` (with PNG paths in artifact data)

**Tier:** L4 (PIE + input simulation + visual capture)

**Documented fallback:** if `InjectInputForAction` proves unreliable in PIE context, downgrade *only* step 10 to L3 — call the controller's `HandleMove`/`HandleSprintStart`/`HandleDodge` directly, skip the input-simulation layer. Visual capture stays. Other 9 steps unaffected.

---

## File Manifest

### New — PoF app

| Path | Purpose | Approx LOC |
|---|---|---|
| `src/lib/catalog/pipelines/player-movement.ts` | The 10-step `StepSpec[]` recipe | 200 |
| `src/components/layout-lab/steps/player-movement/index.ts` | Step registry export | 30 |
| `src/components/layout-lab/steps/player-movement/01-mesh-and-skeleton.tsx` | Step 1 Produce panel | 80 |
| `src/components/layout-lab/steps/player-movement/02-mixamo-source.tsx` | Step 2 — file-list View + folder picker + drag-drop | 150 |
| `src/components/layout-lab/steps/player-movement/03-mixamo-import.tsx` | Step 3 Produce panel | 70 |
| `src/components/layout-lab/steps/player-movement/04-ik-rigs.tsx` | Step 4 Produce panel | 70 |
| `src/components/layout-lab/steps/player-movement/05-retarget.tsx` | Step 5 Produce panel + per-clip status grid | 100 |
| `src/components/layout-lab/steps/player-movement/06-blend-space.tsx` | Step 6 Produce + the 3x3 grid visualizer | 120 |
| `src/components/layout-lab/steps/player-movement/07-pof-editor-build.tsx` | Step 7 build trigger + log pane | 100 |
| `src/components/layout-lab/steps/player-movement/08-anim-blueprint.tsx` | Step 8 Produce + AnimBP introspection display | 100 |
| `src/components/layout-lab/steps/player-movement/09-roll-montage.tsx` | Step 9 Produce panel | 70 |
| `src/components/layout-lab/steps/player-movement/10-playable-gate.tsx` | Step 10 run-button + 4-frame thumbnail strip + L4 verdict | 150 |
| `src/lib/bridge/run-python.ts` | Client for `POST :30040/run-python` | 60 |
| `src/__tests__/lib/catalog/pipelines/player-movement.test.ts` | Recipe shape + accept derivation | 100 |
| `src/__tests__/components/layout-lab/steps/player-movement/*.test.tsx` | Per-step render + dispatch tests | ~80 each |

### New — UE pof-exp

| Path | Purpose | Approx LOC |
|---|---|---|
| `Source/PoFEditor/PoFEditor.Build.cs` | Module build script (only if absent) | 20 |
| `Source/PoFEditor/PoFEditorModule.h/cpp` | Module impl (only if absent) | 30 |
| `Source/PoFEditor/Public/PoFAnimBPAuthoringLibrary.h` | `UBlueprintFunctionLibrary` declaration | 50 |
| `Source/PoFEditor/Private/PoFAnimBPAuthoringLibrary.cpp` | 6 UFUNCTIONs wrapping KismetEditorUtilities | 200 |
| `Source/PoFEditor/Test/PoFAnimBPAuthoringTest.cpp` | C++ unit test for the library | 150 |
| `Source/PoF/Test/Character/VSPlayerMovementTest.cpp` | The L4 gate | 250 |
| `Plugins/PillarsOfFortuneBridge/.../RunPythonHandler.cpp` | New `/run-python` HTTP route | 120 |
| `Content/Python/player_movement/__init__.py` | Module package | 5 |
| `Content/Python/player_movement/import_clips.py` | Step 3 | 80 |
| `Content/Python/player_movement/build_ik_rigs.py` | Step 4 | 150 |
| `Content/Python/player_movement/retarget.py` | Step 5 | 80 |
| `Content/Python/player_movement/build_blend_space.py` | Step 6 | 100 |
| `Content/Python/player_movement/build_anim_bp.py` | Step 8 | 60 |
| `Content/Python/player_movement/build_montage.py` | Step 9 | 80 |
| `Content/Python/player_movement/README.md` | User-facing module docs | — |
| `Content/Maps/TestLevel_PlayerMovement.umap` | Step 10's PIE map (auto-built if missing) | — |

### New — User-facing directory

`<repo>/Content/Source/Mixamo/Raw/` — gitignored. User drops the 10 FBXs here.

### Modified

| Path | Change |
|---|---|
| `.gitignore` (UE repo) | Add `Content/Source/Mixamo/Raw/*.fbx` |
| `Source/PoF/Player/ARPGPlayerCharacter.cpp` | Wire `HandleDodge` to: (1) yaw the actor to face the current `IA_Move` input direction, (2) play `AM_Roll` montage if assigned; expose `bRollIFrameActive` flag set/cleared by the `AnimNotify_DodgeWindow` callback. (Fwd-only roll clip used omni-directionally via yaw.) |
| `src/lib/catalog/pipelines/registry.ts` | Auto-discovery picks up `player-movement.ts` (no change needed if registry uses glob) |
| `docs/architecture/ui-shell.md` | New §9 — Tier-2 anim pipeline |
| `docs/catalog/AUTHORING.md` | Cross-link from "Alternative: One-Shot Mode" — player movement is also one-shottable |

---

## Error Handling

**Per-step failure recovery:**

| Step | Most likely failure | Recovery |
|---|---|---|
| 2 source | User dropped 9 of 10 files | Acceptance lists exactly which name is missing; user adds + reruns 2+3 |
| 3 import | One FBX is corrupt | Step returns `failed: ["Walking.fbx: SkeletalMeshFactory error: ..."]`; other 9 still import; user re-downloads + reruns 3 |
| 4 ik-rigs | Skeleton bone names don't match expected Mixamo set | Module logs the missing/extra bone names; user inspects (very rare — Mixamo skeletons are deterministic per character; happens only if user picked a non-X-Bot character) |
| 5 retarget | Retarget pose drift (one bone misaligned) | Module returns max bone delta + bone name; user runs `set_retarget_pose_for_bone` override in a side script; rerun 5 |
| 7 pof-editor-build | C++ compile fails | Bridge returns full MSBuild output; surface in step's Produce panel |
| 8 anim-bp | Compile fails after node insertion | Library returns BP compile log; step 8 acceptance fails with the log |
| 10 playable-gate | Frame variance below threshold | Heuristic flag "T-pose suspected" + attached PNGs in artifact `data` for visual inspection |

**Universal safety net:** Every Python module wraps its body in `try/except`; full traceback into the returned `error` field. Bridge route captures `stdout`/`stderr` during the call so log lines reach the Produce panel even when no exception is thrown. **No silent failures** — Rule 4 of catalog pipelines.

**Idempotency contract (every Python module):** `.run(args)` re-checks "is the artifact already in the expected end-state?" before doing work. Return always reports `{created: [...], updated: [...], skipped: [...], failed: [...]}` so Acceptance can distinguish "did nothing because already done" from "actually built things". Re-running step 5 after dropping one new clip retargets only that clip — the experimentation handle.

---

## Testing

Three layers:

**1. App-side TS unit tests** (vitest, same pattern as every other catalog pipeline)
- `player-movement.test.ts` — StepSpec recipe exists, each step has `view`/`produce`/`accept`; `resolveAccept` returns correct tier per step.
- Per-step Produce-panel render tests.

**2. PoFEditor C++ unit tests** (new, narrow)
- `FPoFAnimBPAuthoringTest.cpp` — spawns an AnimBP via the library, asserts compile success, asserts each node type can be added + connected. Standard `FAutomationTestBase` ladder.

**3. The L4 gate** — `FVSPlayerMovementTest.cpp` is both the production acceptance AND its own regression test.

**Explicitly not tested:**
- The Mixamo download flow itself (manual; Adobe's UI not in our scope).
- The `unreal` Python module's behavior (engine code).
- Long-term anim-catalog growth (Tier-3 future scope).

---

## Out of Scope (deferred to future specs)

- Lyra Starter Game integration (Tier-3 — ~30 free Manny-compatible combat anims).
- Motion Matching (UE 5.5+ — replaces blend spaces with a Pose Search asset; requires ~30+ clips minimum).
- Per-archetype retarget poses (e.g. "Brute carries shoulders different").
- Animation-anim catalog as a first-class catalog row.
- Multiplayer/networked input replication for movement (single-player V1 only).
- Save/load of custom keybindings (the `UARPGInputSaveData` save struct exists; binding it to actual rebinds is out of scope for this spec).
