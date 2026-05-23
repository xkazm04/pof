# 02 · Character — PoF App Improvements

## Goals

Make PoF capable of driving end-to-end character creation — not just
generating C++ classes — including the asset-side work (mesh source, skeleton
choice, AnimBP wiring, AI behaviour tree) that the Characters sub-project
had to do controller-driven.

## Improvements

### 1. A "character source" module / wizard

`src/components/modules/core-engine/arpg-character/` currently surfaces a
checklist for C++ character class creation. Extend it (or add a sibling
`arpg-character-content` module) that:

- Knows the three documented sources for a rigged character: **UE Mannequin**
  (free, no download — engine plugin), **Mixamo** (manual download, library
  of attack/locomotion anims), **Custom (Blender)** (procedural, hardest).
- Surfaces a 3-step wizard: source → mesh + skeleton + AnimBP wiring →
  verification. Each step is a discrete dispatch (consistent with the
  single-dispatch lesson from SP-B).
- Calls the existing `setup_characters_ue.py` (refactored into a reusable
  Python module shipped with PoF) for the wiring step.

### 2. A registry of "ready-made" UE assets PoF knows about

A new `src/lib/ue-known-assets.ts` exports a structured list:
- `MoverTests` plugin: `SKM_Manny`, `SKM_Manny_Simple`, `SK_Mannequin`,
  `ABP_Manny`, `M_Mannequin`, `MI_Manny_01/02` with their full
  `/MoverTests/...` paths and a short description per asset.
- Third-Person template (if migrated): `SKM_Manny`/`SKM_Quinn` + the
  `ACharacter`-based `ABP_Manny`/`ABP_Quinn` (noted as the *fallback* if
  `MoverTests`'s ABP turns out to be Mover-coupled in some future task).
- Mannequin material instances (`MI_Manny_01`, `MI_Manny_02`) — flagged as
  "too subtle for visual distinction" with `M_EnemyRed` as the documented
  alternative for a clearly-distinct enemy.

A prompt builder for character generation reads from this registry instead
of asking Claude to invent paths. (See [[01-generation-quality/pof-app.md]]
for the Pass-0 ground-truth pattern this rides on.)

### 3. Mixamo workflow surfaced in the app

The UE project's `Content/Python/mixamo_*.py` pipeline is complete but
editor-interactive. Add a thin PoF module under
`src/components/modules/content/animations/MixamoImport.tsx`:
- Tells the user the manual download steps (mixamo.com login, the FBX
  format / `mixamorig_` prefix, "with skin / without skin" choices).
- Once the user drops FBXs into a watched folder
  (`Documents/Unreal Projects/PoF/MixamoIncoming/` or similar — config-driven),
  PoF launches `UnrealEditor.exe -ExecutePythonScript=mixamo_pipeline.py`
  with the import directory + target skeleton (default `SK_Mannequin`).
- Reports progress (the existing pipeline's `unreal.ScopedSlowTask`
  surfacing via a log tail).

### 4. An "AI behaviour tree" module — knowing the wall

`AARPGEnemyCharacter` has AI scaffolding (BT host, EQS contexts, BT
tasks/services) but **Behaviour Tree assets are binary** — same wall as
UMG/AnimBP. The `src/components/modules/game-systems/ai-behavior/` module
should:
- Acknowledge the wall in its checklist: "Behaviour Tree graphs cannot be
  authored from Python. PoF generates BTTasks/BTServices/BTDecorators (the
  C++ leaf nodes); the BT graph itself is editor-authored."
- Provide a generator for **a pure-C++ AI controller** as the alternative —
  an `AARPGSimpleAIController : AAIController` that does follow-target +
  attack-on-range in `Tick`, no BT. For a vertical slice or a simple enemy,
  this sidesteps the BT-graph wall entirely.

### 5. Enemy-distinction defaults in the slice spec

PS-1's enemy was `BP_VSEnemy`. The Characters sub-project found `MI_Manny_02`
was too subtle and switched to `M_EnemyRed`. Bake this lesson: the character
module's "create enemy variant" flow defaults to a strongly-contrasting
material (red / blue / green choices), not a mannequin MI.

### 6. A "verify character locomotes" step in the module

Single-dispatch — after a character is wired, PoF launches the game window,
takes a screenshot, and runs Gemini-vision (the
`personas/.claude/skills/leonardo/tools/gemini-recognize.mjs` integration)
asking "is the character a humanoid in a natural pose, not T-posed?"
Reports the verdict. This is the gate that caught the `ABP_Manny`-coupling
risk in the Characters sub-project — promote it to a standard step.

## Verification this work succeeded

- A fresh PoF run on a clean UE project produces a working slice character
  (mannequin + ABP_Manny + red enemy) via the wizard, single-dispatch per
  step, with the Gemini gate confirming the result.
- The Mixamo module successfully imports one downloaded FBX + retargets +
  the new animation is bound to a montage and plays in PIE.
- A pure-C++ `AARPGSimpleAIController` is generatable from the AI module
  without BT-graph authoring; the enemy moves toward the player and
  attacks on contact.
