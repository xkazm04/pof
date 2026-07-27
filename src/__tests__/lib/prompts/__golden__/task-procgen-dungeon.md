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

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

## Task: Generate a procedural dungeon with ARPGLevelGenerator

Run the existing placement script `build_procgen_dungeon.py` to bake a fresh
multi-room dungeon into `/Game/Maps/ProcGenDungeon` with these parameters:
- Room count: **8**
- Seed: **1234**

Steps:
1. Find the `.uproject` under `C:\proj\PoF` and the script at
   `C:\proj\PoF/Content/Python/build_procgen_dungeon.py`.
2. Run it via the FULL editor with the params as environment variables — NOT
   `-run=pythonscript`. PowerShell:
   `$env:PROCGEN_ROOMS=8; $env:PROCGEN_SEED=1234; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash`
3. The headless editor exits non-zero on a benign shutdown crash — judge success
   by the LOG, not the exit code. In the newest `Saved/Logs/PoF*.log`, find the
   line `[LevelGenerator] ... Generated N rooms` and `Baked N BlockoutRoom actors`.
4. Submit the generated room count via the callback below.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "roomCount": <number of rooms the generator reported>
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `moduleId`: `"arpg-world"`
- `seed`: `1234`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds