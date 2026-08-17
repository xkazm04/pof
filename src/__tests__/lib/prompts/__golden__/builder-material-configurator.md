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
- Generate a full Master Material with static switches and parameterized inputs.

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

## Task: Create Master Material — Metallic (PBR metal workflow)

### Surface Configuration
- Surface type: **Metallic (PBR metal workflow)**
- Shading model: **Default Lit (or Substrate Slab — Substrate is production-ready on UE 5.8)**
- Output type: **Master Material (full shader)**

### Parameter Defaults
  - Roughness: default=0.35, range=[0 – 1], step=0.01
  - Metallic: default=1, range=[0 – 1], step=0.01

### Rendering Features
- Enable Emissive output: connect emissive color with intensity multiplier. Consider using a mask texture to control which regions glow.

### Required Files (all under Source/PoF/Materials/)

1. **M_Metal_Master** — Material setup instructions
   - Node graph description for the UE5 Material Editor
   - All parameters exposed as ScalarParameter / VectorParameter / StaticSwitchParameter
   - Texture inputs: BaseColor, Normal, Roughness map, and any surface-specific maps
   - Static switches for optional features (emissive)
   - Proper material domain and blend mode for metal

2. **UMetalMaterialSetup** (UBlueprintFunctionLibrary)
   - Static helper to create and configure Dynamic Material Instances from the master
   - `static UMaterialInstanceDynamic* CreateMetalMaterial(UMeshComponent* Mesh)`
   - Apply all default parameter values from the configuration above
   - UFUNCTION(BlueprintCallable, Category = "Materials|Metal")

3. **UMetalMaterialComponent** (UActorComponent)
   - Attach to any actor to auto-apply this material
   - UPROPERTY for each parameter (Roughness, Metallic, etc.) with defaults matching above
   - OnParameterChanged — updates the MID when properties change in editor or at runtime
   - Tick-driven animation if WorldPositionOffset or emissive flicker is enabled

## UE5 Best Practices
- Use UMaterialInstanceDynamic for ALL runtime parameter changes
- TSoftObjectPtr<UMaterialInterface> for base material references
- Material Parameter Collections for global shared parameters (time of day, weather)
- Master Materials should use static switches to compile out unused features
- Group UPROPERTYs by category: "Material|Surface", "Material|Features"
- Include UPROPERTY metadata: ClampMin, ClampMax, UIMin, UIMax matching the parameter ranges above
- Substrate is the production material framework (production-ready since UE 5.7). Prefer a Substrate Slab over the legacy shading models (Default Lit, Subsurface, Cloth) for new materials — Substrate unifies PBR, subsurface, cloth, eye, thin-film, and clearcoat into a single flexible material graph.
- CRITICAL UE5 authoring gotcha: a Constant3Vector expression's color output pin is "" (the empty string), NOT "RGB". connect_material_property(node, "RGB", ...) silently returns false and the material renders black. Use a VectorParameter for tunable colors (its output IS "RGB"), or pass "" when wiring a Constant3Vector.
- Prefer emitting a MaterialInstanceConstant of the shared master M_ARPG_Surface_Master over authoring a new one-off Material. Instances share the compiled shader, keep the project consolidated, and expose Albedo/Normal/Roughness texture params + BaseColorTint + TilingScale + EmissiveStrength.