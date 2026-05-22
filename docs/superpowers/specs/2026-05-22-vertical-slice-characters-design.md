---
date: 2026-05-22
status: draft
sub_project: Characters (vertical-slice real character meshes)
parent_initiative: PoF ARPG vertical slice
predecessor_docs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-hud.md
  - docs/superpowers/specs/2026-05-22-vertical-slice-hud-design.md
---

# Sub-project: Vertical-slice real character meshes

## Context

The ARPG vertical slice is playable, in a textured arena, with a HUD — but the
player and enemy are still **primitive gray-box meshes** (a cylinder and a box,
attached by PS-1). This is the last sub-project: give them real, animated
humanoid characters.

A character inventory (2026-05-22) established:

- The character C++ (`AARPGPlayerCharacter` / `AARPGEnemyCharacter` /
  `AARPGCharacterBase`) **expects the skeletal mesh and AnimClass set
  per-Blueprint** — nothing in C++ assigns them, and the ragdoll/re-attach code
  already hardcodes the standard mannequin offset. No C++ change is needed.
- The gray-box body is a **separate `StaticMeshComponent`** PS-1 added to each
  Blueprint — not a replacement of the inherited skeletal mesh. To use a real
  character: delete that primitive component, set the inherited `Mesh`.
- `UARPGAnimInstance` is a rich data-provider but **needs a companion Animation
  Blueprint** — and an AnimBP is a binary asset that cannot be authored from
  Python (the same wall as UMG widgets).
- **The UE Mannequin is available with no download:** UE 5.7 ships
  `SKM_Manny`, `SK_Mannequin`, and a ready-made Animation Blueprint
  **`ABP_Manny`** (idle / walk / jog / run) in the experimental `MoverTests`
  engine plugin (`<Engine>/Plugins/Experimental/MoverTests/Content/Characters/
  Mannequins/`). Using `ABP_Manny` sidesteps the AnimBP-authoring wall — it is
  already built.
- The project's `AM_MeleeCombo` montage is an empty shell with no skeleton; no
  real animation data exists in the project.

## Goals

1. The player and enemy are real, animated humanoid characters (the UE
   Mannequin) instead of a cylinder and a box.
2. They animate — idle / walk / run — via the ready-made `ABP_Manny`.
3. Player and enemy are visually distinct.
4. The slice still plays — the PS-1 functional test stays green.

## Non-goals

- **No custom Animation Blueprint, no use of `UARPGAnimInstance`.** `ABP_Manny`
  drives locomotion; the project's combat-anim system is not wired in (that was
  the rejected high-effort option). `UARPGAnimInstance` and the project's
  AnimNotify classes remain for a future AnimBP-editor pass.
- **No real attack animation.** `AM_MeleeCombo` stays an empty shell; the melee
  attack activates and damages as before but plays no swing animation. (A real
  attack animation was the deferred Mixamo option, not chosen.)
- **No Mixamo, no Blender, no downloads.** The mannequin comes from the engine
  plugin.
- **No C++ change, no gameplay change, no PoF app source change.**
- **No new geometry / level / texture work** — this sub-project is the
  characters only.

## Decision record (from brainstorming)

1. **Source = UE Mannequin + `ABP_Manny`** (chosen over Mixamo attack
   animations and over a custom ARPG AnimBP). De-risked, fully autonomous, no
   downloads, no AnimBP authoring; the attack-animation gap is accepted.
2. **A1 — enable the `MoverTests` plugin and reference its mannequin assets in
   place** (chosen over A2, migrating the assets into `/Game/`). Simplest; the
   project depends on an Epic-shipped experimental plugin.

## Design

### Part 1 — enable the mannequin content

Add the `MoverTests` plugin to `PoF.uproject`'s `Plugins` list (`"Name":
"MoverTests", "Enabled": true`). It ships prebuilt with UE 5.7 — enabling it
needs no project rebuild. Its content (`SKM_Manny`, `SK_Mannequin`,
`ABP_Manny`, the locomotion blend spaces and animations) becomes referenceable
under the `/MoverTests/` mount.

The exact in-plugin asset paths are confirmed at plan time by listing
`<Engine>/Plugins/Experimental/MoverTests/Content/Characters/Mannequins/` —
expected: `Meshes/SKM_Manny`, `Meshes/SK_Mannequin`, an `ABP_Manny`.

### Part 2 — wire the characters (UE Python)

A UE Python script `<UE>/Content/Python/setup_characters_ue.py` updates the two
slice Blueprints (`/Game/VerticalSlice/BP_VSPlayer`, `BP_VSEnemy`):

- **Remove the gray-box body** — via `SubobjectDataSubsystem`, find and delete
  the `StaticMeshComponent` PS-1 added (the cylinder/cube body).
- **Set the inherited `Mesh`** (the `ACharacter` skeletal-mesh component): set
  its `SkeletalMeshAsset` to `SKM_Manny`, its `AnimClass` to `ABP_Manny`, and
  its relative transform to the standard mannequin offset — location
  `(0, 0, -90)`, rotation yaw `-90` — so the character stands correctly inside
  the capsule (this matches the offset the C++ ragdoll code already uses).
- **Distinguish the enemy** — apply a red-tinted material (a `MaterialInstance`
  of the mannequin material, or a simple override) to `BP_VSEnemy`'s mesh so
  the player and enemy read as different at a glance. If the plugin also
  provides `SKM_Quinn`, using Quinn for the enemy is an acceptable alternative.
- Save both Blueprints.

`SM_Arena`, the level, the HUD, and all gameplay assets are untouched.

### Part 3 — no C++ build

No C++ changes. `MoverTests` is an engine plugin (prebuilt). The only project
artifacts are the `.uproject` edit and the Python script.

### Part 4 — verify

- **Gameplay intact:** re-run the PS-1 functional test
  (`Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`) — #2–#5 must
  still pass. The capsule still drives movement and collision; the skeletal
  mesh is visual. (The empty `AM_MeleeCombo` is unchanged — PS-1's
  `GA_MeleeAttack` fallback already handles a non-playable montage, so #3/#4
  still pass.)
- **Visual check (the real gate):** launch the slice in a real window, capture
  a screenshot, and have Gemini confirm the player and enemy are now humanoid
  characters (not a cylinder and a box), standing in a natural pose, visually
  distinct from each other.

## Verification (of this sub-project)

Passes when: `MoverTests` is enabled; `BP_VSPlayer` and `BP_VSEnemy` use the
mannequin skeletal mesh + `ABP_Manny` with the gray-box bodies removed; the
PS-1 functional test re-runs green; and a real-launch screenshot (Gemini-
confirmed) shows two distinct humanoid characters.

## Cross-cutting

- **Repos:** the `.uproject` edit + the Python script commit to the UE repo
  (`github.com/xkazm04/pof-exp`); the spec, plan, and findings doc to the PoF
  app repo.
- **Controller-driven** — Claude authors the script; the harness runs it. No
  PoF dev server, no Claude CLI.
- The UE project is edited irreversibly (the `.uproject` and the two BPs).

## Definition of done

1. `MoverTests` enabled in `PoF.uproject`.
2. `setup_characters_ue.py` created and run; `BP_VSPlayer` / `BP_VSEnemy` use
   the mannequin skeletal mesh + `ABP_Manny`, gray-box bodies removed, enemy
   visually distinct.
3. The PS-1 functional test re-runs green (#2–#5).
4. A real-launch screenshot, Gemini-confirmed, shows two distinct humanoid
   characters.
5. A findings doc under `docs/features/arpg-vertical-slice/scenario-runs/`.
6. `.uproject` + script committed to the UE repo; spec/plan/findings to the app
   repo; chat summary.

**Success criterion:** the vertical slice's player and enemy are real, animated
humanoid characters — completing the visual build-out of the slice (gameplay →
arena → textures → HUD → characters).

## Risks & mitigations

- **`MoverTests`' `ABP_Manny` may be coupled to the Mover component** rather
  than a plain `CharacterMovementComponent`. If it does not animate a standard
  `ACharacter` (the project's movement type), the character would render in a
  static reference pose. Mitigation: the verification screenshot is the check
  (a natural idle pose vs. a stiff T/A-pose); if it does not animate, the
  fallback is to migrate the standard mannequin + its `ACharacter`-based
  `ABP_Manny`/`ABP_Quinn` from a Third Person template project (the
  brainstorm's A2). Plan Task 1 inspects the plugin content to assess this
  before wiring.
- **Mesh transform offset** — wrong values make the character float above or
  sink through the floor. Mitigation: use the standard mannequin offset
  (`(0,0,-90)`, yaw `-90`); the screenshot confirms the feet are on the floor.
- **`SubobjectDataSubsystem` editing of a BP's inherited component** is fiddly.
  Mitigation: the same machinery PS-1/PS-2 used to add components; if modifying
  the inherited `Mesh` proves unreliable, the fallback is to set the values via
  the BP's CDO. Plan Task 2 runs section-by-section.
- **Enabling an experimental plugin** — small risk it activates Mover systems.
  Mitigation: `MoverTests` only adds content + opt-in modules; the project's
  `ACharacter` movement is unaffected by merely enabling it. The functional-test
  re-run is the backstop.
- **The empty `AM_MeleeCombo`** on a now-real skeleton — if GAS montage code
  chokes on a skeleton-less montage differently than before. Mitigation: PS-1's
  `GA_MeleeAttack` fallback already covers a non-playable montage; the
  functional-test re-run confirms #3/#4.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: enable the plugin → wire the characters → verify.
5. Characters complete → the vertical-slice build-out is finished.
