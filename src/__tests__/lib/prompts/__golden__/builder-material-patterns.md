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
- Use UE5 Material system best practices with UPROPERTY-exposed parameters.
- Create both C++ helper classes and material setup instructions.

## Known UE Pitfalls
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)

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

## Task: Generate Dissolve Material System

### Effect Description
Noise-driven dissolve with an emissive burn edge.

### Technical Approach
Mask the opacity with a noise texture stepped by a scalar parameter.

### HLSL Reference
```hlsl
float Mask = step(Noise, DissolveAmount);
```

### Tags
vfx, opacity

### Required Files (all under Source/PoF/Materials/)

1. **Material Parameter Collection (MPC)**
   - Create a UMaterialParameterCollection or C++ helper that exposes all dynamic parameters
   - Parameters should match the HLSL reference above (e.g., Time, Intensity, Color values)
   - All parameters UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning

2. **Material Function Library (C++ Helper)**
   - UDissolveMaterialHelper (UBlueprintFunctionLibrary)
   - Static functions to create and configure Dynamic Material Instances at runtime
   - SetupMaterial(UMeshComponent*) — creates and assigns the dynamic material instance
   - UpdateParameters(UMaterialInstanceDynamic*, float DeltaTime) — animates time-based params
   - All functions UFUNCTION(BlueprintCallable, Category = "Materials|Dissolve")

3. **Material Setup Blueprint Instructions**
   - Step-by-step instructions for creating the material in the UE5 Material Editor
   - Node graph description matching the HLSL reference
   - Which material domain and blend mode to use
   - Texture slot descriptions and recommended texture types

4. **Actor Component (optional but recommended)**
   - UDissolveMaterialComponent (UActorComponent)
   - Attach to any actor to auto-apply and animate the material
   - Tick-driven parameter updates for animated effects
   - Exposed UPROPERTY parameters for per-instance customization

### UE5 Best Practices
- Use UMaterialInstanceDynamic for runtime parameter changes
- TSoftObjectPtr<UMaterialInterface> for base material reference (async loading)
- Material Parameter Collections for global parameters shared across instances
- Expose key parameters to Blueprint with sensible defaults
- Include UPROPERTY(Category) grouping for clean Details panel
- Add editor-time preview support where possible