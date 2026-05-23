# 05 · Environment — Game Improvements

## Goals

Move the level beyond "one hand-authored 20 m arena with one cube floor"
toward (a) a polished arena that doesn't look like a grid, (b) procedural
multi-room levels via the unused `ARPGLevelGenerator` scaffolding, and
(c) standard UE environment polish (better lighting, post-process, fog).

## Improvements

### 1. Re-UV the arena mesh

`Content/ArenaBuild/build_arena.py` regenerates the arena from scratch.
Change its UV step from `bpy.ops.uv.cube_project(cube_size=2.0)` to
either `smart_project` (per-face seams, less obvious tiling) or
world-aligned UV (a few lines of Python: for each vertex, set UV =
`world.xy` / `tile_size` for floors and a per-axis projection for walls).
Re-export FBX, re-import via `build_arena_ue.py`, the existing
`M_Arena_*` materials pick up the new UVs automatically.

The slice's arena reads as a real space, not a checkerboard grid. The
PS-3 textures (which were correctly chosen but tiled too aggressively)
get to shine.

### 2. Static lighting with a Lightmass bake

For a one-time polish pass: set `DirectionalLight` and `SkyLight` back
to `Stationary` (or `Static`); add a second UV channel to `SM_Arena` via
`bpy.ops.uv.lightmap_pack` in the Blender script; ensure `Lightmap
Coordinate Index = 1` on the UE static mesh. Run a `BuildLighting`
commandlet (or in-editor Build → Build Lighting). The arena gets baked
shadows + GI — visible polish. Document the bake step (slow, editor-side)
so future regeneration knows to re-bake.

### 3. Procedural level via `ARPGLevelGenerator`

The project has C++ classes for procedural levels. Wire one minimal
`BiomeDefinition` asset (Dungeon-Stone biome: floor mesh, wall mesh,
pillar mesh, point-light prefab), one `RoomTemplate` (a 10 m square
room with 4 exits), and a `LevelGenerator` instance that produces a
3×3 grid of rooms connected by corridors. Replace `BP_VSEnemy` in the
slice level with one enemy per few rooms. The slice's environment goes
from "one arena" to "a small dungeon."

This is real game-design work; the C++ scaffolding exists, the gap is
the data assets + the genrator's runtime call.

### 4. Environment props from the existing C++ scaffolding

`ARPGEnvironmentalProp` and `ARPGVegetationScatter` are generated but
unused. The Blender MCP scripts include `scatter-vegetation.ts` — a
matched pair. Wire a small "scatter rocks" pass that adds 5-10 hand-
authored prop meshes (Blender-generated rocks + cracks; static meshes)
distributed around the arena to break up the bare-floor look.

### 5. Post-process volume

Add an `APostProcessVolume` covering the level — auto-exposure clamp
(min/max log brightness `-2` / `1`), bloom 0.5, vignette 0.4, a slight
saturation lift. Pure-C++ defaults (no UE editor needed); cheap visible
polish.

### 6. Atmospheric fog

`UExponentialHeightFogComponent` placed in the level with a low-density
purple-tinted fog gives the arena depth and atmosphere. Free polish.

### 7. Audio — ambient bed + footsteps + impact

Adjacent to environment but worth flagging: the project has
`ARPGAmbientSoundActor`, `ARPGSoundManager`, `AnimNotify_FootstepEffect`
generated; no audio assets exist. A small Audio sub-folder under
`/Content/Audio/` with one ambient loop + one footstep cue + one impact
cue (Polyhaven sounds, Mixamo-style downloadable) wires real sound. Note
as a defer-out (its own sub-project) rather than fold into this folder.

## Verification this work succeeded

- The arena's textures no longer read as a checkerboard grid
  (Gemini-confirmed).
- After a `BuildLighting` pass, the arena has baked shadows visible in a
  screenshot.
- A `LevelGenerator`-produced multi-room level is the slice's new map;
  the PS-1 functional test still passes (gameplay intact).
- Props scattered around the arena are visible in a screenshot.
- A post-process volume + fog change the screenshot's tonal feel — even
  Gemini can describe the difference.
