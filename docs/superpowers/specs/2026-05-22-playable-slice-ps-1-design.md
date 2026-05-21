---
date: 2026-05-22
status: draft
sub_project: PS-1 (gray-box playable slice)
parent_initiative: PoF ARPG vertical slice — "Playable Slice" phase (PS-1 → PS-3)
predecessor_docs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-e-smoke.md
  - docs/superpowers/specs/2026-05-21-arpg-vertical-slice-sp-e-design.md
---

# Sub-project PS-1: Gray-box playable slice

## Context

SP-E established that the packaged build launches as a process but is **not a
playable game** — the project has no level, no GameMode/default-map wiring, no
Blueprints deriving from the C++ gameplay classes, and no placed actors. SP-B
generated the gameplay *systems* as C++ and SP-C packaged them, but a runnable
slice was never assembled.

The "Playable Slice" phase closes that gap. It decomposes into three
sub-projects, sequenced playable-first:

- **PS-1 (this spec)** — a **gray-box playable slice**: a runnable level with
  near-zero art (UE engine mannequin + a box-dummy enemy), and an in-engine
  test that verifies all five vertical-slice success criteria.
- **PS-2** — 3D content: Blender MCP generates real character / enemy /
  environment meshes, swapped into the slice.
- **PS-3** — 2D content: Leonardo generates textures / materials / HUD art;
  Gemini parses reference images.

PS-1 is the critical path: it is the first time SP-B's generated gameplay code
actually *runs*, and it produces the first genuinely playable, verifiable
slice. PS-2/PS-3 are content-fidelity upgrades layered onto something that
already works.

## The five vertical-slice success criteria (`INDEX.md` §1)

1. Packaged Win64 Shipping build launches as a standalone `.exe`.
2. WASD moves the character on a flat level with collisions.
3. LMB triggers the attack ability; the attack montage plays.
4. Attack hits a dummy enemy at melee range and reduces its Health attribute.
5. Enemy with Health ≤ 0 is destroyed; one loot pickup actor spawns at its
   death location.

Criterion #1 is already verified (SP-E). **PS-1 targets #2–#5.**

## Goals

1. Programmatically assemble a runnable UE level (the gray-box slice).
2. Make SP-B's generated gameplay systems actually run — the player can move,
   attack, damage and kill a dummy enemy, and see loot drop.
3. Verify criteria #2–#5 deterministically with an in-engine automation test.

## Non-goals

- **No real art.** No authored 3D models or textures — UE engine mannequin +
  primitive box dummy only. Real content is PS-2 (Blender) and PS-3 (Leonardo).
- **No PoF-UI-driven autonomy.** UE level assembly has no PoF module; PS-1 is
  controller/Claude-authored harness scripting, like SP-C and SP-E. (Driving
  this through the PoF UI is out of scope — SP-B already proved the PoF-driven
  *systems-generation* thesis.)
- **No new gameplay systems.** PS-1 assembles and wires what SP-B generated; it
  does not add gameplay features. Fixing bugs in the generated systems that
  block the slice from running is in scope (see Risks).
- **No PoF app source change.** PS-1 touches the UE project and the harness/
  docs only.

## Decision record (from brainstorming)

1. **Playable-first** — PS-1 (gray-box) before PS-2/PS-3 (content).
2. **Mannequin player + box-dummy enemy** — the player is the UE engine
   mannequin (`SK_Mannequin`) so the generated locomotion blendspace + melee
   montage are reusable and criterion #3 is genuinely verifiable; the enemy is
   a simple box dummy with a Health attribute.
3. **In-engine automation test** — criteria #2–#5 are verified by a UE
   automation/functional test asserting real game state, not external input
   simulation or fuzzy vision.
4. **A1 — UE Python authoring + a C++ functional test** — UE Python (run
   headless via `UnrealEditor-Cmd`) builds the level, actors, Blueprint, and
   config; a C++ functional test compiled into the project verifies the slice
   in PIE.

## Design

### Authoring mechanism

PS-1 authors UE content with **UE Python** scripts (the `unreal` module). UE
Python is the standard editor-automation API and can create levels, spawn and
place actors, create Blueprint assets and set their class-default properties,
create input/data assets, and edit project config. The project already runs
Python at editor startup (`Content/Python/`), so the environment is in place.

Scripts are run headless:
`UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<script.py>"`.

The scripts are authored by Claude and run by the harness/controller — no PoF
UI, no Claude-CLI dispatch.

### What PS-1 builds

**1. The level — `/Game/Maps/VerticalSlice.umap`.** A UE Python script
creates a new level containing:
- a floor (a large box / plane static mesh with collision),
- a `DirectionalLight` + a `SkyLight` (so the scene is lit, not black),
- a `PlayerStart`,
- one placed dummy enemy (see below).

**2. The player — `BP_VSPlayer`.** A Blueprint subclass of the SP-B-generated
`ARPGPlayerCharacter`, created by UE Python and configured via its
class-default object:
- `SK_Mannequin` (engine mannequin) as the skeletal mesh,
- an AnimInstance using the existing generated `BS1D_Locomotion` blendspace
  and `AM_MeleeCombo` montage (a minimal AnimBlueprint, or the project's
  `ARPGAnimInstance`, whichever the generated assets target),
- the generated `GA_MeleeAttack` ability granted via the character's GAS
  default ability set,
- an `IMC_Default` Input Mapping Context wired to the existing `IA_Move` /
  `IA_Attack` Input Actions. `IMC_Default` does not exist (operator-step ih-2
  was never run) — PS-1 creates it.

