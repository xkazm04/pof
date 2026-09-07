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
- **a client-visible change needs BOTH a replicated source property (DOREPLIFETIME) and an OnRep — an OnRep alone updates nothing, and controller-local state needs an IsLocalController guard** — The single largest class of structurally-plausible-but-wrong generated UE C++. Two halves, and generated code reliably writes one without the other. (1) SOURCE STATE: adding UFUNCTION() OnRep_X and marking a property ReplicatedUsing=OnRep_X does nothing unless the property is ALSO registered in GetLifetimeReplicatedProps with DOREPLIFETIME(AClass, X) and the actor/component actually replicates (bReplicates, plus SetIsReplicated(true) on a component). It compiles, the server mutates the value, the HUD never moves, and nothing errors — so a build-only gate passes it. Mutate replicated state on the SERVER only (HasAuthority()); a client-side write is overwritten on the next update. (2) LOCALITY: state belonging to ONE player — an open menu, a browsing index, local playback, an input-mode change, a camera shake — must be guarded by IsLocalController() (controller) / IsLocallyControlled() (pawn), or it runs on the wrong controller instance. RPC direction is the same check: a Server RPC needs WithValidation and runs on the server, a Client RPC targets one owning connection, a Multicast reaches everyone — a cosmetic cue is Multicast, never a replicated gameplay property. VERIFY BY RUNNING: a listen-server PIE session with 2 clients is what exposes this, which is why a build-green replication change is unproven. (research: GameEngineBench (arXiv 2607.03525) — recurring authority/replication failure class across 110 runtime-verified UE5 tasks)
- **the constructor runs at CDO time (no world, no other actors) — defaults there, wiring in BeginPlay, and every BeginPlay acquisition needs its EndPlay release** — The second recurring structural failure class in generated UE C++, and it is an ORDERING bug rather than a syntax one. The constructor executes when the Class Default Object is built — during cook and editor load, before any world exists — so it may only set defaults, create subobjects (CreateDefaultSubobject) and attach components. Anything touching the world, other actors, the game mode, a subsystem, replicated data or an asset load belongs in BeginPlay (or PostInitializeComponents / OnRegister for component wiring); in the constructor it either crashes the cook or silently bakes a stale value into the CDO that every instance shares. Activation timing is the same trap from the other side: a component created but never activated (bAutoActivate false with no Activate()), a timer set before the subsystem it calls exists, or a delegate bound in the constructor to an actor that has not spawned — all compile, all do nothing. TEARDOWN MUST BE SYMMETRIC: every BeginPlay acquisition — AddDynamic bindings, SetTimer handles, spawned actors, registrations with a subsystem or manager — needs its release in EndPlay (and call Super::EndPlay), or a PIE session leaks it into the NEXT one and the second run of the same test behaves differently from the first. That is exactly the shared-world hazard the functional-test rule names: state surviving EndPlay is state the next test inherits. (research: GameEngineBench (arXiv 2607.03525) — constructor-default / activation-timing / teardown failure cluster)
- **save/load, streaming and spawning are ONE contract — a persistence change that touches only the save struct silently loses destroyed actors and streamed-in state** — The hardest unsolved class in the runtime-verified benchmark: the tasks no agent configuration solved needed coordination BETWEEN runtime systems rather than any single API call, and persistence is the canonical case. A correct save/load pass keeps five things consistent at once. (1) STABLE ACTOR IDENTITY across sessions — a name or GUID that survives a reload, never a pointer, an array index or spawn order. (2) DESTROYED actors recorded EXPLICITLY, because a level reload respawns everything the map placed and an absent entry reads as 'still alive'. (3) The serialized property set matching the class as it is TODAY — add a SaveGame-tagged field and old saves must still load, so version the struct and handle the missing field rather than invalidating every existing save. (4) LEVEL STREAMING order — an actor in a sublevel that has not streamed in yet cannot be restored when the save is applied; restore on the level-loaded callback, not on BeginPlay of the persistent level. (5) The SAVE/LOAD LIFECYCLE itself — an async AsyncSaveGameToSlot completing after the actor that requested it was torn down. Write the change against all five or the feature is correct in a single fresh session and wrong on the second load, which is precisely the shape a one-shot smoke test cannot see. The same 'several systems must agree' warning applies to inventory-to-UI, ability-to-animation and streaming-to-AI changes. (research: GameEngineBench (arXiv 2607.03525) — 31/110 tasks unsolved by every configuration, clustered on cross-system coordination)

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