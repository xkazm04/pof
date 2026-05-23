# 05 · Environment — PoF App Improvements

## Goals

PoF's level/environment module should produce arenas and levels that look
acceptable on first launch — without the cube-projection-grid tiling, the
black-arena-because-lighting-needs-baking trap, or the headless Blender
scale-100× pitfall.

## Improvements

### 1. UV strategy is a checklist choice, not a default

`src/lib/blender-mcp/scripts/level-blockout.ts` and the Blender-side
`build_arena.py` template currently default to `bpy.ops.uv.cube_project`.
That's what gives the grid. Add a UV-strategy parameter with three options:

- **Cube project (fast)** — current default; document it as "expect tiling
  grid; pair with high tiling scale and detail-mapping in the material."
- **Smart project (per-face)** — `bpy.ops.uv.smart_project`; less grid,
  more seams, slightly more bake cost.
- **World-aligned (world-space)** — UV from world-space XYZ; texture tiles
  by world distance, no per-face seams. Good for floors/walls where the
  texture should tile predictably regardless of mesh size.

The PoF UI surfaces this as a dropdown in the `level-design` module's
arena-generation panel; the generated Blender script switches strategy
accordingly.

### 2. Lightmap UV channel and Lightmass acknowledgement

Update the Blender export prompt to always create a second UV channel
(`UVMap.001` / `LightmapUV`) via `bpy.ops.uv.lightmap_pack` with sane
defaults. This unlocks static lighting if/when the user wants a bake. The
PoF prompt explains the trade-off:

- **Dynamic-only lighting** (current PS-2 default): no bake step, works
  headless, flatter look — what the slice uses.
- **Static/Stationary lights + Lightmass bake**: needs lightmap UVs, needs
  a Build → Build Lighting pass in the editor (and an editor session — not
  headless). A new PoF dispatch can run `BuildLighting` via UE Python
  commandlet (`ue.AutomationLibrary.build_lighting`-equivalent) but it's
  a slow step (minutes).

The PoF prompt makes the operator choose; default stays Dynamic-only for
the slice path.

### 3. Bake the correct FBX-import scale into PoF's prompts

PS-2's plan said `import_uniform_scale = 100.0`; the actual correct value
(given Blender exports with `apply_unit_scale=True`) is `1.0`. Bake the
correct combination into the PoF prompt: "Blender export with
`apply_unit_scale=True`, global_scale=1.0; UE FBX import with
`import_uniform_scale = 1.0`. Authoring in metres in Blender produces
correctly-sized UE assets." Add a note to the gotchas pack
([[../01-generation-quality/pof-app.md]] §3).

### 4. Surface `ARPGLevelGenerator` and the room-template pipeline

The project has substantial procedural-level-generation scaffolding
(`ARPGLevelGenerator`, `ARPGRoomTemplate`, `ARPGBiomeDefinition`,
`ARPGZoneManager`, `ARPGEncounterArena`) — currently unused. A new PoF
sub-module surfaces:

- A **biome-definition editor** — minimal UI to set wall/floor/pillar
  mesh refs + lighting params for a biome, persisted as a
  `BiomeDefinition` data asset.
- A **room-template generator** — dispatches a Blender script (the
  existing `dungeon-to-geometry.ts` is the right starting point) per
  room template, exports each as a per-room FBX.
- A **level-assembly preview** — runs `ARPGLevelGenerator` in editor
  with a chosen biome + seed; screenshots the result; Gemini-confirms it
  reads as a dungeon level.

This turns the unused scaffolding into a real PoF capability — the user
goes from "one hand-authored arena" to "procedurally-generated levels per
biome."

### 5. A "lighting smoke" Gemini check

After any environment dispatch (arena or level), take a real-launch
screenshot and Gemini-check: "is this scene lit, or is it black/un-lit?
Are surfaces shadowed, or flat-shaded?" Catches the PS-2 black-arena
regression class. Cheap; folds into the standard screenshot step from
[[../04-hud-ui/pof-app.md]] §5.

### 6. Document the Blender MCP socket vs. headless choice

PS-2 chose headless Blender (`--background --python`) over the
`BlenderMCPService` TCP socket because it's more robust for a one-shot
batch authoring job. Bake this guidance into the `scene-composer` module:

- **Headless Blender** — for one-shot batch authoring (arena, room
  template export). Default.
- **MCP socket** — for *interactive* iteration (designer adjusts a
  mesh and sees the change in PoF). Use when the operator is at the
  PoF UI editing things live.

## Verification this work succeeded

- A fresh arena dispatch with `World-aligned UV` strategy produces a
  level whose textures tile naturally (Gemini-confirmed: not a grid).
- A `BuildLighting` dispatch produces a Static-lit version of the same
  level; the lighting reads as "shadowed" via Gemini.
- A first `ARPGLevelGenerator` run on a "dungeon" biome produces a
  multi-room layout the slice playable in (player can walk between
  rooms).
- A fresh PoF re-run on the *same* level dispatch uses
  `import_uniform_scale = 1.0` (verified in the generated
  `build_arena_ue.py`).
