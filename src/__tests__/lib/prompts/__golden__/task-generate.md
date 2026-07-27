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
- **verify unreal.* API names by introspection before calling — never guess** — Guessed unreal.* class/method/property names fail silently (return None/false) or crash the pythonscript commandlet, and each wrong guess burns tokens on retries. Before calling an unfamiliar API, confirm it exists and check its signature: use mcp-unreal lookup_class / lookup_docs / subsystem_query, or `dir(unreal.X)`, `help(unreal.X.method)`, and `unreal.X.__doc__` inside execute_script. Prefer EditorSubsystem getters (unreal.get_editor_subsystem(...)) over deprecated global helpers. (research: Claude-in-UE5 demo (Stefan 3D AI) + VibeUE introspection)

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
- **/Script/PoF.ARPGItemDefinition** (C++ Class (UARPGItemDefinition), project) — Base data-asset class for items — author instances under /Game/Items/.

You are a senior systems designer at a AAA action-RPG studio producing a shippable asset for the
items catalog. The professional bar is: the design-doc craft of Path of Exile 2 / Diablo IV / Last Epoch systems writing.
This will be reviewed against these exact craft dimensions — meet the professional bar on each:
  - coherence: internally consistent and consistent with sibling steps — no contradictions, no invented references
  - specificity: concrete, numeric, named — zero filler or generic-fantasy boilerplate
  - voice: a distinctive, confident design voice; reads like a senior designer wrote it, not a template
  - completeness: every field a real implementation would need is present and load-bearing
  - plausibility: the values would actually ship — balanced, buildable, grounded in the ARPG laws
Hard constraints:
  - no filler or generic-fantasy boilerplate
  - no placeholder/TODO values
  - no contradictions with sibling steps
Author it as a STRUCTURED design doc, not a prose blurb — every field load-bearing. To reach the bar:
  - Single source of truth: every number appears once; derive dependent values with the arithmetic SHOWN
    (a worked chain a reader can reproduce on a calculator). Forward-derive headline numbers from primitives —
    never reverse-engineer a figure to hit a target (the judge catches contradictions with your own inputs).
  - Sibling-sourced: cross-reference the entity's OTHER steps by their real values (ids, prices, stats, labels);
    contradicting a sibling is an automatic coherence failure. Add a crossReferences / statHooks block.
  - Prove hard cases INLINE, don't assert them (worked math, ICU plural/gender arms, edge cases, state machines).
  - Scope depth to the subject: a baseline Common is scoped DOWN (it's the zero-point), a boss scoped up.
  - Disclose your own discontinuities/edge cases precisely — that scores higher than claiming false airtightness.
  - Refuse vaporware: author real inline content, not promissory "TBD"/catalog-link stubs.
  - Declarative voice. NO meta-commentary defending your numbers; NO raw engine tokens/enums leaking into prose.
Aim for work that could ship as-is in the reference games — not merely technically correct.

## Domain Context
UARPGItemDefinition data-asset authoring for the PoF ARPG.

## Task: Items · author-python

Author a UARPGItemDefinition data asset for "Rusty Sword" from its spec.

## Asset Specification

- **id**: `itm-rusty-sword`
- **name**: Rusty Sword
- **category**: Weapons ▸ Swords
- **tags**: common, starter

```json
{
  "itemType": "weapon",
  "rarity": "common",
  "damage": 5
}
```

## UE5 Best Practices
- Author a `UARPGItemDefinition` data asset (Python, FULL editor via -ExecutePythonScript), not -run=pythonscript.
- Set the item type/rarity/stats from the Asset Specification; do not invent new fields.
- Place the asset under `/Game/Items/` and report its content path.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "ueAssets": ["<UE asset path(s) you created/modified>"],
  "testResult": "pass|fail"  // only required for the verify step
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `action`: `"transition"`
- `catalogId`: `"items"`
- `entityId`: `"itm-rusty-sword"`
- `nextLifecycle`: `"generated"`
- `promptVersion`: `"q1"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds