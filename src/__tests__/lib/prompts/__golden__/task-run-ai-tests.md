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
- **Behaviour Trees are binary content** — BT graphs cannot be authored from Python (same wall as UMG/AnimBP). PoF generates the C++ leaf nodes (BTTask/BTService/BTDecorator); the BT graph itself is editor-authored. For a vertical slice or a simple enemy, prefer the pure-C++ AI controller below.
- **AI is Claude's strength** — AI behavior trees and logic are purely code-driven, making this one of the strongest modules for AI assistance.

## Task: Run AI Behavior Tests

Run the automation tests for suite "Skeleton Aggro Suite" targeting class **AARPGEnemyAIController**.

### Scenarios in this suite
- scenarioId 1: Sees player at 50m

### Steps:
1. Build the project in Test configuration (or Editor if Test is not configured)
2. Run the automation tests with:
   ```
   UnrealEditor-Cmd.exe <ProjectPath> -ExecCmds="Automation RunTests AI.BehaviorTests.AARPGEnemyAIController" -Unattended -NoPause -NullRHI -Log
   ```
3. Parse the test output log for pass/fail results
4. Submit a result for EVERY scenarioId listed above via the callback block below — status "passed" or "failed" (with the failure reason in "output"), or "error" if the test could not run.

If the test file doesn't exist yet, say so, suggest generating tests first, and submit every scenario as "error" with output "test file missing".
Do NOT use TodoWrite.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "results": [
    { "scenarioId": <id from the scenario list>, "status": "passed|failed|error", "output": "<pass summary or failure reason>" }
  ]
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `action`: `"record-run-results"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds