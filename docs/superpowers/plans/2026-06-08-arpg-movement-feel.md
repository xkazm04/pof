# Precise ARPG Movement Feel (Mouse-Aim + WASD + Roll) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the UE5 player to a top-down mouse-aim control scheme (body faces cursor, WASD screen-relative strafe, SPACE rolls toward WASD-or-cursor) and tune it to a "responsive, light-weight" feel, verifying every change against the natural-PIE observation harness and your play-testing.

**Architecture:** All gameplay code lives in the UE project `C:\Users\kazda\Documents\Unreal Projects\PoF` (repo `pof-exp`, branch `main`). The player is `AARPGPlayerCharacter : AARPGCharacterBase (ACharacter+CMC+GAS)`. Mouse-aim reuses the already-written `UpdateCursorAim()` (just disabled). Verification uses the faithful `UScenarioController` (natural PIE, armed via `-PoFScenario=<inbox.json>`, driven through the `/pof/python/run` bridge) — NOT the manual-tick `RunScenarioEx`, which prior work proved unfaithful. Feel values are existing `EditAnywhere` UPROPERTYs, tuned live on the `BP_VSPlayer` CDO (no recompile) then baked into C++ defaults once dialed.

**Tech Stack:** UE 5.7.3 C++ (PoF + PoFEditor modules), Enhanced Input, GAS, the PoF Bridge plugin (`:30040`), Python observation verbs under `Content/Python/observation/`.

---

## Harness Invocation Reference (used by every gate below)

The faithful loop (per scenario run):

