---
date: 2026-05-23
status: draft
sub_project: Environment — arena visual-polish pass (improvements folder 05, session 1)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/README.md
  - docs/improvements/05-environment/game.md
  - docs/improvements/05-environment/pof-app.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-ps-2-arena.md
---

# Environment — Arena Visual-Polish Pass

## Context

This is the first scoped session of improvements folder `05-environment`
(the folder is several sessions of work; this CLI handles concern #5). The
vertical-slice arena (PS-2) and its Leonardo textures (PS-3) work, but the
arena's weakest visual is the **cube-projection-UV grid**: `build_arena.py`
unwraps with `bpy.ops.uv.cube_project(cube_size=2.0)`, so every texture tiles
in a per-face checkerboard. PS-3 corrected the *tiling scale* (a
`TextureCoordinate` of 3.0 in the materials) but not the underlying UV
strategy.

This session does a self-contained **visual-polish pass** on the existing
arena: kill the grid (re-UV), add post-process + fog, and ship the matching
PoF-app improvements so future arenas avoid the same trap. It does **not**
touch the procedural level generator (`ARPGLevelGenerator`), static
lighting / Lightmass (kept Movable), props, or audio — those are later
folder-05 sessions.

### Current state (verified)

- `Content/ArenaBuild/build_arena.py` — builds floor (20×20×0.2, top z=0),
  4 walls (5 m), 4 corner pillars; joins into one `Arena` mesh; line 56
  `bpy.ops.uv.cube_project(cube_size=2.0)`; exports `Arena.fbx`. Material
  slots `mat_floor` / `mat_wall` / `mat_pillar`.
- `Content/Python/build_arena_ue.py` — imports the FBX (`import_uniform_scale
  = 1.0` — the PS-2-corrected value), rebuilds `/Game/Maps/VerticalSlice`,
  forces `DirectionalLight` + `SkyLight` to **Movable** (PS-2 lighting fix:
  pitch -50, DirLight intensity 6.0, SkyLight 3.0 + real-time capture), and
  the `M_Arena_*` materials carry a shared `TextureCoordinate` tiling of 3.0.
- PoF app: `src/components/modules/content/level-design/` exists
  (`LevelDesignView`, `ProceduralLevelWizard`, …); `src/lib/blender-mcp/
  scripts/level-blockout.ts` + `dungeon-to-geometry.ts` exist; `level-design`
  is a registered sub-module.

## Goals

1. The arena reads as a real surface, not a checkerboard grid.
2. The scene gets atmospheric depth (post-process + fog).
3. PoF can emit a non-grid UV strategy for future arenas and won't repeat
   the FBX-scale and grid traps.
4. The slice still plays — the PS-1 functional test stays green.

## Non-goals

- **No procedural level generation** (`ARPGLevelGenerator`) — a later
  folder-05 session.
- **No static lighting / Lightmass bake** — lights stay Movable (PS-2
  setup). That was option C; this session is option A.
- **No props, no vegetation, no audio.**
- **No new geometry** — the arena's shape (floor/walls/pillars) is
  unchanged; only its UVs + the level's atmosphere actors change.
- **No material content change beyond the tiling-scale match** — the
  `WorldAlignedTexture` material-function approach (A2) is *not* taken;
  the textures themselves (PS-3) are kept.

## Decision record (from brainstorming)

1. **Scope = arena visual-polish pass** (chosen over procedural level
   generation and over the Lightmass pass).
2. **A1 — Blender world-aligned UVs** (chosen over A2 the UE
   `WorldAlignedTexture` material function, and A3 `smart_project`):
   deterministic, uniform real-world tile scale, kills the per-face grid,
   bakes into the FBX, the materials sample normally.
3. Lights stay Movable; the polish is re-UV + post-process + fog.

## Design

### Part 1 — Re-UV the arena (game)

In `Content/ArenaBuild/build_arena.py`, replace the single
`bpy.ops.uv.cube_project(cube_size=2.0)` call (line 56, applied to the joined
mesh) with **per-face world-aligned planar UVs** computed before the join (or
on the joined mesh by face). For each face, classify by the dominant axis of
its world-space normal and project the world position scaled by a constant
`TILE_METERS` (default 4.0 m per texture repeat):

- floor / ceiling faces (normal ≈ ±Z): `UV = (world.x, world.y) / TILE_METERS`
- N/S wall faces (normal ≈ ±Y): `UV = (world.x, world.z) / TILE_METERS`
- E/W wall faces (normal ≈ ±X): `UV = (world.y, world.z) / TILE_METERS`
- pillars (cylinders): keep a cylinder/cube unwrap — they are small and not
  the grid offender; `smart_project` per pillar is acceptable.

Implementation: after building the parts and before/after the join, iterate
the mesh's polygons, read each loop vertex's world coordinate, and write the
loop's UV directly into the active UV layer (`mesh.uv_layers.active.data`).
This is deterministic and needs no `bpy.ops` UV operators. Re-export
`Arena.fbx` (unchanged export call).

In `Content/Python/build_arena_ue.py`, set the material `TextureCoordinate`
tiling to **`1.0`** (was 3.0) — the world-aligned UVs now encode the
real-world tile scale, so the material must not re-multiply it. Everything
else in the re-texture / level-rebuild flow is unchanged.

### Part 2 — Post-process + fog (game)

Extend `build_arena_ue.py`'s level-build section to spawn into
`/Game/Maps/VerticalSlice` (idempotently — destroy any prior instance first):

- **`APostProcessVolume`** with `bUnbound = true` and a minimal
  `FPostProcessSettings`: auto-exposure clamped
  (`bOverride_AutoExposureMinBrightness/MaxBrightness = true`, min ≈ 0.5,
  max ≈ 2.0, or the EV-100 equivalents), bloom intensity ≈ 0.5, vignette
  intensity ≈ 0.4, a slight saturation/contrast lift via
  `ColorSaturation`/`ColorContrast`. Start with exposure + vignette; add the
  rest once the struct-set path is confirmed working.
- **`AExponentialHeightFog`** at a low height, `FogDensity ≈ 0.02`, a cool
  (slightly blue/purple) `FogInscatteringColor`, so the arena has depth.

Both configured via `set_editor_property` on the spawned actors' components
(`UPostProcessComponent` settings struct; `UExponentialHeightFogComponent`).

### Part 3 — PoF-app improvements

- **UV-strategy choice.** `src/lib/blender-mcp/scripts/level-blockout.ts`
  (the TypeScript template that emits Blender Python for level geometry)
  gains a `uvStrategy: 'cube' | 'smart' | 'world-aligned'` parameter that
  switches the emitted UV code; `world-aligned` emits the per-face planar
  projection from Part 1. The `level-design` module surfaces it as a
  dropdown (default `world-aligned`).
- **FBX-scale gotcha.** Where the level/arena Blender→UE prompt is built
  (the `level-design` module's generation prompt, and/or
  `src/lib/prompt-context.ts`), bake the corrected combination: "Blender
  export `apply_unit_scale=True`, `global_scale=1.0`; UE import
  `import_uniform_scale = 1.0`. Authoring in metres yields correctly-sized
  UE assets." (PS-2's 100×-over-scale trap.)
- **Lighting / visual Gemini smoke-check.** A small reusable helper —
  `e2e/helpers/gemini-check.ts` (or extend `harness-mode.ts`) — that
  launches the slice, captures a screenshot, and runs
  `personas/.claude/skills/leonardo/tools/gemini-recognize.mjs` with a
  discriminating prompt ("is the scene lit, not black? do the surfaces
  read as a continuous texture or a repeating grid?"). Used by Part 4 and
  reusable by future environment sessions.

### Part 4 — Verify

- **Gameplay intact:** re-run the PS-1 functional test
  (`Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`) — #2–#5
  must still pass. The re-export must not break the arena's collision (the
  player must still stand on the floor / be bounded by walls).
- **Visual before/after:** capture a real-launch screenshot, run the
  Gemini check — confirm the grid is gone (textures read as continuous,
  uniform-scale) and the post-process + fog visibly change the tone vs the
  PS-3 screenshot.

## Verification (of this session)

Passes when: `build_arena.py` uses world-aligned UVs; the re-exported arena
imports with the material tiling at 1.0; the level has a post-process volume
+ fog; the PS-1 functional test re-runs green; and the Gemini check confirms
no grid + the new atmosphere. PoF: the level-blockout UV-strategy parameter
works (unit-tested), the FBX-scale gotcha is in the prompt, and the
Gemini-check helper exists.

## Cross-cutting

- **Repos:** `build_arena.py` + `build_arena_ue.py` commit to the UE repo
  (`github.com/xkazm04/pof-exp`); the PoF-app changes + the spec/plan/findings
  to the app repo (this one).
- **Controller-driven** — author the scripts, run them headless. Headless UE
  runs may end with a benign exit-3 shutdown crash; judge by log content.
  UE 5.7 FBX import may need the full editor (`-ExecutePythonScript=`) rather
  than `-run=pythonscript`.
- The UE project is edited irreversibly (the arena assets + the level).

## Definition of done

1. `build_arena.py` re-UVs world-aligned; `Arena.fbx` re-exported.
2. `build_arena_ue.py` re-imports + sets material tiling 1.0 + adds the
   post-process volume + fog to `/Game/Maps/VerticalSlice`.
3. The PS-1 functional test re-runs green (#2–#5).
4. The Gemini check confirms: no grid, lit, atmospheric.
5. PoF: `level-blockout.ts` UV-strategy param + the FBX-scale gotcha in the
   prompt + the `gemini-check` helper, each with a vitest where applicable.
6. A findings doc under `docs/features/arpg-vertical-slice/scenario-runs/`;
   committed (scripts → UE repo, docs/app changes → app repo).

**Success criterion:** the slice's arena looks like a real textured space —
continuous surfaces (no checkerboard), atmospheric lighting/fog — with
gameplay provably intact, and PoF can emit the non-grid UV strategy for
future arenas.

## Risks & mitigations

- **Re-export perturbs collision.** The arena is re-built + re-imported;
  collision (`CTF_USE_COMPLEX_AS_SIMPLE`) must survive. Mitigation: Part 4's
  PS-1 functional test #2 (movement) is the gate — the player must stand and
  move. If collision breaks, re-assert the static mesh's collision in
  `build_arena_ue.py`.
- **World-aligned UV face classification.** On the joined mesh, each face's
  normal must be classified to the right axis. Mitigation: compute per-face
  in world space after `transform_apply`; a face whose normal is ambiguous
  defaults to the floor projection. Verify by the Gemini "continuous, not
  grid" read.
- **Tiling-scale mismatch.** If the material `TextureCoordinate` is left at
  3.0 with world-aligned UVs, the texture tiles 3× too fast. Mitigation:
  Part 1 explicitly sets it to 1.0; the Gemini read confirms a sensible
  scale.
- **`FPostProcessSettings` is a fiddly nested struct in Python.** Mitigation:
  start with exposure + vignette (the `bOverride_*` flags must be set per
  field), confirm via screenshot, then add bloom/saturation. If a field's
  Python name is wrong it silently no-ops — verify each override took by
  reading it back.
- **Fog density too high washes the scene.** Mitigation: start at 0.02,
  tune by the screenshot.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: re-UV → re-import + PP/fog → PoF improvements → verify.
5. This session done → the next folder-05 session (procedural level
   generation, or the Lightmass pass) is a fresh brainstorm.
