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
- Generate all code files directly — do NOT ask for confirmation.
- Use UE5 C++ best practices for animation systems.
- All animation-related UPROPERTYs should be EditAnywhere, BlueprintReadWrite.
- Place animation classes under Source/PoF/Animation/.
- Place editor-only classes (commandlets) under Source/PoFEditor/.
- Include .h and .cpp files for every class.

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

## Project Knowledge Tips
- **C++ AnimInstance** — Use C++ AnimInstance for performance-critical animation logic, expose variables to AnimBP for visual state machine.

## Domain Context
You are helping create animation systems including AnimBP, locomotion states, montages, and notifies in UE5.

## Task: Step 3 — Locomotion blend space

### Overview
Author the 2D locomotion blend space and drive it from the AnimInstance.

### Detailed Requirements
1. Create BS_Locomotion with Speed and Direction axes.
2. Drive the axes from NativeUpdateAnimation.

### Implementation
Generate the UARPGAnimInstance that drives BS_Locomotion.

### UE5 Animation Best Practices
- Use NativeUpdateAnimation() instead of BlueprintUpdateAnimation() for C++ AnimInstances
- Cache component references in NativeInitializeAnimation() to avoid per-frame lookups
- Montage callbacks: use FOnMontageEnded / FOnMontageBlendingOut delegates
- Anim Notify States must handle interrupted montages gracefully (NotifyEnd always called)
- Use FGameplayTag for state communication between anim notifies and gameplay code
- TSoftObjectPtr for all animation asset references to support async loading
- Root motion: enable per-montage, disable for locomotion blend spaces

### Mixamo Import & Retargeting Best Practices
- Files come from mixamo.com as **FBX Binary**, 30 FPS, one animation per file.
- The first/character download is "**With Skin**" (creates the mesh+skeleton);
  every animation is "**Without Skin**" to reuse one skeleton.
- Locomotion (idle/walk/run) is "**In Place**"; attacks/dodges keep root motion.
- Mixamo bones use the `mixamorig:` prefix — the pipeline strips/handles it on import.
- After import, verify the strip took: bone names must show "Hips", not "mixamorig:Hips"
- For attacks/dodges that need root motion: use RootMotionGeneratorOp post-process to extract from hip translation
- IK Retargeter Python API (UE5.7+): use IKRetargeterController for scriptable batch retargeting
  - auto_map_chains(AutoMapChainType.FUZZY) handles Mixamo→UE5 bone chain mapping automatically
  - IKRetargetBatchOperation.duplicate_and_retarget() processes hundreds of animations in one call
- Align retarget pose for T-pose (Mixamo) vs A-pose (UE5 Mannequin) differences
- UE5.7+: enable spatially aware retargeting, crotch height constraints, and stretch chain operators for better results

### Commandlet Automation Notes (verified on UE 5.7; this project builds on UE 5.8)
- **Automatable via commandlet**: BlendSpace1D, AnimMontage shells (with sections + linking) — runs headless in ~0.06s
- **NOT automatable**: AnimBP state machine graph, Anim Notify placement on montage timeline — requires editor
- **BlendSpace gotcha**: GetBlendParameter() returns const. Use FProperty reflection on "BlendParameters" UPROPERTY instead
- **SavePackage gotcha**: UPackage::SavePackage() returns bool in UE 5.7. UPackage::Save() returns FSavePackageResultStruct — different methods
- **Editor module pattern**: Separate PoFEditor module (Type: Editor in .uproject), depends on UnrealEd + AssetTools
- **Commandlet run**: UnrealEditor-Cmd.exe Project.uproject -run=CommandletName -nopause -unattended -nosplash