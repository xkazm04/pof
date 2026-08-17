## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:\proj\PoF\PoF.uproject" -WaitMutex

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.

## Known UE Pitfalls
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)
- **Motion Matching: anims need root motion even w/o capsule root motion; the Phase channel CRASHES the editor; tune cost bias carefully** — Source anims in a Pose Search database need root motion ENABLED even when the capsule is driven by velocity (not root motion) — the pose search scores foot velocity/position from it. Do NOT enable the Phase channel in the pose-search schema — it crashes the editor and keeps crashing on reopen. Collected bones (pose history) must match the bones in the pose channel. Do not lower Continuing Pose Cost Bias too far (the character becomes unresponsive / sticks in one animation); if a Chooser will not leave a loop DB for a stop DB, lower the stop DB base cost bias. Reduce foot sliding with a SMALL play-rate window (~0.75-1.25, not 0.5-1.5) or Dead Blending; be cautious with mirroring (foot sliding / tilt). Use Exclude-From-Database (not a manual cut) to drop T-posed lead frames. (research: Motion Matching Problems & Solutions (Unreal DevOP))
- **Pick failure severity by consequence: cosmetic load failures warn-and-continue; gameplay-invariant violations hard-fail — and never fabricate the missing object to keep running** — When generated code handles a failed load or lookup, choose severity by what the failure breaks, not by habit. A COSMETIC asset that fails (a mesh, VFX, audio cue) should log a warning and continue — stopping everyone because pretty_tree_03 didn't load is wrong. A GAMEPLAY-INVARIANT violation must hard-fail fast (check(), UE_LOG Fatal, or ensure + early-return): the classic case is a locked door/gate actor failing to spawn — the dungeon behind it assumes quest state that 'cannot' be missing, so warn-and-continue surfaces days later as an inexplicable bug in unrelated code, downstream of the real cause. And never 'fix' a failure by fabricating the missing state (constructing an empty list/table/object so execution can proceed) — that converts a loud caller bug into silent corruption. (research: T. Cain code standards (WildStar/Outer Worlds notes))

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

## Known Project Assets (use these EXACT paths — do not invent paths)
- **/MoverTests/Characters/Mannequins/Meshes/SKM_Manny** (SkeletalMesh, MoverTests plugin) — Rigged player mannequin (UE 5.7 MoverTests plugin). No download — enable the plugin.
- **/MoverTests/Characters/Mannequins/Meshes/SKM_Manny_Simple** (SkeletalMesh, MoverTests plugin) — Simplified mannequin used for the enemy in the vertical slice.
- **/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin** (Skeleton, MoverTests plugin) — Target skeleton for Mixamo retargeting (mixamo_pipeline.py default).
- **/MoverTests/Characters/Mannequins/Animations/ABP_Manny** (AnimBlueprint, MoverTests plugin) — Ready-made locomotion AnimBP (idle/walk/run) — avoids the AnimBP-authoring wall. Generated class: ABP_Manny_C.
- **/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_01** (MaterialInstance, MoverTests plugin) — Default mannequin material instance (player).
- **/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_02** (MaterialInstance, MoverTests plugin) — Alternate mannequin MI — TOO SUBTLE for visual enemy distinction; prefer M_EnemyRed.
- **/Game/VerticalSlice/M_EnemyRed** (Material, project) — Strong-red enemy material (base + emissive) — the enemy-distinction default, clearly distinct from the silver player mannequin.
- **/Game/Characters/Mannequins/ (ThirdPerson template — only if migrated)** (SkeletalMesh + AnimBlueprint, ThirdPerson template) — FALLBACK only: the ACharacter-based ThirdPerson mannequin + ABP_Manny/ABP_Quinn, to migrate into /Game/Characters/ if MoverTests ABP_Manny is ever found Mover-coupled. Documented, not the default.
- **/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin** (Skeleton, MoverTests plugin) — Target skeleton for Mixamo retargeting (mixamo_pipeline.py default). State Graph recipes retarget onto this.

## Domain Context
You are helping create UE5 C++ gameplay classes (GameMode, Character, Controller, GameInstance, etc.) for an action RPG. Focus on ACharacter subclasses, movement components, camera setup, and Enhanced Input integration.

## Task
## Task: Apply Resolved Character Feel — "Dark Souls Heavy" + 0 layers

Apply the following resolved UPROPERTY values to ARPGCharacterBase. These values are the base preset "Dark Souls Heavy" (Soulslike) with the active adjustment layers below stacked on top (non-destructive — the base preset is unchanged).

### Base Preset
Dark Souls Heavy — Deliberate, weighty combat with commitment-heavy dodges and slow recovery

### Adjustment Layers (applied in order)
_No adjustment layers active — applying the base preset as-is._

### Resolved Parameter Values to Set

**Movement (UCharacterMovementComponent)**
- MaxWalkSpeed: 320
- MaxSprintSpeed: 580 (custom UPROPERTY)
- MaxAcceleration: 1200
- BrakingDecelerationWalking: 2400
- RotationRate.Yaw: 360
- AirControl: 0.1
- JumpZVelocity: 400
- GravityScale: 1.3

**Combat (ARPGCharacterBase / AbilitySystem)**
- BaseDamage: 45
- AttackSpeed: 0.7
- ComboWindowMs: 600
- HitReactionDuration: 0.5
- CritChance: 0.08
- CritMultiplier: 1.5
- AttackRange: 250
- CleaveAngle: 90

**Dodge (GA_Dodge / ARPGCharacterBase)**
- DodgeDistance: 350
- DodgeDuration: 0.7
- IFrameStart: 0.05
- IFrameDuration: 0.4
- DodgeCooldown: 0.3
- DodgeStaminaCost: 35
- DodgeCancelWindowStart: 0.55
- DodgeCancelWindowEnd: 0.7

**Camera (USpringArmComponent / CameraComponent)**
- TargetArmLength: 600
- CameraLagSpeed: 6
- FieldOfView: 80
- SprintFOVOffset: 3
- SwayMaxRoll: 0.5
- SwayMaxPitch: 0.3
- SwayInterpSpeed: 2
- SocketOffset.Z: 40

**Stamina**
- StaminaDrainPerSec: 25
- StaminaRegenPerSec: 12

### Instructions
1. Read ARPGCharacterBase.h and ARPGCharacterBase.cpp
2. Find or create each UPROPERTY listed above
3. Set the default values in the constructor
4. Ensure properties are in the correct UPROPERTY category for Blueprint exposure
5. Verify the code compiles