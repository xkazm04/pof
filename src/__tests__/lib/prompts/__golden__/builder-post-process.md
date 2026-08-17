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
- Use UE5 Post Process Volume best practices.
- Expose all parameters as UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.

## Known UE Pitfalls
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)
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

## Project Knowledge Tips
- **Material instances** — Always use Material Instances for runtime changes. Never modify the parent material directly in-game.

## Task: Create Post-Process Volume Setup

Generate a complete C++ post-process volume configuration with the following 1 enabled effects: **Bloom**.

### Effect Stack (ordered by priority)

### 1. Bloom (ENABLED)
- UE class: FPostProcessSettings
- Description: Halo bleed from bright pixels.
- Est. GPU cost: 0.4ms @ 1080p
- Parameters:
  - BloomIntensity (float) = 1.2  [range: 0 – 8] — Overall bloom strength.

### Required Files (all under Source/PoF/PostProcess/)

1. **APoFPostProcessVolume** (extends APostProcessVolume)
   - Header + CPP files
   - Override BeginPlay to configure all enabled effects programmatically
   - UPROPERTY for each enabled effect's parameters (grouped by effect in UPROPERTY Category)
   - `void ApplySettings()` — applies all UPROPERTY values to the volume's FPostProcessSettings
   - Call ApplySettings() in BeginPlay and whenever parameters change (PostEditChangeProperty in editor)

2. **UPoFPostProcessComponent** (UActorComponent)
   - Attach to any actor to create a local post-process zone
   - Uses a UPostProcessComponent internally
   - UPROPERTY float BlendRadius, float BlendWeight
   - Subset of effects configurable per-instance (most common: bloom, DOF, color grading)

3. **UPoFPostProcessSubsystem** (UWorldSubsystem)
   - Global manager that registers volumes and handles priority-based blending
   - `void RegisterVolume(APoFPostProcessVolume*)`
   - `void SetGlobalOverride(FName EffectName, float Value)` for gameplay-driven overrides (e.g., low-health vignette)
   - Blueprint-callable functions for common runtime adjustments

4. **Setup Instructions**
   - How to place the volume in a level
   - How to set Infinite Extent (Unbound) for global effects
   - Priority ordering explanation matching the stack above
   - Notes on performance cost per effect

### UE5 Best Practices
- Use FPostProcessSettings struct members directly — do not create custom post-process materials unless needed
- Expose Blend Weight and Priority on the volume for designers
- Group UPROPERTYs by category: "PostProcess|Bloom", "PostProcess|ColorGrading", etc.
- Use PostEditChangeProperty to live-preview changes in editor
- Consider mobile: some effects (SSAO, motion blur) are expensive on mobile — add bMobileOptimized flag