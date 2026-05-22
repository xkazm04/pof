---
date: 2026-05-22
status: draft
sub_project: PS-2 (textured combat arena — 3D environment)
parent_initiative: PoF ARPG vertical slice — "Playable Slice" phase (PS-1 → PS-3)
predecessor_docs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-1-graybox-slice.md
  - docs/superpowers/specs/2026-05-22-playable-slice-ps-1-design.md
---

# Sub-project PS-2: Textured combat arena (3D environment)

## Context

PS-1 delivered a verified gray-box playable slice: a UE level
(`/Game/Maps/VerticalSlice`) with a primitive cube floor, a primitive player
(`BP_VSPlayer`, an engine Cylinder body) and a primitive enemy (`BP_VSEnemy`,
an engine Cube body), and an in-engine functional test (`AVSFunctionalTest`)
that verifies the gameplay loop (move, attack, damage, death+loot).

PS-2 is the first content sub-project: replace the gray-box **environment**
with a real, textured 3D combat arena, authored with Blender. The player and
enemy stay as PS-1 primitives — real animated characters are deliberately a
later, separate sub-project (the rig → animation → UE-skeleton pipeline is
large and uncertain enough to deserve its own brainstorm).

A UE-project / tooling check (2026-05-22) established: Blender 4.2 is installed
at `C:\Program Files\Blender Foundation\Blender 4.2\`; PoF has a Blender MCP
socket integration (`src/lib/blender-mcp/`, the `scene-composer` module); no AI
3D-generation API keys (Rodin/Hunyuan) are configured. So PS-2 uses Blender's
own procedural-authoring capability plus PolyHaven (free) textures — not paid
generation.

## Goals

1. Author a real combat-arena 3D environment in Blender — floor, perimeter
   walls, a few pillars/props — with UVs and material slots.
2. Texture it with PolyHaven materials so it reads as a real game space.
3. Import it into UE and rebuild `/Game/Maps/VerticalSlice` around the
   existing gameplay actors.
4. Prove the slice still plays — the PS-1 functional test stays green on the
   rebuilt level.

## Non-goals

- **No characters.** The player and enemy stay PS-1 primitives. Real character
  meshes / rigs / animation are a later sub-project.
- **No new gameplay.** PS-2 changes the environment only; the gameplay loop is
  PS-1's and must remain intact.
- **No PoF app source change.** PS-2 touches the UE project and the harness/
  docs only.
- **No paid 3D generation.** Rodin/Hunyuan need API keys that are not
  configured; PS-2 does not use them.
- **No multi-area level.** One bounded combat arena — appropriate for a single
  player-vs-dummy encounter.

## Decision record (from brainstorming)

1. **PS-2 = environment only** — characters deferred to a later sub-project.
2. **Textured combat arena** — floor + perimeter walls + pillars/props, with
   PolyHaven textures (chosen over geometry-only and over a larger multi-area
   environment).
3. **A1 — headless Blender + UE-side materials.** A Blender Python script run
   headless (`blender --background --python`) authors the geometry and exports
   an FBX; PolyHaven textures are fetched over HTTP; a UE Python script imports
   the FBX, builds UE materials, and rebuilds the level. Chosen over the
   Blender MCP socket (A2) — headless is more robust for a one-shot batch
   authoring job and has no addon/socket connectivity prerequisite. Trade-off:
   PS-2 does not exercise PoF's Blender MCP *socket* integration.

## Design

### Part 1 — Blender authors the arena

A Blender Python script — `<UE>/Content/ArenaBuild/build_arena.py` (kept with
the project; archived in the PoF repo) — run headless:
`"<Blender>\blender.exe" --background --python build_arena.py`

It procedurally builds one combat-arena mesh:
- a **floor** — a flat slab sized to the encounter (the PS-1 floor was ~40 m
  square; match that order),
- **perimeter walls** — four walls enclosing the arena,
- a few **pillars / props** — e.g. 4 corner pillars, to give the space depth.

Requirements on the mesh: real UVs (a simple cube/box unwrap is fine), sane
real-world scale and orientation (UE is Z-up, centimetres; Blender is Z-up,
metres — apply the scale conversion or rely on the FBX exporter's setting),
and **named material slots** — `M_Floor`, `M_Wall`, `M_Pillar` — so UE can
assign materials per slot. The script applies all transforms and exports a
single FBX `<UE>/Content/ArenaBuild/Arena.fbx`.

### Part 2 — textures

Fetch 2–3 PolyHaven texture sets via the PolyHaven HTTP API
(`https://api.polyhaven.com/`) — a stone/tile **floor** texture, a **wall**
texture, and a **pillar** texture — each at least albedo, plus normal and
roughness where readily available (1k or 2k resolution). Land the files under
`<UE>/Content/ArenaBuild/textures/`. PolyHaven is CC0 and keyless.

### Part 3 — UE import + level rebuild

A UE Python script — `<UE>/Content/Python/build_arena_ue.py` — run headless via
`UnrealEditor-Cmd ... -run=pythonscript`:

1. Import `Arena.fbx` as a UE **Static Mesh** at `/Game/ArenaBuild/SM_Arena`.
   Generate **collision** — the player must stand on the floor and be bounded
   by the walls; criterion #2 (movement) breaks if the floor has no collision.
   Prefer per-poly or auto-convex collision; if a single combined mesh's
   collision is unreliable, split the floor into its own mesh/section with a
   simple box collision.
2. Import the PolyHaven textures as UE texture assets under `/Game/ArenaBuild/`.
3. Build three simple UE materials (`M_Arena_Floor`, `M_Arena_Wall`,
   `M_Arena_Pillar`) — base colour from albedo, plus normal/roughness if
   present — and assign them to `SM_Arena`'s `M_Floor` / `M_Wall` / `M_Pillar`
   material slots.
4. Rebuild `/Game/Maps/VerticalSlice`: remove the gray-box floor cube; place
   `SM_Arena`; **keep** the `PlayerStart`, the `BP_VSEnemy`, and the
   `AVSFunctionalTest` actor, repositioning the `PlayerStart` and `BP_VSEnemy`
   onto the arena floor at sensible spots (player near one side, enemy a few
   metres away — within the PS-1 functional test's movement/attack ranges).
   Keep the directional light + sky light; adjust if the walls cause it to
   read too dark. Save the level.

The PS-1 gameplay assets (`BP_VSPlayer`, `BP_VSEnemy`, `BP_VSGameMode`,
`BP_GA_MeleeAttack`, the `IMC`, `AVSFunctionalTest`) are unchanged.

### Part 4 — verify

- **Gameplay intact:** re-run the PS-1 functional test headless —
  `UnrealEditor-Cmd ... -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi`.
  All of #2–#5 must still report pass. The new environment must not break the
  slice — especially #2 (the player must stand and move on the arena floor).
- **Visual check:** capture a screenshot of the rebuilt level (UE
  `HighResShot`) and describe it with Gemini vision — confirm it now reads as a
  textured arena (floor, walls, pillars), not a gray cube. This informs the
  findings; it does not gate PS-2.

## Verification (of PS-2 itself)

PS-2 passes when: `Arena.fbx` is authored and imports into UE as `SM_Arena`
with collision and the three textured materials; `/Game/Maps/VerticalSlice` is
rebuilt with the arena replacing the cube floor and the gameplay actors intact;
and the PS-1 functional test re-runs green (#2–#5) on the rebuilt level.

## Cross-cutting

- **Branch:** `master` (PoF repo). The UE project is not under git — Blender +
  UE Python scripts are archived into `docs/features/arpg-vertical-slice/
  ps-2-artifacts/` and committed there.
- **The UE project is edited irreversibly** — the `VerticalSlice` map is
  rebuilt, new mesh/texture/material assets added. Consistent with PS-1.
- **Blender prerequisite:** the headless Blender run needs only the Blender 4.2
  install (no addon, no socket) — plan Task 1 confirms `blender.exe` runs
  `--background --python`.
- **Controller-driven** — Claude authors the Blender + UE Python; the harness
  runs them. No PoF dev server, no Claude CLI, no Blender MCP socket.
- Commit locally only — the user pushes manually.

## Definition of done

1. `build_arena.py` authors the arena and exports `Arena.fbx`; the headless
   Blender run completes cleanly.
2. PolyHaven textures fetched.
3. `build_arena_ue.py` imports the FBX + textures, builds + assigns the
   materials, and rebuilds `/Game/Maps/VerticalSlice` with the arena and the
   intact gameplay actors.
4. The PS-1 functional test re-runs green (#2–#5) on the rebuilt level.
5. A findings doc records the outcome, the Gemini visual check, and any issues,
   under `docs/features/arpg-vertical-slice/scenario-runs/`.
6. Scripts archived; committed to `master`; chat summary.

**Success criterion:** the vertical slice still plays exactly as PS-1 verified,
but in a real textured combat arena instead of on a gray cube — a visibly
game-like environment, with the gameplay loop provably intact.

## Risks & mitigations

- **Floor collision** — an imported FBX static mesh has no collision by
  default; without it the player falls through and criterion #2 fails.
  Mitigation: Part 3 explicitly generates collision; if combined-mesh collision
  is unreliable, the floor gets its own mesh + a simple box collision. This is
  the single most likely break — plan Task 3 verifies the player stands before
  declaring done.
- **FBX scale / orientation** — Blender (metres) vs UE (centimetres), axis
  conventions. Mitigation: set the FBX exporter's scale/axis explicitly and
  verify the arena is the expected size in UE (the player capsule ~its height).
- **Gameplay-actor placement** — the PS-1 test expects the player and enemy
  within movement/attack range. Mitigation: Part 3 repositions them onto the
  arena deliberately, and Part 4's re-run is the gate.
- **PolyHaven texturing fiddliness** — API shape, channel-packing, UE material
  wiring. Mitigation: if texturing proves too costly, fall back to geometry +
  simple solid UE materials (the brainstorm's option B) — the arena geometry
  is the core deliverable; full texturing is the stretch. Record the fallback
  if taken.
- **Blender headless quirks** — FBX export options, addon-free environment.
  Mitigation: plan Task 1 smoke-tests a trivial headless Blender script first.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: Blender arena authoring → textures → UE import + level rebuild →
   verify.
5. PS-2 complete → PS-3 (Leonardo 2D content) or the deferred character
   sub-project is the next brainstorm.
