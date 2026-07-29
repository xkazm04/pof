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
- This is an EVALUATION task — do NOT modify any files.
- Read source files to analyze them, then output your findings.
- Do NOT use TodoWrite.

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

You are evaluating the "materials" module of UE5 project "PoF".

## Focus Area
Master materials, material instances, Substrate shading (5.7+), material functions, post-process

## Evaluation Pass: Quality
Analyze UE5 best practices, coding conventions, correctness, and anti-patterns. Is the code following Unreal conventions? Are there bugs, incorrect usage, or missed edge cases?

## What to Check
- Dynamic material instances should use UMaterialInstanceDynamic, not direct material edits
- TSoftObjectPtr for base material references (async loading)
- Substrate: unified material graph replaces separate Default Lit/Subsurface/Cloth shading models
- Texture parameters should have sensible defaults
- Material complexity should be monitored (instruction count)

## Instructions
1. Read the source files under Source/PoF/ relevant to this module
2. Analyze against the checks listed above
3. For each issue found, note the specific file and line number
4. Rate severity based on impact: critical (crashes/data loss), high (incorrect behavior), medium (suboptimal), low (style/convention)
5. Estimate fix effort: trivial (< 5 min), small (< 30 min), medium (< 2 hours), large (> 2 hours)

Output ONLY a JSON array of findings. Each finding:
{
  "category": "string — the area of concern",
  "severity": "critical" | "high" | "medium" | "low",
  "file": "relative path from Source/ (or null if general)",
  "line": number | null,
  "description": "what the issue is",
  "suggestedFix": "specific fix description",
  "effort": "trivial" | "small" | "medium" | "large"
}

Rules:
- Output ONLY the JSON array, no markdown, no explanation
- If no findings, output: []
- Be specific about file paths and line numbers when possible
- suggestedFix should be actionable — say exactly what to change