# Environment — Static Lighting + Lightmass Bake (folder-05, session 2)

**Date:** 2026-05-23
**Spec:** `docs/superpowers/specs/2026-05-23-env-lightmass-bake-design.md`
**Plan:** `docs/superpowers/plans/2026-05-23-env-lightmass-bake.md`

## What shipped

### Game (UE repo `xkazm04/pof-exp`)
- **Lightmap UV channel** in `Content/ArenaBuild/build_arena.py` — a 2nd UV
  layer packed via `bpy.ops.uv.lightmap_pack` (non-overlapping) on the joined
  arena; UV0 stays the world-aligned texture UVs. FBX exports both channels
  (`LIGHTMAP_UV_PACKED channels=2`).
- **Static-lighting setup** in `Content/Python/build_arena_ue.py`:
  - `SM_Arena` `light_map_coordinate_index=1`, `light_map_resolution=256`;
    `generate_lightmap_u_vs=False` (use the authored channel).
  - DirectionalLight + SkyLight Movable → **Stationary**.
  - A `LightmassImportanceVolume` around the arena (scale 24,24,8).
  - The arena `PostProcessVolume`'s GI method → **None** (scopes baked GI to
    this level; siblings keep Lumen) — confirmed
    `PPV GI method = DynamicGlobalIlluminationMethod.NONE`.

### PoF app (`xkazm04/pof`, local-only)
- `src/lib/module-registry.ts` — level-design knowledge tip: Movable/Lumen vs
  Static/Stationary+bake tradeoff, the lightmap-UV + bake workflow, and the
  per-PPV GI-method scoping trick.

## The bake — SUCCEEDED headless

`UnrealEditor-Cmd … -run=ResavePackages -map=VerticalSlice -buildlighting
-Quality=Medium -AllowCommandletRendering` (exit 1 = benign shutdown crash;
judged by log):

```
LogStaticLightingSystem: Running Lightmass w/ ImmediateImport mode ENABLED
LogSwarmInterface: [TryOpenConnection] Opening Connection to Agent
Lightmass on KAZIHO: 903 ms total … [1/1 mappings]
LogStaticLightingSystem: Illumination: 4:29 min (encoding lightmaps, shadowmaps)
LogStaticLightingSystem: Lightmap texture memory:  0.8 MB, 2 textures
LogStaticLightingSystem: Shadowmap texture memory: 0.1 MB, 1 textures
LogShaderCompilers: Jobs assigned 4,603, completed 4,603 (100%)
```

`Content/Maps/VerticalSlice_BuiltData.uasset` (521 KB) written, and
`VerticalSlice.umap` resaved with the matching lighting GUID. **The manual
editor-bake fallback was NOT needed** — the headless `ResavePackages
-buildlighting` path works on this machine (Swarm + `-AllowCommandletRendering`).

## Verification

### Visual (Gemini) — the not-black gate PASSES
AFTER (`img/env-lighting-after.png`), Gemini:
- Floor visible / enclosed arena / **lit (not black)** / depth from graded
  lighting + shadows / no artifacts → all **yes**.
- (Floor still reads as a tiled grid — texture-inherent, a session-1 item,
  out of scope here.)

No splotchy/blotchy lightmap → the authored lightmap UV1 baked cleanly (despite
the `get_num_uv_channels` introspection helper logging `-1`; that API call
failed but the bake result proves UV1 is present and non-overlapping).

The baked-vs-Movable visual delta is **subtle** — the arena is a simple
flat-floor/walls/pillars box and the session-1 post-process + fog dominate the
tone. The substantive win is the *mechanism*: Stationary lights + a real
Lightmass bake (baked lightmaps + shadowmaps) with the arena no longer black.

### Gameplay (collision/loop) — PASS
`VSFunctionalTest` (`-nullrhi`, isolated `-abslog`): `Result={Success}`,
`EXIT CODE: 0`, all assertions pass (#2 movement 161.4cm, #3 attack, #4 damage
60.0, #5 death 0.0, #5 loot 1). The lighting change didn't affect gameplay.

## Outcome

All DoD met: lightmap UV1; `SM_Arena` lightmap channel 1; Stationary lights;
LightmassImportanceVolume; PPV GI scoped to baked (read-back confirmed); the
bake landed (headless, no manual fallback); Gemini confirms **lit, not black**;
functional test green; lighting knowledge tip added.

**Key win — the GI scoping worked.** Setting the PostProcessVolume's GI method
to `None` made the arena use baked lighting WITHOUT flipping the project off
Lumen in `DefaultEngine.ini`. So the ~8 sibling sessions on the shared tree
keep Lumen; only the VerticalSlice arena uses baked GI. The global-flip
fallback was not needed.

## Lessons (new this session)

- **Headless Lightmass bake DOES work** via `UnrealEditor-Cmd -run=ResavePackages
  -map=<Map> -buildlighting -Quality=Medium -AllowCommandletRendering` — Swarm
  launches, bakes, writes `<Map>_BuiltData.uasset`, resaves the map. Exit 1 is
  the benign shutdown; judge by `LogStaticLightingSystem` + the BuiltData mtime.
- **Per-PostProcessVolume GI-method override is honored in UE 5.7** —
  `dynamic_global_illumination_method = unreal.DynamicGlobalIlluminationMethod.NONE`
  + `override_dynamic_global_illumination_method = True` (same for
  `reflection_method`). Scopes baked GI to one level without a project-wide flip.
- **`StaticMesh.get_num_uv_channels()` is not the right call** (raised → logged
  `-1`); the bake's clean result is the real UV-channel confirmation. Find the
  correct introspection API if a positive channel-count check is ever needed.
- A `Quality=Medium` bake of a single ~20 m arena takes ~4.5 min wall-clock
  (mostly Lightmass illumination + shader compile), most of it one-time DDC.
