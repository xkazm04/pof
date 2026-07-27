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
- Use UE5 Material system best practices.
- All parameters must be UPROPERTY(EditAnywhere, BlueprintReadWrite) for designer tuning.
- This is a style-transfer task: replicate the visual look as closely as possible.
- Generate a full Master Material with parameterized inputs matching the analyzed properties.

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

## Task: Create Material from Style Reference — Metal Surface

Create a UE5 material that replicates the visual look described below. The material properties were extracted from a reference screenshot and/or user description.

### Analyzed Visual Properties
- Detected surface type: **metal** (86% confidence)
- Shading model: **Default Lit (PBR metal workflow)**
- Description: Aged patinated bronze with deep recessed detail.

### Extracted Material Properties
- Roughness: 0.42 (range 0-1)
- Metallic: 0.95 (range 0-1)
- Emissive Intensity: 0.0 (range 0-20)
- Subsurface Presence: 0.00 (0=none, 1=strong)
- Parallax Depth: 0.020 (range 0-0.2)
- Opacity: 1.00 (range 0-1)
- Rendering features: parallax
- Color palette: bronze, verdigris, soot
**Note:** No reference image was provided. Properties were inferred from the text description.
### User Description
Weathered bronze temple door with verdigris in the recesses.

### Required Files (all under Source/PoF/Materials/)

1. **M_StyleTransfer_Metal_Master** — Material setup instructions
   - Complete node graph for the UE5 Material Editor
   - All analyzed parameters exposed as ScalarParameter / VectorParameter
   - Color palette implemented via a tint parameter or LUT
   - Texture inputs: BaseColor, Normal, Roughness map, and surface-specific maps
   - Static switches for optional features (parallax)
   - Proper material domain and blend mode for metal

2. **UMetalStyleMaterialSetup** (UBlueprintFunctionLibrary)
   - Static helper to create and configure Dynamic Material Instances
   - `static UMaterialInstanceDynamic* CreateStyleMaterial(UMeshComponent* Mesh)`
   - Apply all parameter values from the analysis above as defaults
   - UFUNCTION(BlueprintCallable, Category = "Materials|StyleTransfer")

3. **UMetalStyleMaterialComponent** (UActorComponent)
   - Attach to any actor to auto-apply this material
   - UPROPERTY for each analyzed parameter with defaults matching analysis
   - OnParameterChanged — updates the MID when properties change
   - Runtime tweaking support for iterative refinement

### Color Palette Implementation
Use the extracted colors to set up:
- Base color tint from the dominant color
- Emissive color from the brightest/most saturated color (if emissive)
- Subsurface color from warm tones (if subsurface present)
- Create a MaterialParameterCollection with these colors for global access

### UE5 Best Practices
- Match the reference visual as closely as possible with standard PBR inputs
- Use Material Parameter Collections for colors that may be shared across materials
- UMaterialInstanceDynamic for ALL runtime parameter changes
- TSoftObjectPtr<UMaterialInterface> for base material references
- If the reference has animated elements (scrolling, flickering), implement via Custom HLSL node with Time input
- Group UPROPERTYs: "Material|Surface", "Material|Color", "Material|Features"
- Include UPROPERTY metadata: ClampMin, ClampMax matching the parameter ranges