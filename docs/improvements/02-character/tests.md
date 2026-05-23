# 02 · Character — Test Coverage

## What we have

- `e2e/arpg-vertical-slice-sp-c.spec.ts` — exercises the packaging UI (not
  character-specific).
- `Source/PoF/Test/VSFunctionalTest.cpp` — the in-PIE PS-1 functional test
  that asserts player movement (#2), attack activation (#3), damage (#4),
  death + loot (#5). It now runs against the mannequin characters; the
  Characters sub-project hardened it against the `OnInterrupted` race.
- The HUD sub-project added a Gemini-vision check on a real-launch
  screenshot — re-used by the Characters sub-project to confirm humanoid
  meshes, natural pose, distinct enemy.

## Tests to add — UE side (`AFunctionalTest`s)

1. **`AVSCharacterShapeTest`** — possesses the player and the enemy; asserts
   each `GetMesh()` has a non-null `SkeletalMeshAsset` and a non-null
   `GetAnimInstance()`; asserts the relative transform is the standard
   mannequin offset `(0,0,-90)` / yaw `-90`. Detects a regression where a
   future BP edit blanks the mesh or the offset.
2. **`AVSAnimBPLocomotionTest`** — drives the player forward for ~1 s,
   reads the AnimInstance's `Speed` / `Velocity` (via reflection if the
   AnimInstance is `ABP_Manny`, or by inspecting the cached
   `UARPGAnimInstance::Speed` if a custom ABP is used), asserts `Speed > 0`
   during the move. Detects "the AnimBP loaded but doesn't react to
   movement."
3. **`AVSEnemyAttackTest`** — only valid once [[game.md]] §2+§3 land. Places
   the player adjacent to a hostile enemy, ticks for ~3 s, asserts the
   player's GAS Health dropped. Verifies the enemy-attacks-player path
   end-to-end. Until then, marked `disabled` with a clear reason.
4. **`AVSCharacterDeathPosesTest`** — drives the enemy's Health to 0,
   asserts the death montage starts playing (when [[game.md]] §1 lands —
   `AM_Death` becomes a real montage). Until then, asserts the enemy is
   destroyed within `EnemyDestroyDelay`.

Run all via:
`UnrealEditor-Cmd ... -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice;Quit" -unattended -nopause -nullrhi -log`.

## Tests to add — PoF app side

1. **`ue-known-assets` registry test** — vitest asserts each entry has a
   non-empty content path and a description; a snapshot guards against
   accidental deletion of the `MoverTests` / Mannequin paths future
   character generation depends on.
2. **`MixamoImport` watched-folder integration test** — given a fixture
   FBX placed in the import folder, mocks `UnrealEditor.exe` and asserts
   the module dispatches `-ExecutePythonScript=mixamo_pipeline.py` with the
   correct args (directory + target skeleton).
3. **AI behaviour-tree module surface test** — asserts the module's
   checklist contains an explicit "BT graphs cannot be authored from
   Python" item and a working "pure-C++ AI controller" alternative
   generator. Guards the lesson from regression.

## E2E harness extensions

1. **A `character-swap` e2e spec** in `e2e/` — drives PoF's character
   wizard end-to-end on a fresh UE project: enable `MoverTests`, run
   `setup_characters_ue.py`, take a Gemini screenshot, assert "humanoid +
   natural pose + distinct enemy." Detects regressions in the wizard, the
   Python script, or `MoverTests` plugin availability.
2. **`gemini-recognize.mjs` character-prompt template** — committed at
   `e2e/fixtures/gemini-prompts/character-check.txt` so every character
   check uses the same prompt and Gemini's response is comparable across
   runs.

## Lessons that motivate each test

- **The mannequin swap surfaced a sync `OnInterrupted` race in
  `GA_MeleeAttack`.** The character-shape + anim-locomotion tests guarantee
  the *shape* changes (mesh, AnimInstance live) that triggered the race are
  themselves verified — so a future BP edit can't silently revert.
- **`SKM_Manny_Simple` + `MI_Manny_02` was too subtle for the visual gate.**
  The Gemini-check fixture standardises the prompt so "obviously different"
  is enforced (the prompt explicitly asks "can you clearly tell them apart?").
- **`UARPGAnimInstance` is rich but unused.** The locomotion test reads the
  AnimInstance's `Speed` field if it is a `UARPGAnimInstance` — so when
  someone finally wires the custom AnimBP, the test starts asserting the
  state machine is live.
- **BTs are a known wall.** The PoF-side test for the AI module's
  acknowledgement of that wall stops a future generation pass from blindly
  generating BT-graph-dependent code that won't run.

## What this folder does *not* test

Combat-ability logic, HUD-binding, environment / arena, packaging. Those
have their own `tests.md`.
