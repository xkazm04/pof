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
- **Behaviour Trees are binary content** — BT graphs cannot be authored from Python (same wall as UMG/AnimBP). PoF generates the C++ leaf nodes (BTTask/BTService/BTDecorator); the BT graph itself is editor-authored. For a vertical slice or a simple enemy, prefer the pure-C++ AI controller below.
- **AI is Claude's strength** — AI behavior trees and logic are purely code-driven, making this one of the strongest modules for AI assistance.

## Task: Generate Mock Stimuli from Scenario Description

Target AI class: **AARPGEnemyAIController**

### Scenario (natural language):
The player sprints past the guard at 10 metres.

### Instructions:
Parse the scenario and produce:
1. A list of `MockStimulus` objects (JSON) with the following structure:
   ```json
   {
     "id": "unique-id",
     "type": "perception_sight" | "perception_hearing" | "perception_damage" | "damage_event" | "gameplay_tag" | "custom",
     "label": "short human-readable label",
     "description": "what this stimulus does in the game world",
     "params": { "key": "value" }
   }
   ```
2. A list of `ExpectedAction` objects (JSON):
   ```json
   {
     "id": "unique-id",
     "action": "what the BT should do",
     "btNode": "specific BT node name if known, or empty string",
     "timeoutSeconds": 5
   }
   ```

Produce the two arrays as `{ "stimuli": [...], "expectedActions": [...] }` and submit them via the callback block below — that is how they reach the scenario editor.
Do NOT use TodoWrite.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "stimuli": [ { "id": "<unique-id>", "type": "<stimulus type>", "label": "<label>", "description": "<what it does>", "params": {} } ],
  "expectedActions": [ { "id": "<unique-id>", "action": "<what the BT should do>", "btNode": "", "timeoutSeconds": 5 } ]
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `action`: `"apply-stimuli"`
- `scenarioId`: `1`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds