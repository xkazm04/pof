# Precise ARPG Movement Feel (Mouse-Aim + WASD + Roll) Design

**Date:** 2026-06-08
**Status:** Design — approved by user, awaiting review of the written spec.
**Goal:** Establish a precise, responsive ARPG movement baseline in the UE5 project (`C:\Users\kazda\Documents\Unreal Projects\PoF`, repo `pof-exp`, branch `main`): the body aims at the mouse cursor, WASD moves screen-relative (strafe), SPACE rolls. WASD must feel "very sensitive and precise" with light weight. Every change is proven *objectively correct* through the existing observation harness (natural-PIE scenarios + frames the agent reads), then *feel*-validated by the user play-testing.

---

## Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Control scheme = top-down mouse-aim.** Body always faces the cursor's ground point; WASD is screen/camera-relative (W = up-screen) so the character strafes/back-pedals while aiming. | User explicitly wants the mouse to manipulate body direction. Matches the original player-movement Decision 2 ("8-way strafe blend with cursor aim") and the already-written `bCursorAimActive` path. |
| 2 | **Facing implementation = Approach A (actor-rotation cursor aim).** `bOrientRotationToMovement=false`, `bUseControllerRotationYaw=false`; the pawn's yaw is owned by `UpdateCursorAim()` each tick via `RInterpTo` toward the cursor ground point. | Keeps the movement basis (camera) separate from facing (cursor). Controller-yaw facing (Approach B) would bend camera-relative WASD toward the cursor — wrong for a top-down camera. Reuses existing code. |
| 3 | **Roll direction = WASD-if-held, else toward cursor.** | Standard mouse-aim ARPG feel; dodges where you're already moving, falls back to the aim point when stationary. Uses input already pressed. |
| 4 | **Feel target = "responsive with light weight."** Quick to start/stop with a short ease and a faint sense of mass (not robotic, not weighty), fast turn-to-cursor. | User selection. Modern ARPG baseline (snappier than souls-like, grounded vs pure-arcade). |
| 5 | **Validation = harness-correctness + user feel play-test.** Harness proves objective facts each change; user is the sole arbiter of "feel." Key values exposed as live-editable `EditAnywhere` `UPROPERTY`s. | Feel is subjective; the harness measures pose/movement/direction, not enjoyment. Live-editable knobs let the user nudge without a recompile. |
| 6 | **Reuse, don't rebuild.** Pawn stays `AARPGPlayerCharacter` (`ACharacter`+CMC+GAS). No Mover-plugin pawn rebuild. | Prior guidance: reuse Mover's anim/input assets, not its pawn. Lowest risk; most plumbing already exists. |

---

## Verified Current State (2026-06-08)

| Area | File | State |
|------|------|-------|
| Player pawn | `Source/PoF/Player/ARPGPlayerCharacter.{h,cpp}` (← `AARPGCharacterBase`) | `UpdateCursorAim()` already reads `GetHitResultUnderCursor` and can `RInterpTo` the body to the cursor at `CursorAimRotationSpeed`, gated behind `bCursorAimActive=false` with `SetCursorAimEnabled()`. **Disabled today.** |
| Facing | `Source/PoF/Character/ARPGCharacterBase.cpp` | `bOrientRotationToMovement=true` (faces movement), `bUseControllerRotationYaw/Pitch/Roll=false`. Speed-based `UpdateRotationRate()` (Idle 720°/s, AtSpeed 360°/s). |
| Input | `Source/PoF/Player/ARPGPlayerController.cpp` | C++-authored WASD modifiers (W=Swizzle YXZ, S=+Negate, A=Negate, D=direct) on `IA_Move`. `HandleMove()` applies camera-relative rotation → `AddMovementInput` (screen-relative already). `IA_Dodge`=SpaceBar → `HandleDodge()`. `IA_Look`=Mouse2D (stub). |
| Roll | `Source/PoF/AbilitySystem/GA_Dodge.{h,cpp}` | Direction from `GetLastMovementInputVector()` else backward; `SetActorRotation(DodgeDir.Rotation())`; plays directional montage (→ `AM_Roll`), root-motion driven; 25 stamina; `State.Invulnerable` while active; `AnimNotifyState_DodgeIFrame`. |
| Anim | `Source/PoF/Animation/ARPGAnimInstance.{h,cpp}`, `/Game/Characters/Player/ABP_VSPlayer`, `.../Animations/BS_Locomotion` | Velocity-driven **strafe** blend space: `Speed`/`SpeedRatio` × `Direction` (`GetMovementDirection()`, −180..180 relative to facing). `RootMotionFromMontagesOnly`. Locomotion state machine (Locomotion/Attacking/Dodging/HitReact/Death). Wiring test claims 11 samples; **idle-at-(0,0) gap reported historically — verify.** |
| Harness | `Source/PoF/Testing/ScenarioController.{h,cpp}` (runtime), `Source/PoFEditor/.../PoFScenarioRunner.{h,cpp}` (editor), bridge `Plugins/PillarsOfFortuneBridge/.../PofHttpServer.cpp` route `POST /pof/python/run` (`UPofPythonRunner`), `Content/Python/observation/` | Natural-PIE scenario runner armed via `-PoFScenario=<json>`; verbs api_probe/get_state/evaluate_pose/capture_frame/run_scenario + scenario_pie start/stop; returns `observations.json` + `frame_NN.png` + DONE. Discriminators: arm-droop variance = animating, 2D displacement = moved. |
| Tests | `Source/PoF/Test/Character/VSPlayerMovementTest.cpp` | `FVSPlayerMovementWiringTest` (L2 headless-safe), `FVSPlayerMovementPlayableTest` (L4 stub). |

---

## Architecture / Data Flow

```
Tuning loop (per change):
  1. Edit UE C++ / assets (Claude) ──► 2. Rebuild (if C++) / hot-edit (if UPROPERTY default)
  3. Drive scenario: scenario_pie.start(map, inbox.json) via POST :30040/pof/python/run
  4. Observe: read observations.json (loc/vel, yaw, anim Speed/Direction, arm-droop) + Read frame_NN.png
  5. Assert objective correctness (this spec's Acceptance)  ──► if fail, fix, goto 1
  6. User play-tests feel ──► feel feedback ──► nudge EditAnywhere knobs / goto 1

Facing (Approach A), per tick on AARPGPlayerCharacter:
  cursor ground point ← GetHitResultUnderCursor(ECC_Visibility)
  desired yaw ← (cursorPoint - actorLoc).Rotation().Yaw
  actor yaw  ← RInterpTo(currentYaw, desiredYaw, dt, CursorAimRotationSpeed)
  (bOrientRotationToMovement=false; movement velocity is independent → strafe)

WASD → screen-relative move (unchanged):
  IA_Move (WASD modifiers) → HandleMove() camera-relative transform → AddMovementInput

Roll (GA_Dodge):
  dir ← GetLastMovementInputVector() != 0 ? that : (cursorPoint - actorLoc) normalized
  SetActorRotation(dir.Rotation()) → play AM_Roll (root motion, tuned distance)
  → i-frame window → recovery blend-out to locomotion/idle (no T-pose snap)
```

---

## Design Detail

### 1. Control scheme & facing
In `AARPGPlayerCharacter`: default `bCursorAimActive=true`; set `bOrientRotationToMovement=false` (keep `bUseControllerRotationYaw=false`). `UpdateCursorAim()` already does the ground-trace + `RInterpTo`; confirm it runs every tick and ignores the trace when the cursor is over nothing useful (fall back to last valid yaw). WASD path is unchanged. Net result: body aims at mouse, feet go where WASD says.

### 2. WASD feel ("responsive, light weight")
Tune `CharacterMovementComponent` and expose as live knobs:
- `MaxWalkSpeed` (walk) + sprint multiplier (existing `StartSprinting`)
- `MaxAcceleration` (moderate-high — quick to top speed)
- `bUseSeparateBrakingDeceleration=true` + `BrakingDecelerationWalking` (strong but not instant — short stop with a faint slide)
- `GroundFriction` / `BrakingFrictionFactor` (light — preserves the "light weight" ease)
- `CursorAimRotationSpeed` (fast turn-to-cursor)

All grouped under `UPROPERTY(EditAnywhere, Category="PoF|Movement Feel")` so the user can nudge in the Details panel without recompiling. Seed with a modern-ARPG baseline; iterate against feel.

### 3. Roll (`GA_Dodge`)
- **Direction:** `GetLastMovementInputVector()` if non-zero, else `(cursorGroundPoint - actorLoc)` normalized. Snap yaw to it at start.
- **Distance/speed:** tune root-motion travel to a target (e.g. ~350–450u over the roll duration); expose roll distance/speed knob.
- **Recovery (parked bug):** clean blend-out from the roll montage back to locomotion/idle — no snap to reference/T-pose. Verify the Dodging→Locomotion transition and montage blend-out time.
- **Spacing (parked bug):** confirm root-motion displacement matches intent; fix if the character under/over-travels.
- Keep i-frame window (`AnimNotifyState_DodgeIFrame`) + 25 stamina; expose i-frame timing and cooldown as knobs.

### 4. Animation
- Verify all 8 strafe directions read correctly now that facing is decoupled (Direction sweeps full −180..180 while strafing).
- Ensure a real **idle sample at blend (0,0)** so standing-still + aiming idles instead of T-posing (historical content gap — verify against the live blend space; the wiring test asserts 11 samples but a prior session observed a (0,0) gap).
- Smooth the roll→locomotion recovery transition (ties to §3).

### 5. Harness verification (objective, per change)
Drive via `scenario_pie`/`-PoFScenario`, read `observations.json` + frames. A change is not "done" until its gate passes here, *before* the user feel-tests:

| Gate | Scenario | Pass condition |
|------|----------|----------------|
| Faces cursor | Place an aim target offset from pawn; tick | Pawn yaw converges to point at it within target time (e.g. ≤0.2s for a 90° turn) |
| WASD screen-relative | Inject W, S, A, D held separately on a lit open map | W→up-screen, S→opposite, A/D→perpendicular, opposite pairs anti-parallel (loc deltas) |
| Strafe animates | Face east (cursor east) + move north (W) | `Direction≈90°`; arm-droop variance > animating threshold (not T-pose); frame shows striding strafe |
| Idle not T-pose | No input, cursor placed | speed 0 → idle pose in frame (arms down), not arms-spread T-pose |
| Roll + WASD | SPACE while W held | rolls up-screen; `montage_playing` (AM_Roll); travels target distance; recovers to locomotion (no T-pose); i-frame window active |
| Roll alone | SPACE, no WASD | rolls toward cursor ground point |

Calibration note: trust the discriminators only after a known-good/known-bad check (arm-droop variance, 2D displacement) per the harness's established practice. Use a **lit** map (the arena, not the dark TestLevel) for any frame the agent reads.

### 6. Sequencing (each phase independently verifiable + playable)
1. **Control-scheme switch** — enable cursor aim, disable orient-to-movement; harness confirms faces-cursor + strafe + idle; user play-tests.
2. **WASD feel pass** — tune CMC + expose knobs; harness confirms directions/travel unbroken; user play-tests feel.
3. **Roll pass** — direction resolution + spacing + recovery; harness confirms roll gates; user play-tests.

---

## Out of Scope (YAGNI)
Turn-in-place anims; lock-on/soft-target; gamepad analog deadzone tuning; click-to-move; the PoF-app browser tuning UI (deferred option C). Addable later without reworking this baseline.

---

## Preconditions to verify at implementation time (not blockers to the design)
- UE editor running with the bridge listening on `:30040` and the latest C++ compiled (required for the harness loop). If not, launch with the crash-recovery-safe procedure (`-unattended`, cleared `Saved/{Autosaves,Crashes,SaveRecovery}` + `Intermediate/DisasterRecovery`; `-DisableAdaptiveUnity`; `-abslog` per shared-tree concurrency).
- Reconcile the BS_Locomotion sample count: wiring test says 11; a prior session observed a missing (0,0) idle sample. Confirm against the live asset before fixing.
- Confirm `HandleMove()`'s camera-relative basis maps screen-up to a stable world direction for the top-down camera (the "W = up-screen" gate covers this).
- UE repo: commit narrowly; pushes to `xkazm04/pof-exp` work. App repo: commit locally only (user pushes manually). Shared trees — re-read before edit, targeted `git add`.
