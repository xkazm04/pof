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

Criterion #1 is already verified (SP-E). **PS-1 targets #2–#5**, with #3
scoped to ability activation — the "montage plays" visual is deferred to PS-2,
since no real attack animation exists in the project.

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
2. **Primitive player + box enemy** — a UE-project inventory (2026-05-22)
   established that the project has **no skeleton, no skeletal mesh, and no real
   animation data** — the generated `BS*_Locomotion` / `AM_MeleeCombo` assets
   are empty commandlet-generated shells, and no `SK_Mannequin` exists. So the
   gray-box player is a capsule with an engine primitive static-mesh body, and
   the enemy is a box. Character visuals and animation are deferred to PS-2
   (Blender). Criterion #3 is verified at the **ability-activation** level, not
   the montage-animation level (see the design and the criteria table).
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

### Wiring gaps PS-1 must close

The inventory found SP-B's generated code has gaps that block a runnable slice
(the code compiles but was never wired into anything). Closing these is PS-1
scope:

- **The player ASC is never granted any ability.** `GA_MeleeAttack` is
  activated by gameplay tag, but no code grants it to the player. PS-1 adds a
  minimal grant path — preferred: a small C++ `DefaultAbilities`
  (`TArray<TSubclassOf<UGameplayAbility>>`) UPROPERTY on `ARPGCharacterBase`
  granted on possession, so it can be populated from a Blueprint CDO via
  Python (authoring Blueprint event graphs from Python is not practical).
- **Enhanced Input lives on `ARPGPlayerController`, not the character.** PS-1
  creates a `BP_VSPlayerController` with the `DefaultMappingContext` and the
  `IA_Move` / `IA_PrimaryAttack` action properties assigned.
- **No Input Mapping Context exists.** PS-1 creates an `IMC` asset mapping
  WASD → `IA_Move` and LMB → `IA_Attack`.
- **`GA_MeleeAttack` self-disables** unless `AttackMontage` is non-null and
  `ComboSectionNames` is non-empty. PS-1 configures a `BP_GA_MeleeAttack` with
  the (empty-shell) `AM_MeleeCombo` as a non-null montage, a section name, and
  a `DamageEffect` GameplayEffect — enough to pass `CanActivateAbility` and
  apply damage. Plan Task 1 confirms whether damage application is gated on a
  montage notify (which the empty shell lacks); if so, that gating is the bug
  to fix.
