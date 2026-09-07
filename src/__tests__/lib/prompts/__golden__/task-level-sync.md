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