**3. The enemy — `BP_VSDummy`.** A Blueprint subclass of the generated
`ARPGCombatTestDummy` (or `ARPGEnemyCharacter` if the dummy class is not
viable), configured via UE Python:
- a box static mesh as its visible body,
- a GAS AttributeSet with a Health attribute initialised to a small value
  (so a couple of hits kill it),
- the generated `ARPGLootDropComponent`, configured to drop one
  `ARPGWorldItem` on death.

**4. Project wiring — `DefaultEngine.ini`.** UE Python (or a direct config
edit) sets:
- `GlobalDefaultGameMode` → `ARPGGameMode`,
- the GameMode's default pawn → `BP_VSPlayer`,
- `GameDefaultMap` and `EditorStartupMap` → `/Game/Maps/VerticalSlice`.

### Verification — the C++ functional test

A C++ functional test (an `AFunctionalTest`-derived actor placed in the level,
or an `FAutomationTestBase`) compiled into the project verifies criteria
#2–#5 inside PIE. It is run headless:
`UnrealEditor-Cmd.exe <uproject> -ExecCmds="Automation RunTests <TestName>;Quit" -unattended -nullrhi`.

The test:
- **#2 movement** — possesses the player, injects a movement input for N
  frames, asserts the pawn's world location changed by more than a threshold.
- **#3 attack** — triggers the `IA_Attack` action / activates `GA_MeleeAttack`,
  asserts the ability activated and the melee montage is playing on the mesh.
- **#4 damage** — positions the player in melee range of the dummy, performs an
  attack, asserts the dummy's Health attribute decreased.
- **#5 death + loot** — drives the dummy's Health to ≤ 0, asserts the enemy
  actor is destroyed and exactly one `ARPGWorldItem` (or loot pickup actor)
  exists in the world near the death location.

A Gemini-vision screenshot of a PIE frame is captured as a **secondary visual
sanity check** (e.g. "a character stands on a lit floor with a box enemy") —
it informs the findings, it does not gate the result.

### Iteration target: PIE, not the packaged build

PS-1 verifies in PIE (the editor) — fast iteration, and where the automation
framework runs natively. The packaged-build path is SP-E's smoke-test; PS-1
does not re-cook per iteration. (A future step may run the slice in a packaged
build, but that is not PS-1's gate.)

## Verification (of PS-1 itself)

- The UE Python authoring scripts run without error and produce the
  `.umap` / Blueprint / `IMC_Default` assets and the config edits.
- `UnrealEditor-Cmd` runs the C++ functional test headless; PS-1 passes when
  the test reports all of #2–#5 green.
- A findings doc records the result, the Gemini sanity-check, and any bugs
  found in SP-B's generated systems (with their fixes).

## Cross-cutting

- **Branch:** `master` (PoF repo). The UE project is not under git.
- **The UE project is edited irreversibly** — new map, Blueprints, input asset,
  a C++ functional test class, and `DefaultEngine.ini` changes. Consistent with
  SP-C's irreversible UE edits.
- **New C++ in the UE project** (the functional test) means a UE project
  rebuild — fast and already proven (SP-C).
- Commit locally only — the user pushes manually.
- PS-1 does not depend on the Claude CLI or the PoF dev server — only the UE
  toolchain and (for the sanity check) the Gemini API key.

## Definition of done

1. UE Python authoring scripts created and run; the `VerticalSlice` map,
   `BP_VSPlayer`, `BP_VSDummy`, `IMC_Default`, and the project-config wiring
   exist.
2. The C++ functional test created, compiled, and run headless.
3. Criteria #2–#5 verified green by the functional test. Any blocking bug in
   SP-B's generated systems found along the way is fixed and recorded.
4. A findings doc records the outcome (test results, the Gemini sanity-check,
   bugs + fixes) under `docs/features/arpg-vertical-slice/scenario-runs/`.
5. Committed to `master`; chat summary.

**Success criterion:** the gray-box slice runs in PIE and a deterministic
in-engine test confirms WASD movement, attack + montage, enemy damage, and
enemy death + loot drop — a genuinely playable, verifiable vertical slice
(criteria #2–#5), ready for PS-2/PS-3 to dress with real content.

## Risks & mitigations

- **SP-B's generated gameplay C++ has never run.** It compiles (SP-C), but GAS
  ability-granting, the loot-drop component, the attack/damage flow, and input
  binding have never executed. PS-1 will likely surface logic bugs. Mitigation:
  this is expected and in scope — PS-1 fixes blocking bugs in the generated
  systems and records them; it is the point of the sub-project, not a detour.
- **Animation-asset skeleton mismatch.** The generated `BS1D_Locomotion` /
  `AM_MeleeCombo` target some skeleton; if it is not the UE mannequin's, a
  retarget is needed (the project has Mixamo-retarget Python). Confirmed at
  plan time; if a retarget is required it is a planned step.
- **UE Python cannot do everything from a script.** Some asset wiring (e.g.
  AnimBlueprint graph authoring) is hard to script. Mitigation: keep the
  gray-box minimal — prefer the simplest AnimInstance that drives locomotion +
  the montage; if a piece genuinely cannot be scripted, fall back to a small
  C++ class default or a one-time editor action, recorded as a finding.
- **Headless automation + PIE quirks.** Running PIE under `-unattended -nullrhi`
  can behave differently from interactive PIE. Mitigation: if `-nullrhi` breaks
  the test, run with a real RHI windowed; the test asserts game state, not
  pixels.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: UE Python authoring → C++ functional test → run + verify → findings.
5. PS-1 complete → PS-2 (Blender 3D content) is the next brainstorm.
