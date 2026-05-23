# 05 · Environment

## Scope

Levels, level geometry, lighting, the procedural level generator the
project already has scaffolding for (`ARPGLevelGenerator`, `ARPGRoomTemplate`,
`ARPGBiomeDefinition`, `ARPGZoneManager`, navigation), and the static-mesh
content used to build out a level. Not characters (folder 02), not the
texturing/material pipeline (folder 06).

## Current state

After PS-2 (2026-05-21):

- One `SM_Arena` mesh (~20 m square: floor + 4 perimeter walls + 4 corner
  pillars), joined in Blender via `Content/ArenaBuild/build_arena.py` and
  exported as FBX. Imported to `/Game/ArenaBuild/SM_Arena` with
  collision `CTF_USE_COMPLEX_AS_SIMPLE`.
- Used in `/Game/Maps/VerticalSlice` — a single map with the arena, a
  Movable DirectionalLight + SkyLight, a `PlayerStart`, `BP_VSEnemy`,
  and the `AVSFunctionalTest` actor.
- **The cube-projection UVs tile every texture ~10×** across the 20 m
  floor — gives a grid look (PS-3 corrected the *tiling scale* to 3×
  but not the underlying UV strategy).
- Lighting is *fully dynamic* — `DirectionalLight` + `SkyLight` set to
  Movable because static lights need a Lightmass bake that headless UE
  skips. Looks fine for the slice; not how a shipped UE5 scene is lit.
- `Content/Maps/` has only `VerticalSlice.umap`. The richer level
  scaffolding (`ARPGLevelGenerator`, room templates, biomes, zones) is
  unused.

## Key lessons

1. **Cube-projection UVs are the easy default but produce visible
   tiling.** A real game-ready arena either uses Smart-project UVs +
   lightmap UV channel, or trims the world-space by texture worldsize so
   tile boundaries land naturally.
2. **Static-mesh + stationary lights need a Lightmass bake.** Headless
   UE does not bake; the arena rendered black on first launch until PS-2
   set lights Movable. Document the trade-off: Movable lighting (works
   headless, cheaper at build, looks flatter) vs. Static/Stationary
   (requires a bake step, looks richer).
3. **Combined arena meshes work for a vertical-slice arena** but become
   limiting for a real level. Each "piece" (floor tile, wall section,
   pillar) wants to be a re-instanceable mesh — the existing
   `ARPGRoomTemplate` scaffolding implies this is the intended direction.
4. **Blender headless FBX export is reliable** when `apply_unit_scale=True`
   is set — UE import then needs `import_uniform_scale = 1.0` (PS-2's
   correction; the plan's original 100.0 over-scaled by 100×). Bake the
   correct values into PoF's prompts.
5. **Floor collision must be deliberate.** PS-2 used
   `CTF_USE_COMPLEX_AS_SIMPLE` — fine for a static, non-moving floor;
   verified by the player not falling through during the functional test.
   Other approaches (per-poly, auto-convex) have known pitfalls on
   combined meshes.

## Isolated-CLI session focus

A session works on:
- **UE project:** `Content/ArenaBuild/`, `Content/Maps/`, `Content/Level/`
  (per the `ARPGRoomTemplate` etc. classes' content paths),
  `Source/PoF/Level/` (`ARPGLevelGenerator`, `ARPGRoomTemplate`,
  `ARPGEncounterArena`, `ARPGZoneManager`, `ARPGBiomeDefinition`),
  `Content/Python/build_arena.py`, `build_arena_ue.py`.
- **PoF app:** `src/components/modules/content/level-design/`,
  `src/components/modules/visual-gen/scene-composer/` (the Blender MCP
  module), `src/lib/blender-mcp/scripts/level-blockout.ts` and
  `dungeon-to-geometry.ts`, `terrain-to-mesh.ts`, `scatter-vegetation.ts`.

It does *not* touch textures/materials (folder 06 — closely related but
separate concern), characters, combat, or HUD.
