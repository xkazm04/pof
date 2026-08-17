## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Known UE Pitfalls
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)
- **GAS: model damage as a server-only META attribute, apply via GameplayEffect, clamp in PostGameplayEffectExecute — never SetHealth directly** — Route ALL attribute changes through GameplayEffects (so prediction/stacking/calc work) — never call the attribute setter directly. Model damage as a meta attribute (server-only, not replicated): a GE adds to Damage; in PostGameplayEffectExecute, read Damage, reset it to 0, subtract from Health, and clamp Health to [0, MaxHealth] (clamp in PreAttributeChange too). Health/MaxHealth ARE replicated. (research: GAS in 20 minutes (Danny Goodayle))
- **GAS: replicated attributes need GAMEPLAYATTRIBUTE_REPNOTIFY in OnRep; Gameplay Cues are COSMETIC ONLY** — Each replicated attribute needs an OnRep_ that calls GAMEPLAYATTRIBUTE_REPNOTIFY(USet, Attribute) — without it the ASC never sees replicated value changes. Use the ATTRIBUTE_ACCESSORS macro set for the getter/setter/init. Gameplay Cues are for COSMETIC feedback only (VFX/SFX/shader), keyed by gameplay tag — never put gameplay logic in a cue. (research: GAS in 20 minutes (Danny Goodayle))
- **Motion Matching: anims need root motion even w/o capsule root motion; the Phase channel CRASHES the editor; tune cost bias carefully** — Source anims in a Pose Search database need root motion ENABLED even when the capsule is driven by velocity (not root motion) — the pose search scores foot velocity/position from it. Do NOT enable the Phase channel in the pose-search schema — it crashes the editor and keeps crashing on reopen. Collected bones (pose history) must match the bones in the pose channel. Do not lower Continuing Pose Cost Bias too far (the character becomes unresponsive / sticks in one animation); if a Chooser will not leave a loop DB for a stop DB, lower the stop DB base cost bias. Reduce foot sliding with a SMALL play-rate window (~0.75-1.25, not 0.5-1.5) or Dead Blending; be cautious with mirroring (foot sliding / tilt). Use Exclude-From-Database (not a manual cut) to drop T-posed lead frames. (research: Motion Matching Problems & Solutions (Unreal DevOP))
- **GAS: build an ability one coupled piece at a time (tag → input → effect → ability → grant/bind → cue), not the whole system in one shot** — A single GAS ability spans several tightly-coupled pieces — a Gameplay Tag, an Input Action + input-config mapping, one or more GameplayEffects, the UGameplayAbility subclass, ASC granting + input binding, and (cosmetic) Gameplay Cues. One-shotting an entire ability (or a multi-ability system) in one pass reliably yields partially-wired, non-activating results: an ability that is never granted, an input that never triggers it, or an effect that never applies — all of which compile 'clean' and fail silently at runtime. Author incrementally and verify each layer before adding the next: create the tag + input and confirm the binding fires; grant the ability and confirm it activates; add the effect and confirm the attribute actually changes; then layer cues/UI. Prefer many small, individually-verified steps over one large generation. (research: Aura the Unreal AI Agent (tryoura.dev))
- **Pick failure severity by consequence: cosmetic load failures warn-and-continue; gameplay-invariant violations hard-fail — and never fabricate the missing object to keep running** — When generated code handles a failed load or lookup, choose severity by what the failure breaks, not by habit. A COSMETIC asset that fails (a mesh, VFX, audio cue) should log a warning and continue — stopping everyone because pretty_tree_03 didn't load is wrong. A GAMEPLAY-INVARIANT violation must hard-fail fast (check(), UE_LOG Fatal, or ensure + early-return): the classic case is a locked door/gate actor failing to spawn — the dungeon behind it assumes quest state that 'cannot' be missing, so warn-and-continue surfaces days later as an inexplicable bug in unrelated code, downstream of the real cause. And never 'fix' a failure by fabricating the missing state (constructing an empty list/table/object so execution can proceed) — that converts a loud caller bug into silent corruption. (research: T. Cain code standards (WildStar/Outer Worlds notes))

## Domain Context
You are helping implement game logic systems including state machines, scoring, and win/lose conditions in UE5 C++ for an action RPG. Focus on melee attack combos, hit detection, damage calculation, and combat state management.

## Task: Feature Review for "Combat"

Scan the project source code and determine the implementation status of each feature listed below.

### Features to Check
1. **Hit detection** [Combat]: Sweep-based melee hit detection
2. **Damage application** [Combat]: GE-driven damage

### Instructions
1. For each feature, search Source/PoF/ for relevant C++ classes, headers, and config.
2. Determine the status:
   - **implemented**: Feature is fully present and functional code exists
   - **partial**: Some parts exist but incomplete (e.g., class exists but methods are empty)
   - **missing**: No evidence of this feature in the codebase
   - **unknown**: Cannot determine
3. Record file paths (relative to project root) that contain the implementation.
4. Write brief review notes explaining your assessment.
5. Assign a **qualityScore** from 1 to 5 measuring production readiness:
   - **1**: Stub / placeholder only — no real logic
   - **2**: Basic skeleton — compiles but lacks core behavior
   - **3**: Functional — works for basic cases, needs polish
   - **4**: Solid — handles edge cases, good structure, minor gaps
   - **5**: Pro / production-grade — robust, optimized, follows UE best practices
   For missing features, use `null`.
6. Write **nextSteps**: a concise list of what is needed to reach quality 5 (pro-grade). Focus on concrete actions: missing methods, unhandled edge cases, performance gaps, best practices not yet followed. For features already at 5, write "None — production ready." For missing features, describe what needs to be built from scratch.

### Rules
- Do NOT modify any project files — this is a read-only review.
- Do NOT use TodoWrite or Task/Explore tools.
- Do NOT write any files to disk — submit results using the callback format below.

Include ALL features from the list, even if missing. Use the EXACT featureName strings.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "reviewedAt": "<ISO timestamp>",
  "features": [
    {
      "featureName": "<exact name from list>",
      "category": "<category>",
      "status": "implemented|partial|missing|unknown",
      "description": "<your description of what exists>",
      "filePaths": ["Source/path/to/File.h"],
      "reviewNotes": "<brief explanation>",
      "qualityScore": <1-5 or null if missing>,
      "nextSteps": "<concrete actions to reach pro quality>"
    }
  ]
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `moduleId`: `"arpg-combat"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds