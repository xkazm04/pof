## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- Do NOT modify any project files — this is a read-only sync check.
- Focus only on comparing doc vs code.

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

## Known Project Assets (use these EXACT paths — do not invent paths)
- **/Game/Maps/** (Content path, project) — Root for zone .umap assets authored by Zone Map recipes (extends build_arena.py / build_procgen_dungeon.py).

## Project Knowledge Tips
- **Blender→UE: author in metres, scale 1.0, world-aligned UVs** — Author geometry in metres. Blender FBX export: apply_unit_scale=True, global_scale=1.0 (the exporter writes the FBX in centimetres). UE import: import_uniform_scale=1.0 — NOT 100, which makes the mesh 100x oversized. For tiling textures, unwrap world-aligned planar (one repeat per N metres) rather than cube_project, so the texture reads at a uniform real-world scale with no repeating grid; the material then samples UV0 directly (TextureCoordinate tiling 1.0).
- **UE5 lighting: Movable (Lumen, headless) vs Static/Stationary (baked)** — Movable lights + Lumen = dynamic GI, works headless, no bake, but flatter. Static/Stationary lights = baked GI + soft shadows via a Lightmass bake — richer, but a static-mesh arena renders BLACK until the bake runs. To bake: author a 2nd (non-overlapping) lightmap UV channel (Blender uv.lightmap_pack), set the mesh light_map_coordinate_index=1, lights→Stationary, add a LightmassImportanceVolume, then Build Lighting (editor) or headless ResavePackages -buildlighting -AllowCommandletRendering. The project defaults to Lumen; to show baked GI WITHOUT flipping the whole project off Lumen, override the GI method to None on a PostProcessVolume (scopes baked lighting to that level).
- **Procedural levels: ARPGLevelGenerator + RoomTemplate data assets** — The project has a working ARPGLevelGenerator (graph room placement, weighted templates, AABB overlap, seeded). Drive it: author UARPGRoomTemplate PrimaryDataAssets (RoomSize, ConnectionSlots with N/S/E/W direction + edge offset), set the generator pool/start/end + target count + seed, call GenerateLevel() (BlueprintCallable — works from editor Python to bake rooms into a saved map). For a WALKABLE dungeon: place connected rooms adjacent (RoomPadding=0, tiny CorridorLength) and open the shared walls (AARPGBlockoutRoom::InitRoom sets dimensions + which sides are open archways) — touching rooms minus the shared wall = one continuous floor, no corridor meshes needed.
- **Procedural generation is strong** — Code-driven level generation is an area where Claude can contribute significantly - algorithms over art.

## Task: Level Design Sync Check

LEVEL DESIGN DOC: Crypt of the First King
ROOMS:
  - Crypt Antechamber (combat, diff 3): no linked files

INSTRUCTIONS:
1. For each room with linked files, read the C++ files and compare against the design doc
2. Check: spawn counts match, enemy classes match, wave configuration matches, difficulty parameters match
3. Decide ONE verdict for the whole document:
   - `synced` — the code matches the design doc on every field you compared
   - `doc-ahead` — the doc describes design the code does not implement yet
   - `code-ahead` — the code has behaviour the doc never described
   - `diverged` — both sides changed independently (doc and code each hold something the other lacks)
4. Report each field-level difference as a divergence object:
   - `roomId` / `roomName` — the room it belongs to (roomId must be one of the ids above)
   - `field` — the differing field, named as the DESIGN DOC names it where possible
     (`difficulty`, `pacing`, `type`, `name`, `description`, `encounterDesign`,
     `linkedFiles`, `tags`) so the doc can adopt the code value in one click
   - `docValue` / `codeValue` — the two differing values (they must NOT be equal)
   - `severity` — `info`, `warning` or `critical`
   - `suggestion` — the one-line fix
5. `codeHash` is required: a short fingerprint of the code you compared (the git
   commit SHA of HEAD if the project is a git repo, else a short digest of the
   file paths + sizes you read). It is the evidence a comparison actually ran.
6. Rules the submission is CHECKED against — a violation is rejected with a reason:
   - `synced` must ship an empty `divergences` array;
   - `diverged` must name at least one divergence;
   - a divergence whose `docValue` equals its `codeValue` is refused.
7. Do NOT write a report file anywhere — submit through the callback below; that
   is the only path the app reads.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "status": "synced|doc-ahead|code-ahead|diverged",
  "codeHash": "<fingerprint of the code you compared>",
  "divergences": [
    {
      "roomId": "<one of the room ids above>",
      "roomName": "<room name>",
      "field": "difficulty",
      "docValue": "<value in the design doc>",
      "codeValue": "<value in the C++>",
      "severity": "info|warning|critical",
      "suggestion": "<one-line fix>"
    }
  ]
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `moduleId`: `"level-design"`
- `docId`: `1`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds