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
- **/Game/Maps/** (Content path, project) — Root for zone .umap assets authored by Zone Map recipes (extends build_arena.py / build_procgen_dungeon.py).

## Project Knowledge Tips
- **Blender→UE: author in metres, scale 1.0, world-aligned UVs** — Author geometry in metres. Blender FBX export: apply_unit_scale=True, global_scale=1.0 (the exporter writes the FBX in centimetres). UE import: import_uniform_scale=1.0 — NOT 100, which makes the mesh 100x oversized. For tiling textures, unwrap world-aligned planar (one repeat per N metres) rather than cube_project, so the texture reads at a uniform real-world scale with no repeating grid; the material then samples UV0 directly (TextureCoordinate tiling 1.0).
- **UE5 lighting: Movable (Lumen, headless) vs Static/Stationary (baked)** — Movable lights + Lumen = dynamic GI, works headless, no bake, but flatter. Static/Stationary lights = baked GI + soft shadows via a Lightmass bake — richer, but a static-mesh arena renders BLACK until the bake runs. To bake: author a 2nd (non-overlapping) lightmap UV channel (Blender uv.lightmap_pack), set the mesh light_map_coordinate_index=1, lights→Stationary, add a LightmassImportanceVolume, then Build Lighting (editor) or headless ResavePackages -buildlighting -AllowCommandletRendering. The project defaults to Lumen; to show baked GI WITHOUT flipping the whole project off Lumen, override the GI method to None on a PostProcessVolume (scopes baked lighting to that level).
- **Procedural levels: ARPGLevelGenerator + RoomTemplate data assets** — The project has a working ARPGLevelGenerator (graph room placement, weighted templates, AABB overlap, seeded). Drive it: author UARPGRoomTemplate PrimaryDataAssets (RoomSize, ConnectionSlots with N/S/E/W direction + edge offset), set the generator pool/start/end + target count + seed, call GenerateLevel() (BlueprintCallable — works from editor Python to bake rooms into a saved map). For a WALKABLE dungeon: place connected rooms adjacent (RoomPadding=0, tiny CorridorLength) and open the shared walls (AARPGBlockoutRoom::InitRoom sets dimensions + which sides are open archways) — touching rooms minus the shared wall = one continuous floor, no corridor meshes needed.
- **Procedural generation is strong** — Code-driven level generation is an area where Claude can contribute significantly - algorithms over art.

## Domain Context
You are helping with level design systems including living design documents, room/encounter flow, spawn systems, difficulty arcs, and bidirectional design-to-code synchronization in UE5. On UE 5.8: the PCG framework is production-ready for procedural content generation, and 5.8 makes generated PCG results editable in place. MegaLights is production-ready on 5.8 — prefer it for many dynamic lights without baked lightmaps.

## Task
How are room spawn managers wired today?