1. **Editor must be running** with the bridge up AND launched with `-PoFScenario=<inboxPath>` (e.g. `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Observations\inbox.json`). Verify the bridge:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:30040/pof/status" -Method Get
   ```
2. **Write the inbox JSON** (the scenario) to `<inboxPath>`. Schema (parsed by `UScenarioController::LoadScenario`):
   ```json
   {
     "out_dir": "C:/Users/kazda/Documents/Unreal Projects/PoF/Saved/Observations/run1",
     "total_seconds": 3.0,
     "num_samples": 6,
     "settle": 0.5,
     "inputs": [
       { "key": "W", "start": 0.5, "duration": 2.0 },
       { "event": "set_cursor", "event_arg": "1000,0,0", "start": 0.0 }
     ]
   }
   ```
   - `key` = real simulated hardware key through the IMC (exercises modifiers): `"W"`,`"S"`,`"A"`,`"D"`,`"SpaceBar"`.
   - `action` + `value:[x,y]` = action-level injection (bypasses bindings) — avoid for WASD direction tests.
   - `event`+`event_arg` = non-input event fired at `start` (existing: `"activate_ability"`; **this plan adds `"set_cursor"`**).
3. **Start PIE** (natural loop) on a **lit** map (the arena, not the dark TestLevel — capture goes black otherwise):
   ```powershell
   $body = @{ module="observation.scenario_pie"; function="start"; args=@{ map="/Game/Maps/VerticalSlice" } } | ConvertTo-Json -Depth 6
   Invoke-RestMethod -Uri "http://localhost:30040/pof/python/run" -Method Post -Body $body -ContentType "application/json"
   ```
4. **Poll** for `<out_dir>/DONE`, then read `<out_dir>/observations.json` (array of samples: `{time, loc:[x,y,z], speed, droopL, droopR, pose_valid, frame}`) and `Read` the `frame_NN.png` files (the agent's multimodal eyes = the T4 authority).
5. **Stop** before the next run (always — stacked PIE sessions saturate the bridge):
   ```powershell
   $body = @{ module="observation.scenario_pie"; function="stop"; args=@{} } | ConvertTo-Json -Depth 6
   Invoke-RestMethod -Uri "http://localhost:30040/pof/python/run" -Method Post -Body $body -ContentType "application/json"
   ```

**Discriminators (calibration-proven):** `droopL/R ~0°` = arms horizontal = **T-pose**; `~50–80°` = arms down = **animating**. `loc` delta between samples = movement (direction + distance). A change is only "done" when its gate passes here *before* you play-test feel.

**Rebuild note:** C++ reflection changes (new UPROPERTY/UFUNCTION/USTRUCT field) need a full module rebuild + editor relaunch; pure-body changes can try Live Coding first (`POST /pof/compile/live`). Batch all C++ edits in a phase, then do ONE rebuild. Relaunch with the crash-safe procedure: clear `Saved/{Autosaves,Crashes,SaveRecovery}` + `Intermediate/DisasterRecovery`, launch `-unattended -DisableAdaptiveUnity -abslog=...` and `-PoFScenario=<inboxPath>`. UE repo: commit narrowly (pushes to `xkazm04/pof-exp` work).

---

## Phase 0 — Harness readiness (no code)

### Task 0: Confirm the loop is live against a known-good baseline

**Files:** none (environment check).

- [ ] **Step 1: Verify the bridge + editor.** Run the `/pof/status` call from the Reference. Expected: JSON with plugin/engine version and PIE state. If it fails, the editor isn't running with the bridge — ask the user to launch it (per the crash-safe procedure, with `-PoFScenario=<inboxPath>`).

- [ ] **Step 2: Confirm the lit map path.** List maps:
  ```powershell
  cd "C:/Users/kazda/Documents/Unreal Projects/PoF"; git ls-files "Content/Maps" "Content/VerticalSlice" | Select-String "\.umap"
  ```
  Expected: a `VerticalSlice` (arena) map. Use its `/Game/...` path as `map` in all gates. If none is lit, use `observation.make_test_map` then bake/skip-capture.

- [ ] **Step 3: Baseline known-good run (calibration).** Write an inbox with `{ "inputs": [ { "key": "W", "start": 0.5, "duration": 2.0 } ], "total_seconds": 3, "num_samples": 6, "out_dir": ".../run_baseline" }`, run the start/poll/stop loop on the arena. Read observations.json + a frame.
  Expected: with the CURRENT (pre-change) scheme the character moves and the walk animates (droop varies 30–70°). This confirms the harness separates signal from noise before we trust it. Record the baseline `loc` axis that `W` maps to (the camera basis) — later gates assert directions relative to this.

---

## Phase 1 — Mouse-aim control scheme + test seam

All C++ edits batched, then one rebuild, then gates.

### Task 1: Add a deterministic cursor-aim test seam to the player

**Files:**
- Modify: `Source/PoF/Player/ARPGPlayerCharacter.h`
- Modify: `Source/PoF/Player/ARPGPlayerCharacter.cpp:619-644` (`UpdateCursorAim`)

- [ ] **Step 1: Declare the override + accessors (header).** In `ARPGPlayerCharacter.h`, in the public Cursor Aim section (after `IsCursorAimEnabled()`, ~line 247), add:
  ```cpp
  	/** TEST/AI SEAM: force the cursor aim point to a fixed world location (bypasses the
  	 *  mouse trace). The harness uses this to make mouse-aim deterministically verifiable;
  	 *  AI/scripted aim can use it too. Clear with ClearCursorWorldOverride(). */
  	UFUNCTION(BlueprintCallable, Category = "Camera|Cursor")
  	void SetCursorWorldOverride(FVector WorldLocation) { CursorWorldOverride = WorldLocation; bUseCursorWorldOverride = true; }

  	UFUNCTION(BlueprintCallable, Category = "Camera|Cursor")
  	void ClearCursorWorldOverride() { bUseCursorWorldOverride = false; }
  ```
  And in the `private:` section (near `CursorWorldLocation`, ~line 404), add:
  ```cpp
  	// Cursor aim override (test/AI seam — see SetCursorWorldOverride)
  	bool bUseCursorWorldOverride = false;
  	FVector CursorWorldOverride = FVector::ZeroVector;
  ```

- [ ] **Step 2: Honor the override in `UpdateCursorAim` (cpp).** Replace the trace block at `ARPGPlayerCharacter.cpp:624-629`:
  ```cpp
  	// Always update cursor world position for interaction targeting
  	FHitResult HitResult;
  	if (PC->GetHitResultUnderCursor(ECC_Visibility, false, HitResult))
  	{
  		CursorWorldLocation = HitResult.ImpactPoint;
  	}
  ```
  with:
  ```cpp
  	// Cursor world position: a fixed override (test/AI seam) wins; otherwise trace under the mouse.
  	if (bUseCursorWorldOverride)
  	{
  		CursorWorldLocation = CursorWorldOverride;
  	}
  	else
  	{
  		FHitResult HitResult;
  		if (PC->GetHitResultUnderCursor(ECC_Visibility, false, HitResult))
  		{
  			CursorWorldLocation = HitResult.ImpactPoint;
  		}
  	}
  ```

### Task 2: Enable the mouse-aim scheme at runtime (player-only)

**Files:**
- Modify: `Source/PoF/Player/ARPGPlayerCharacter.cpp` (constructor ~line 52 and `BeginPlay` ~line 78)

- [ ] **Step 1: Constructor default.** In the constructor, after the `AbilityUnlockComp` line (~52), add:
  ```cpp
  	// --- Top-down mouse-aim control scheme (ARPG baseline) ---
  	// Player faces the cursor, not its movement direction. PLAYER-ONLY: the shared
  	// AARPGCharacterBase keeps bOrientRotationToMovement=true for AI/NPCs.
  	bCursorAimActive = true;
  	GetCharacterMovement()->bOrientRotationToMovement = false;
  ```

- [ ] **Step 2: BeginPlay enforcement (beats any stale BP_VSPlayer CDO value).** In `BeginPlay`, just before the mouse-cursor block (~line 78), add:
  ```cpp
  	// Enforce the mouse-aim scheme at runtime so a stale Blueprint default can't
  	// silently restore face-movement. Feel values stay BP-tunable (read each tick).
  	bCursorAimActive = true;
  	if (UCharacterMovementComponent* MoveComp = GetCharacterMovement())
  	{
  		MoveComp->bOrientRotationToMovement = false;
  	}
  ```

### Task 3: Route a `set_cursor` scenario event to the player

**Files:**
- Modify: `Source/PoF/Testing/ScenarioController.cpp` (includes + `ApplyInputs`)

- [ ] **Step 1: Include the player header.** Near the top of `ScenarioController.cpp`, add:
  ```cpp
  #include "Player/ARPGPlayerCharacter.h"
  ```

- [ ] **Step 2: Handle the event in `ApplyInputs`.** Find where `In.Event == "activate_ability"` is handled (grep `activate_ability` in this file) and add a sibling branch in the same per-input loop:
  ```cpp
  		if (In.Event == TEXT("set_cursor"))
  		{
  			// event_arg = "X,Y,Z" world location for deterministic mouse-aim verification.
  			TArray<FString> Parts;
  			In.EventArg.ParseIntoArray(Parts, TEXT(","));
  			if (Parts.Num() >= 3)
  			{
  				const FVector Loc(FCString::Atof(*Parts[0]), FCString::Atof(*Parts[1]), FCString::Atof(*Parts[2]));
  				if (AARPGPlayerCharacter* Player = Cast<AARPGPlayerCharacter>(GetPawn()))
  				{
  					Player->SetCursorWorldOverride(Loc);
  				}
  			}
  			continue; // not a key/action input
  		}
  ```
  (Match the existing loop's control flow — if the existing event handling uses a different guard/`continue` pattern, mirror it.)

### Task 4: Rebuild, then run the Phase-1 gates

**Files:** none (build + verify).

- [ ] **Step 1: Rebuild PoF + PoFEditor** (new UFUNCTION/members → full rebuild, not Live Coding). Use the project's build path; relaunch the editor crash-safe with `-PoFScenario=<inboxPath>` (see Reference). Wait for the bridge `/pof/status` to respond.

- [ ] **Step 2: Gate — faces cursor.** Inbox: `{ "inputs": [ {"event":"set_cursor","event_arg":"1000,0,0","start":0.0} ], "total_seconds": 1.5, "num_samples": 4, "out_dir": ".../run_face" }`. Run loop, read frames.
  Expected: the character's body rotates to face world +X (toward the override point) and holds; the frame shows the body oriented toward that direction. (No movement input → it just turns.)

- [ ] **Step 3: Gate — strafe animates (facing ≠ movement).** Inbox: aim east + move "north" — `{ "inputs": [ {"event":"set_cursor","event_arg":"1000,0,0","start":0.0}, {"key":"W","start":0.5,"duration":2.0} ], "total_seconds": 3, "num_samples": 6, "out_dir": ".../run_strafe" }`. Run loop, read observations + frames.
  Expected: `loc` moves along the same axis `W` moved in the Task-0 baseline (movement basis unchanged), while the body stays facing +X; `droopL/R` vary 30–70° across samples (animating, not T-pose); the frame shows a strafing stride, not a forward run. This proves decoupled facing + a working strafe blend.

- [ ] **Step 4: Gate — idle is not a T-pose.** Inbox: `{ "inputs": [ {"event":"set_cursor","event_arg":"1000,0,0","start":0.0} ], "total_seconds": 2, "num_samples": 4, "out_dir": ".../run_idle" }` (no movement key). Read frames + droop.
  Expected: at speed 0 the character shows an idle pose (arms down, droop ~50–80°), **not** an arms-spread T-pose. If droop ≈ 0 / frame shows a T-pose → the BS_Locomotion (0,0) idle-sample gap is real → do **Phase 4** before continuing.

- [ ] **Step 5: Commit** (UE repo).
  ```powershell
  cd "C:/Users/kazda/Documents/Unreal Projects/PoF"; git add Source/PoF/Player/ARPGPlayerCharacter.h Source/PoF/Player/ARPGPlayerCharacter.cpp Source/PoF/Testing/ScenarioController.cpp; git commit -m "feat(player): top-down mouse-aim scheme + cursor-aim test seam (harness-verified)"
  ```

- [ ] **Step 6: You play-test.** Confirm: body tracks the mouse, WASD moves screen-relative while aiming, it reads as an ARPG. Note any feel complaints (these feed Phase 2).

---

## Phase 2 — WASD feel ("responsive, light weight"), tuned live

No recompile: tune the existing `EditAnywhere` members on the `BP_VSPlayer` CDO via Python (they're read every tick by `UpdateAcceleration`/`UpdateRotationRate`), harness-measure, you feel-test, iterate. Bake the winner into C++ defaults at the end.

**Relevant knobs (all on `AARPGCharacterBase`, current defaults):** `WalkSpeed=600`, `SprintSpeed=900`, `AccelerationFromIdle=4096`, `AccelerationAtFullSpeed=2048`, `BrakingDeceleration=2400`, `MovementGroundFriction=8`, `RotationRateIdle=720`, `RotationRateAtSpeed=360`, `CursorAimRotationSpeed=15` (on the player), `bUseSeparateBrakingFriction=false` (set in base ctor).

### Task 5: Live-tune the feel knobs

**Files:**
- Create: `Content/Python/player_movement/tune_movement.py`

- [ ] **Step 1: Write a CDO-tuning verb.** Create `tune_movement.py`:
  ```python
  """Live-set player movement feel knobs on the BP_VSPlayer CDO (no recompile).
  Read each tick by UpdateAcceleration/UpdateRotationRate, so changes apply on next PIE spawn.
  Call via /pof/python/run {module:"player_movement.tune_movement", function:"run", args:{...}}.
  """
  import unreal

  BP = "/Game/Characters/Player/BP_VSPlayer.BP_VSPlayer_C"

  def run(args):
      cls = unreal.load_object(None, BP)
      cdo = unreal.get_default_object(cls)
      applied = {}
      for prop in ("walk_speed", "sprint_speed", "acceleration_from_idle",
                   "acceleration_at_full_speed", "braking_deceleration",
                   "movement_ground_friction", "rotation_rate_idle",
                   "rotation_rate_at_speed", "cursor_aim_rotation_speed"):
          if prop in args:
              cdo.set_editor_property(prop, float(args[prop]))
              applied[prop] = float(args[prop])
      return {"applied": applied}
  ```
  (Property names are the snake_case of the C++ members. If `set_editor_property` rejects one because it lives on the CMC subobject rather than the actor, set it via `cdo.character_movement.set_editor_property(...)` instead — `walk_speed`/accel/braking/friction are mirrored onto the CMC by the constructor, but the authored source of truth is the actor members read each tick, so set the actor members.)

- [ ] **Step 2: Apply a "responsive, light-weight" starting set.** Call it:
  ```powershell
  $body = @{ module="player_movement.tune_movement"; function="run"; args=@{
      walk_speed=550; acceleration_from_idle=8192; acceleration_at_full_speed=4096;
      braking_deceleration=3200; movement_ground_friction=8; rotation_rate_idle=900;
      cursor_aim_rotation_speed=18 } } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Uri "http://localhost:30040/pof/python/run" -Method Post -Body $body -ContentType "application/json"
  ```
  Rationale: higher accel = quicker to top speed (snappy start); higher braking + default friction = short stop with a faint slide (light weight, not instant); faster turn-to-cursor.

- [ ] **Step 3: Gate — directions/travel still correct, measure responsiveness.** Re-run the Phase-1 strafe + a 4-direction inbox (`W`,`S`,`A`,`D` each in separate runs, `set_cursor` fixed east). From observations.json measure: per-axis `loc` deltas (W vs S anti-parallel, A vs D anti-parallel, W⊥A), peak `speed` reached, and how many samples to reach ~full speed (accel proxy) and to stop after the key releases (brake proxy).
  Expected: opposite/perpendicular invariants hold; speed plateaus near `walk_speed`; reaches plateau within ~1–2 samples and stops within ~1 sample of release.

- [ ] **Step 4: You play-test + iterate.** Tell me what's off ("too floaty", "stops too hard", "turns too slow"). I re-call `tune_movement` with adjusted values and re-gate. Loop until you sign off. **No silent caps** — I'll report every value set.

### Task 6: Bake the dialed-in values into C++ defaults

**Files:**
- Modify: `Source/PoF/Character/ARPGCharacterBase.h` (default initializers for the tuned members) OR `Source/PoF/Player/ARPGPlayerCharacter.cpp` (player-only overrides in ctor, if the values should differ from AI)

- [ ] **Step 1: Decide scope.** If the tuned feel should apply to the player only (likely — enemies may want heavier feel), set the final values in the `AARPGPlayerCharacter` constructor on the protected base members (e.g. `WalkSpeed = 550.f; AccelerationFromIdle = 8192.f; ...`) so AI keeps base defaults. If it's a global improvement, edit the base default initializers in `ARPGCharacterBase.h`.

- [ ] **Step 2: Apply the agreed values** (fill in the signed-off numbers from Task 5). Example (player-only, in the ctor block added in Phase 1):
  ```cpp
  	// Dialed-in "responsive, light-weight" feel (signed off <date>):
  	WalkSpeed = 550.f;
  	AccelerationFromIdle = 8192.f;
  	AccelerationAtFullSpeed = 4096.f;
  	BrakingDeceleration = 3200.f;
  	RotationRateIdle = 900.f;
  	CursorAimRotationSpeed = 18.f;
  ```

- [ ] **Step 3: Rebuild, re-gate (Task 5 Step 3), confirm parity with the CDO-tuned run, commit.**
  ```powershell
  cd "C:/Users/kazda/Documents/Unreal Projects/PoF"; git add Source/PoF/Character/ARPGCharacterBase.h Source/PoF/Player/ARPGPlayerCharacter.cpp Content/Python/player_movement/tune_movement.py; git commit -m "tune(player): responsive light-weight WASD feel (harness + play-test verified)"
  ```

---

## Phase 3 — Roll (direction, spacing, recovery)

### Task 7: Roll direction = WASD-if-held, else toward cursor

**Files:**
- Modify: `Source/PoF/AbilitySystem/GA_Dodge.cpp:95-108` (the direction block) + includes

- [ ] **Step 1: Include the player header.** Near the top of `GA_Dodge.cpp`, add:
  ```cpp
  #include "Player/ARPGPlayerCharacter.h"
  ```

- [ ] **Step 2: Redirect the no-input fallback to the cursor.** Replace `GA_Dodge.cpp:97-108`:
  ```cpp
  	FVector DodgeDir;
  	if (!LastInput.IsNearlyZero())
  	{
  		DodgeDir = FVector(LastInput.X, LastInput.Y, 0.f).GetSafeNormal();
  	}
  	else
  	{
  		// No input — dodge backward relative to character facing
  		DodgeDir = -Character->GetActorForwardVector();
  		DodgeDir.Z = 0.f;
  		DodgeDir = DodgeDir.GetSafeNormal();
  	}
  ```
  with:
  ```cpp
  	FVector DodgeDir;
  	if (!LastInput.IsNearlyZero())
  	{
  		// Held WASD → roll in the movement-input direction.
  		DodgeDir = FVector(LastInput.X, LastInput.Y, 0.f).GetSafeNormal();
  	}
  	else if (const AARPGPlayerCharacter* Player = Cast<AARPGPlayerCharacter>(Character))
  	{
  		// Stationary player → roll toward the cursor aim point.
  		FVector ToCursor = Player->GetCursorWorldLocation() - Player->GetActorLocation();
  		ToCursor.Z = 0.f;
  		DodgeDir = ToCursor.GetSafeNormal();
  		if (DodgeDir.IsNearlyZero())
  		{
  			DodgeDir = Player->GetActorForwardVector(); // cursor on self → roll toward facing
  			DodgeDir.Z = 0.f;
  			DodgeDir = DodgeDir.GetSafeNormal();
  		}
  	}
  	else
  	{
  		// Non-player (AI) → keep the backward fallback.
  		DodgeDir = -Character->GetActorForwardVector();
  		DodgeDir.Z = 0.f;
  		DodgeDir = DodgeDir.GetSafeNormal();
  	}
  ```

### Task 8: Reconcile + tune roll spacing (distance)

**Files:** investigation across `GA_Dodge.cpp`, `Source/PoF/Character/ARPGCharacterBase.cpp` (`UpdateDodgeMovement`/`OnDodgeEnd`/`TryDodge`), and the `AM_Roll` montage.

- [ ] **Step 1: Determine what drives roll travel.** The base has a non-GAS dodge path (`TryDodge`/`UpdateDodgeMovement` using `DodgeDistance=1200`,`DodgeDuration=0.4`,`DodgeSpeed`) AND `GA_Dodge` plays `AM_Roll` with **root motion** (`RootMotionFromMontagesOnly`). SPACE → `HandleDodge` → GA_Dodge (montage root motion). Grep to confirm `HandleDodge`/`IA_Dodge` activates the ability (not `TryDodge`):
  ```powershell
  cd "C:/Users/kazda/Documents/Unreal Projects/PoF"; Select-String -Path Source/PoF/Player/ARPGPlayerController.cpp -Pattern "Dodge|TryDodge|Ability_Dodge"
  ```
  Record which path is live. The travel distance therefore comes from `AM_Roll`'s baked root motion × `MontagePlayRate`, NOT from `DodgeDistance` (which belongs to the dormant `UpdateDodgeMovement` path). If both paths run, that's a bug — disable the non-GAS one for the player.

- [ ] **Step 2: Measure current roll travel via the harness.** Inbox: `{ "inputs": [ {"event":"set_cursor","event_arg":"1000,0,0","start":0.0}, {"key":"W","start":0.5,"duration":0.1}, {"key":"SpaceBar","start":0.6,"duration":0.1} ], "total_seconds": 2.5, "num_samples": 10, "out_dir": ".../run_roll_dist" }`. From observations.json, compute the `loc` displacement during the roll window and the peak `speed`.
  Expected output recorded as the current baseline distance.

- [ ] **Step 3: Tune to target.** If travel is off vs the ~350–450u feel target: adjust `MontagePlayRate` (faster = shorter+snappier) live via a small CDO set on `GA_Dodge` (or on the character's `DodgeMontagePlayRate`), OR (for a precise distance) add a Motion Warping window to `AM_Roll` (the character already has `MotionWarpingComp` + `SetAttackWarpTarget`) so the roll warps a fixed distance toward `DodgeDir`. Prefer play-rate first (cheap); use motion-warp only if root-motion distance can't hit the target. Re-measure (Step 2).

### Task 9: Fix roll recovery blend-out (no T-pose snap)

**Files:** `Content/Python/player_movement/build_anim_bp.py` (ABP Dodging→Locomotion transition) and/or the `AM_Roll` montage blend-out settings.

- [ ] **Step 1: Observe the recovery.** Inbox same as Task 8 Step 2 but `total_seconds: 3.5`, `num_samples: 14` so samples cover the post-roll return. Read the frames spanning roll-end → idle/locomotion.
  Expected to diagnose: if a frame between roll-end and idle shows a T-pose / reference-pose flash, the recovery transition is the bug.

- [ ] **Step 2: Fix the transition.** Increase `AM_Roll`'s **blend-out time** (so the montage eases back into locomotion) and/or verify the ABP `Dodging → Locomotion` state transition has a non-zero blend and a correct condition (montage-not-playing). Apply via the existing AnimBP authoring (`build_anim_bp.py`) or by setting the montage's `BlendOut` on the asset. Re-run Step 1 until no T-pose flash appears.

### Task 10: Phase-3 gates + commit

- [ ] **Step 1: Rebuild** (GA_Dodge body change → try Live Coding `POST /pof/compile/live`; if the new include/cast doesn't hot-apply, full rebuild + relaunch).

- [ ] **Step 2: Gate — roll + WASD.** Inbox from Task 8 Step 2.
  Expected: during the roll window the character travels along the `W` axis (same as movement basis), `montage`/frames show the roll animation, displacement ≈ the tuned target, and after the roll it returns to locomotion/idle with **no** T-pose frame.

- [ ] **Step 3: Gate — roll alone toward cursor.** Inbox: `{ "inputs": [ {"event":"set_cursor","event_arg":"0,1200,0","start":0.0}, {"key":"SpaceBar","start":0.6,"duration":0.1} ], "total_seconds": 2.5, "num_samples": 10, "out_dir": ".../run_roll_cursor" }` (no WASD).
  Expected: the character rolls toward world +Y (the cursor override direction), confirming the cursor fallback.

- [ ] **Step 4: Commit** (UE repo).
  ```powershell
  cd "C:/Users/kazda/Documents/Unreal Projects/PoF"; git add Source/PoF/AbilitySystem/GA_Dodge.cpp Content/Python/player_movement/build_anim_bp.py; git commit -m "feat(dodge): roll toward WASD-or-cursor + tuned distance + clean recovery (harness-verified)"
  ```

- [ ] **Step 5: You play-test the roll.** Confirm direction (WASD vs cursor), distance, and that the recovery reads smoothly.

---

## Phase 4 — Idle blend sample (CONDITIONAL: only if Phase-1 Task 4 Step 4 showed a T-pose at rest)

### Task 11: Add an idle sample at BS_Locomotion (0,0)

**Files:** `Content/Python/player_movement/build_blend_space.py`

- [ ] **Step 1: Confirm the gap.** Call `get_state` on the blend space:
  ```powershell
  $body = @{ module="observation.get_state"; function="run"; args=@{ asset_path="/Game/Characters/Player/Animations/BS_Locomotion" } } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Uri "http://localhost:30040/pof/python/run" -Method Post -Body $body -ContentType "application/json"
  ```
  Expected: `sample_count` and skeleton. If there's no sample at blend coordinate (0,0), that's the idle gap.

- [ ] **Step 2: Add the idle sample.** Use an idle clip (a Mixamo idle retargeted to Manny — `retarget.py` if not present) and add it at sample point (Speed=0, Direction=0) in `build_blend_space.py`. Re-run the build verb.

- [ ] **Step 3: Re-gate idle** (Phase-1 Task 4 Step 4). Expected: standing still now shows the idle pose, not a T-pose. Commit:
  ```powershell
  cd "C:/Users/kazda/Documents/Unreal Projects/PoF"; git add Content/Python/player_movement/build_blend_space.py; git commit -m "content(anim): idle sample at BS_Locomotion (0,0) — no rest T-pose"
  ```

---

## Self-Review

**Spec coverage:**
- §1 Control scheme & facing → Tasks 1–4 (mouse-aim enabled player-only, cursor-aim path reused). ✓
- §2 WASD feel + live-editable knobs → Tasks 5–6 (CDO live-tune the existing EditAnywhere members, bake defaults). ✓
- §3 Roll (WASD-else-cursor, spacing, recovery) → Tasks 7–10. ✓
- §4 Animation (strafe verify, idle sample, roll recovery) → Phase-1 strafe gate, Phase 4, Task 9. ✓
- §5 Harness verification → Harness Reference + a gate in every phase. ✓
- §6 Sequencing (3 phases, each playable) → Phases 1/2/3 each end with a play-test. ✓
- Out-of-scope items → none added. ✓
- Decision 2 (player-only switch, base untouched) → enforced in Tasks 2 & 6 Step 1. ✓

**Placeholder scan:** Real code in every code step; Task 6 Step 2 intentionally carries `<date>` + "fill in signed-off numbers" because those values are produced by the Task-5 feel loop (not knowable up front) — flagged explicitly, not a silent TODO.

**Type/name consistency:** `SetCursorWorldOverride`/`ClearCursorWorldOverride`/`bUseCursorWorldOverride`/`CursorWorldOverride` consistent across Task 1 & 3; `set_cursor` event consistent across Task 3 & gates; `GetCursorWorldLocation()` (existing accessor) used in Tasks 3 & 7; knob names consistent between `tune_movement.py` and the C++ members.

**Open risks (handled in-plan):** (a) `set_editor_property` on CMC-vs-actor members — Task 5 Step 1 notes the fallback; (b) Live Coding can't add reflection — Reference + Task 4/10 say full rebuild for new members; (c) dual dodge paths — Task 8 Step 1 reconciles before tuning; (d) dark-map capture — Reference mandates the lit arena.