- **Loot auto-drop only fires for `AARPGEnemyCharacter`** (the loot component
  binds that class's `OnEnemyDeath` delegate). PS-1's enemy is therefore
  `AARPGEnemyCharacter` (visually a box), not `ARPGCombatTestDummy`.

### What PS-1 builds

**1. The level — `/Game/Maps/VerticalSlice.umap`.** A UE Python script
creates a new level containing:
- a floor (a large box / plane static mesh with collision),
- a `DirectionalLight` + a `SkyLight` (so the scene is lit, not black),
- a `PlayerStart`,
- one placed enemy (see below).

**2. The player — `BP_VSPlayer`.** A Blueprint subclass of the SP-B-generated
`ARPGPlayerCharacter`, created by UE Python and configured via its
class-default object:
- an engine primitive static mesh (e.g. `/Engine/BasicShapes/Cylinder`) as a
  visible body attached to the character, so it is not invisible. No skeletal
  mesh, no AnimInstance — character animation is deferred to PS-2.
- `GA_MeleeAttack` (configured via `BP_GA_MeleeAttack`) listed in the new
  `DefaultAbilities` array so it is granted on possession,
- the attribute-init data the character base expects (`AttributeInitTable` /
  row name) so GAS attributes initialise.

**3. The player controller — `BP_VSPlayerController`.** A Blueprint subclass of
`ARPGPlayerController` with `DefaultMappingContext` → the new `IMC`,
`IA_Move` → `IA_Move`, and `IA_PrimaryAttack` → `IA_Attack`.

**4. The enemy — `BP_VSEnemy`.** A Blueprint subclass of `AARPGEnemyCharacter`,
created by UE Python:
- an engine box static mesh (`/Engine/BasicShapes/Cube`) as its visible body,
- the attribute-init data so its GAS `Health` initialises to a small value
  (so a couple of hits kill it),
- its `LootDropComponent` configured with a minimal loot output (a loot table
  or gold drop), `bSliceMode` / `bAutoDropOnDeath` left on, so killing it
  drops a self-cleaning `ARPGWorldItem`.

**5. Project wiring.** A `BP_VSGameMode` (subclass of `ARPGGameMode`) with
`DefaultPawnClass` → `BP_VSPlayer` and `PlayerControllerClass` →
`BP_VSPlayerController`; and `DefaultEngine.ini` set so `GlobalDefaultGameMode`
→ `BP_VSGameMode` and `GameDefaultMap` / `EditorStartupMap` →
`/Game/Maps/VerticalSlice`.

### Verification — the C++ functional test

A C++ functional test (an `AFunctionalTest`-derived actor placed in the level,
or an `FAutomationTestBase`) compiled into the project verifies criteria
#2–#5 inside PIE. It is run headless:
`UnrealEditor-Cmd.exe <uproject> -ExecCmds="Automation RunTests <TestName>;Quit" -unattended -nullrhi`.

The test:
- **#2 movement** — possesses the player, injects a movement input for N
  frames, asserts the pawn's world location changed by more than a threshold.
- **#3 attack** — activates `GA_MeleeAttack` (by tag, as the input path does),
  asserts the ability **successfully activated** — entered, not rejected by
  `CanActivateAbility`. The "montage plays" visual is *not* asserted; no real
  attack animation exists, so #3 is scoped to ability activation.
- **#4 damage** — positions the player in melee range of the enemy, performs an
  attack, asserts the enemy's GAS `Health` attribute decreased.
- **#5 death + loot** — drives the enemy's `Health` to ≤ 0, asserts the enemy
  actor is destroyed and a loot actor (`ARPGWorldItem`) spawned near the death
  location.

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
  `.umap`, the Blueprints, the `IMC` and the config edits.
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
   `BP_VSPlayer`, `BP_VSPlayerController`, `BP_VSEnemy`, `BP_VSGameMode`,
   `BP_GA_MeleeAttack`, the `IMC`, and the project-config wiring exist.
2. The C++ functional test created, compiled, and run headless.
3. Criteria #2–#5 verified green by the functional test. Any blocking bug in
   SP-B's generated systems found along the way is fixed and recorded.
4. A findings doc records the outcome (test results, the Gemini sanity-check,
   bugs + fixes) under `docs/features/arpg-vertical-slice/scenario-runs/`.
5. Committed to `master`; chat summary.

**Success criterion:** the gray-box slice runs in PIE and a deterministic
in-engine test confirms WASD movement, attack-ability activation, enemy
damage, and enemy death + loot drop — a genuinely playable, verifiable
vertical slice (criteria #2–#5, #3 at the ability-activation level), ready for
PS-2/PS-3 to dress with real content and animation.

## Risks & mitigations

- **SP-B's generated gameplay C++ has never run.** It compiles (SP-C), but it
  was never wired into anything runnable — the inventory already found four
  concrete gaps (no ability granted to the player, input on the controller not
  the character, no `IMC`, the loot delegate bound only to `AARPGEnemyCharacter`)
  and PS-1 will likely surface more logic bugs once it runs. Mitigation: this
  is expected and in scope — PS-1 closes the known gaps and fixes blocking bugs
  it finds, recording each; it is the point of the sub-project, not a detour.
- **`GA_MeleeAttack` damage may be gated on a montage notify.** `AM_MeleeCombo`
  is an empty shell with no notifies. If the ability applies its damage GE from
  a hit-window AnimNotify rather than on activation, criterion #4 fails until
  that path is fixed. Mitigation: plan Task 1 reads `GA_MeleeAttack.cpp` to
  determine the damage path; if notify-gated, PS-1 adds a direct damage
  application (or a minimal notify) as a recorded wiring fix.
- **UE Python cannot do everything from a script.** Some Blueprint wiring (e.g.
  event-graph logic) is not practical to author from Python. Mitigation: PS-1
  is designed around CDO-property configuration only — the `DefaultAbilities`
  C++ array exists precisely so ability-granting is a CDO array set, not graph
  authoring. If a piece genuinely cannot be scripted, fall back to a small C++
  class default, recorded as a finding.
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
