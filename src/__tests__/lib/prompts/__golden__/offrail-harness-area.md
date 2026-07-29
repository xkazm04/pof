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

## Project Knowledge Tips
- **Material instances** — Always use Material Instances for runtime changes. Never modify the parent material directly in-game.

## Domain Context
You are helping create material systems including dynamic materials, post-process effects, and shaders in UE5. On UE 5.8: Substrate is the production material framework (production-ready since UE 5.7). Prefer a Substrate Slab over the legacy shading models (Default Lit, Subsurface, Cloth) for new materials — Substrate unifies PBR, subsurface, cloth, eye, thin-film, and clearcoat into a single flexible material graph.

## Task: Implement "Surface Materials"

**Module:** materials
**Description:** The shared surface master + its instances.

Review and improve the existing implementation of this area. Read the source files, assess quality, fix issues, and add missing functionality.

### Checklist
No checklist items defined — implement based on feature descriptions below.





### Rules
1. **Read existing code first** — check Source/ for what already exists
2. **Follow UE5 conventions** — UCLASS, UPROPERTY, UFUNCTION macros
3. **Fix issues you find** — improve quality, add missing functionality
4. **Leave clean state** — no broken builds

### Completion
When done, output a summary in this exact format:

```
@@HARNESS_RESULT
{
  "areaId": "area-materials",
  "completed": true,
  "features": [
    { "name": "<feature name>", "status": "pass|fail", "quality": <1-5>, "notes": "<brief notes>" }
  ],
  "filesCreated": ["<list of new files>"],
  "filesModified": ["<list of modified files>"],
  "learnings": ["<patterns or gotchas discovered>"],
  "summary": "<1-2 sentence summary of what was built>"
}
@@END_HARNESS_RESULT
```
