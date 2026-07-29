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
Create the character class hierarchy for this ARPG project:
1. Create AARPGCharacterBase (extends ACharacter) with core stats (Health, Mana, Stamina)
2. Create AARPGPlayerCharacter and AARPGEnemyCharacter subclasses
3. Add a UDataTable reference for character archetypes
4. Create a JSON export of the class hierarchy at Config/CharacterHierarchy.json so PoF can read it
5. Verify the build compiles

## Wiring Requirements
For EVERY artifact you generate, make it runnable out-of-the-box — do not stop at "it compiles":
- **Granting / registration**: state how the artifact is granted or registered (ability granted to the ASC, GameMode class set, IMC added to the input subsystem, component added to the actor).
- **Activation**: state what triggers it at runtime (input action, gameplay event, BeginPlay, overlap).
- **Dependencies**: list the companion assets it needs and FLAG any binary-content dependency (Widget/Animation Blueprint, Behavior Tree, .umap) that cannot be authored from code.
- **Verification**: give ONE observable check that proves the wiring works (a log line, an on-screen value, a functional-test assertion).
In your output, include a `wiring` field for each generated artifact summarizing the four points above.

Known editor-authored dependencies for this module (cannot be created from code — declare how each is provided):
- BP_ARPGPlayerCharacter (Other): Blueprint subclass of the C++ player character used as DefaultPawn
- IMC_Default (InputMappingContext): Input Mapping Context added to the Enhanced Input subsystem on possess
- BP_ARPGGameMode (GameMode): GameMode with DefaultPawnClass / PlayerControllerClass / HUDClass set