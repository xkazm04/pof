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
- **Constant3Vector output pin is "" not "RGB"** — A MaterialExpressionConstant3Vector exposes its output on pin "" — connect_material_property(node, "RGB", ...) silently returns false and yields a black material. Use the empty-string pin name. (vertical-slice: materials)
- **verify unreal.* API names by introspection before calling — never guess** — Guessed unreal.* class/method/property names fail silently (return None/false) or crash the pythonscript commandlet, and each wrong guess burns tokens on retries. Before calling an unfamiliar API, confirm it exists and check its signature: use mcp-unreal lookup_class / lookup_docs / subsystem_query, or `dir(unreal.X)`, `help(unreal.X.method)`, and `unreal.X.__doc__` inside execute_script. Prefer EditorSubsystem getters (unreal.get_editor_subsystem(...)) over deprecated global helpers. (research: Claude-in-UE5 demo (Stefan 3D AI) + VibeUE introspection)
- **Lumen software tracing misses thin geometry — raise the mesh Distance Field Resolution Scale** — With Lumen Software Ray Tracing, thin meshes (walls, ceilings, railings) drop out of the mesh distance field and leak light / lose GI. Fix per-mesh in the Static Mesh Editor build settings: raise Distance Field Resolution Scale (e.g. ~10-20) — costs memory/disk but resolves thin geo — or thicken the mesh. Visualize with Show Flags → Visualize → Mesh Distance Fields. (research: Lumen in AAA (Karim Yasser))
- **Pick Lumen SWRT mode by world scale: Detail Tracing (per-mesh) vs Global Tracing (large worlds)** — Lumen Software Ray Tracing has two modes. Detail Tracing uses per-mesh distance fields — accurate, best for focused/interior or small-distance detail. Global Tracing uses the low-res global distance field — cheaper + faster, loses small-distance detail, best for large open-world environments. Choose by project scale, not by default. (research: Lumen in AAA (Karim Yasser))
- **Lumen HWRT surface-cache gives black/inaccurate reflections on smooth surfaces — use Hit Lighting for Reflections** — With Hardware Ray Tracing, the default Surface Cache produces black or wrong reflections on smooth/specular surfaces (water, polished floors). Set the post-process Lumen reflection method to "Hit Lighting for Reflections" for accurate reflections at moderate cost. Avoid full "Hit Lighting" in shipping games — it casts far more indirect rays and is too expensive to be reliable. (research: Lumen in AAA (Karim Yasser))
- **Procedural set dressing driven by bounding boxes alone places tables on paint cans — give each prop declared placement affordances (place_floor/surface/any, stack_true/false, copy_N, max_stack_N), fill largest-first, then settle** — A prop-placement pass that knows only each mesh's bounding box has no idea what an object IS, so it puts large props on thin surfaces and stacks heavy furniture on small clutter — the composition reads mechanically assembled even when nothing intersects. Encode the rules ONCE per asset as UE actor tags and let the generator read them: place_floor (ground only — furniture, big crates), place_surface (only on top of something else — cans, bottles, documents), place_any (either); stack_true / stack_false (may anything rest on this — false for cans, cables, handled canisters, and anything whose top is not flat); copy_N (instances to spawn — clusters read better than singles); max_stack_N (run height, default around 3 — raise it for pallets/crate towers). Author the tags large → medium → small, asking what could realistically sit on what. Then three solver rules do the rest: (1) place LARGEST FIRST so big pieces establish the surfaces smaller props land on; (2) a support's footprint must be >= the prop's footprint, which is what actually prevents the thin-surface failure; (3) apply small random yaw jitter, because perfectly axis-aligned props are the strongest tell of automated placement. Untagged props should default to 'placeable anywhere, load-bearing for nothing' — the safe reading. Finally, prefer a PHYSICS SETTLE over more solver rules for piles, clutter, and filling containers: enable simulate physics on the spawned actors, let them fall, then BAKE the resulting transforms back and disable physics — settling is both cheaper to implement and more believable than analytic rules, and it removes the need for most tags when the arrangement is a pile rather than a deliberate arrangement. PoF ships the solver as src/lib/visual-gen/generators/composition.ts (tags in placement-tags.ts, round-trippable to real actor tags); the settle-and-bake half is UE-side. (research: Composition Maker for Unreal Engine 5 (Andrew Averkin))
- **A physics settle cannot run in -run=pythonscript: set_simulate_physics(True) reports is_simulating_physics() False (no physics scene) and LevelEditorSubsystem.editor_play_simulate() FATALLY crashes the commandlet — settle in a -game session, bake transforms from python** — Live-probed on UE 5.8.0. The whole API surface resolves in the pythonscript commandlet — PrimitiveComponent.set_simulate_physics / is_simulating_physics / put_rigid_body_to_sleep / set_enable_gravity, LevelEditorSubsystem.editor_play_simulate / editor_request_end_play / is_in_play_in_editor, EditorActorSubsystem.spawn_actor_from_class, SystemLibrary.begin_transaction / end_transaction, PhysicsAsset / BodyInstance / ChaosSolverActor — so introspection alone suggests a headless 'simulate then bake' pass is scriptable. It is NOT. Two hard walls: (1) the commandlet's world is a transient /Temp/Untitled_0 with NO physics scene, so set_simulate_physics(True) silently leaves is_simulating_physics() == False and a spawned actor never falls; (2) calling LevelEditorSubsystem.editor_play_simulate() is a FATAL crash (callstack through UnrealEditor-PythonScriptPlugin.dll, process exit code 3), not an exception you can catch — there is no editor loop to enter. There is also no scriptable time-advance: SystemLibrary only offers delay_until_next_tick / set_timer_for_next_tick, which need a tick that never comes. Split the work accordingly: the BAKE half (read/write actor transforms, actor tags, transactions, saving the map) is fully headless; the SETTLE half needs a world that actually ticks — run it in a -game session (the scenario-controller path) or the interactive editor, and have python only stamp the resulting transforms back. Same shape as the headless-render finding: the commandlet is an asset-authoring tool, not a simulation host. (research: Composition Maker (Andrew Averkin) + live 5.8 headless physics-settle probe)
- **AI-generated meshes arrive normalised to a ~1 m box (hero AND sword hilt alike) — set a per-asset ImportUniformScale from the intended real-world size, or the hero imports at 100 cm** — Every image/text-to-3D generator (Tripo, TripoSR, Hunyuan…) normalises its output so the longest bounding-box extent is ~1.0 in glTF metres, whatever the asset is: measured over PoF's own generated/ library a hero character is 1.00 m tall, a crate 1.00 m, a sword HILT 1.02 m long. The unit is right (metres → the importer's own m→cm conversion applies), so the `fbx-import-scale` rule (import_uniform_scale = 1.0, not 100) still holds — but the SIZE is not, and a scale of 1.0 ships the hero at 100 cm next to the 180 cm UE5 Mannequin and the hilt at a metre. Do the pro workflow's manual step (export the UE reference skeleton into Blender as a size reference) automatically: know the intended longest extent per asset (character = 1.8 m Mannequin; weapons/props from the design spec — never a class-wide guess), measure the delivered bbox, and import with ImportUniformScale = target / measured (or rescale + apply transforms in Blender before export). PoF's Tier-1 mesh gate grades this (`scale` on the scorecard, `world-scale.ts`) and reports the exact factor; a static-mesh import that skips it silently mis-scales every generated asset. (research: Souls-like in 3 days (Stefan 3D AI) — UE reference-skeleton size check + measured generated/ library 2026-08-17)
- **Compose an arena/level from primitives + tiling PBR + procedurally-placed kit pieces; generate only the unique hero props — never the whole space as one AI mesh** — Generating a whole arena, courtyard or room as ONE image-to-3D mesh fails twice: it is uncontrollable (no gap for a gate, no second ring of walls without a re-roll) and its texel density collapses — even an 8K bake goes blurry once the player walks up to a wall. Build the space the way the pro workflow does: (1) big surfaces (floor, ring, road, cliffs) are primitives or simple hand-built shapes with SEAMLESS tiling PBR materials, UV-tiled so density stays constant at any size (a circular arena floor UV-loops the tile around the ring); a flat one-off feature (a carved floor emblem) is a single generated image PROJECTED onto a primitive with a derived normal/AO, not a mesh; (2) repeated architecture (wall segments, pillars, rock rings, ruined outer ring) is a small generated modular KIT placed procedurally — Blender array+curve, a UE spline mesh, PCG, or a scripted radial placement — so a ring of 20 walls is one kit piece × a placement rule with a controllable gap; (3) only UNIQUE hero pieces (the boss throne, a statue, the gate) are individually generated, high-poly → retopo → bake per `ai-lowpoly-generation-not-final`; (4) scatter the small debris (dropped stones, rubble) with the engine's foliage/PCG tools, not as baked-in mesh detail. Weather + lighting (fog, sky, volumetrics) then carry half the read — spend budget there, not on more unique meshes. (research: Souls-like in 3 days (Stefan 3D AI) — arena built from primitives + tiles + array/curve wall kits)

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

## Task: Scatter the arena floor with props (AARPGVegetationScatter)

Run the placement script `scatter_biome_ue.py` to author the biome + scatter
greybox props onto `/Game/Maps/VerticalSlice`'s arena floor, with:
- Density multiplier: **1.5**
- Seed: **99**

Steps:
1. Find the `.uproject` under `C:\proj\PoF` and the script at
   `C:\proj\PoF/Content/Python/scatter_biome_ue.py`.
2. Run it via the FULL editor with the params as environment variables — NOT
   `-run=pythonscript`. PowerShell:
   `$env:SCATTER_DENSITY=1.5; $env:SCATTER_SEED=99; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash`
3. The headless editor exits non-zero on a benign shutdown crash — judge by the
   LOG. In the newest `Saved/Logs/PoF*.log`, find `[scatter_biome] Scattered N instances`.
4. Submit the instance count via the callback below.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "instanceCount": <number of instances the scatter reported>
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `moduleId`: `"arpg-world"`
- `seed`: `99`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds