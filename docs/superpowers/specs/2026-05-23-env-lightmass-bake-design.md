---
date: 2026-05-23
status: draft
sub_project: Environment — static lighting + Lightmass bake (improvements folder 05, session 2)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/game.md   # §2 static lighting + Lightmass
  - docs/improvements/05-environment/README.md # key lesson 2 (static needs a bake)
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-arena-polish.md
  - docs/superpowers/specs/2026-05-23-env-arena-visual-polish-design.md  # session 1
---

# Environment — Static Lighting + Lightmass Bake

## Context

Folder-05 session 1 (re-UV + post-process + fog) shipped; the slice arena is
lit **fully dynamically** — `DirectionalLight` + `SkyLight` are Movable (the
PS-2 black-arena fix, because a static-mesh arena under static/stationary
lights with no Lightmass bake renders black). That works but looks flat: no
baked global illumination, no soft contact shadows / ambient occlusion at wall
bases and under pillars.

This session does the folder-05 §2 work: a one-time **static-lighting pass with
a Lightmass bake** so the static arena gets baked GI + baked soft shadows,
while the movable player/enemy still cast dynamic shadows.

### Current state (verified)

- **No renderer overrides** in `Config/DefaultEngine.ini` → UE 5.7 engine
  defaults: **Lumen is the active GI method** (`r.DynamicGlobalIlluminationMethod`
  defaults to Lumen); `r.AllowStaticLighting` defaults **true** (baked lighting
  is allowed engine-wide).
- `build_arena_ue.py` §6 forces DirectionalLight + SkyLight to **Movable**
  (pitch -50, DirLight intensity 6.0, SkyLight 3.0 + real-time capture).
- `build_arena_ue.py` imports `SM_Arena` with `generate_lightmap_u_vs=True`
  (UE auto-generates a lightmap UV), `CTF_USE_COMPLEX_AS_SIMPLE` collision.
- Session 1 spawns an **unbound `APostProcessVolume`** (`Arena_PostProcess`)
  in the slice — reused by this session.
- The UE project tree is **shared by ~8 concurrent CLI sessions**
  ([[project_ue_shared_concurrency]]).

## Goals

1. The static arena shows **baked GI + baked soft shadows** (richer, not flat).
2. The movable player/enemy still cast **dynamic shadows**.
3. The arena is **never black** — the bake must land before any render.
4. Gameplay intact — the PS-1 functional test still passes.
5. **Sibling sessions are not forced onto baked GI** — the GI-method change is
   scoped to the arena, not the whole project.

## Non-goals

- No procedural level (folder-05 §3), no props (§4), no audio (§7).
- No texture/material content change (folder 06).
- No geometry change — only UVs (a lightmap channel), lights, the importance
  volume, the PPV GI override, and the bake.
- Not switching the whole project off Lumen unless the scoped path fails.

## Decision record (from brainstorming)

1. **Approach = true Lightmass static bake** (chosen over Lumen-polish and the
   Stationary+Lumen hybrid), with full awareness of the bake/headless risk.
2. **Scope the GI-method change to the arena PPV, not `DefaultEngine.ini`** —
   a per-volume override keeps siblings on Lumen. Global flip is the fallback.
3. **Stationary** lights (not Static) — the static arena bakes GI while the
   movable player/enemy keep a dynamic directional shadow.

## Design

### Part 1 — Lightmap UVs (game: `build_arena.py`)

After the world-aligned UV0 (session 1), add a **second UV layer** and pack a
clean, non-overlapping lightmap unwrap into it:

```python
# after the world-aligned UV0 pass + before/after the join, on the joined mesh:
lm = arena.data.uv_layers.new(name="Lightmap")   # UV channel 1
arena.data.uv_layers.active = lm
bpy.context.view_layer.objects.active = arena
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.lightmap_pack(PREF_MARGIN_DIV=0.2)    # non-overlapping islands
bpy.ops.object.mode_set(mode='OBJECT')
arena.data.uv_layers.active_index = 0            # restore UV0 as active for export
```

This must run **on the joined `Arena` mesh** (one lightmap atlas for the whole
arena). Re-export FBX with both UV channels (`export_scene.fbx` exports all UV
layers by default).

### Part 2 — Static-lighting setup (game: `build_arena_ue.py`)

1. **Lightmap on the mesh** (in `import_arena_mesh`, after import): set
   `SM_Arena` `light_map_coordinate_index = 1`, `light_map_resolution = 256`.
   Keep `generate_lightmap_u_vs` — if Blender now provides UV1, set it to
   `False` so the authored channel is used; verify channel 1 exists by reading
   the mesh's `get_num_uv_channels()` and log it.
2. **Lights → Stationary** (replace §6's Movable): set DirectionalLight +
   SkyLight component mobility to `unreal.ComponentMobility.STATIONARY`. Keep
   the directional pitch -50 / intensity, SkyLight intensity. (Stationary
   directional: baked GI + a dynamic shadow for movable actors. Stationary
   SkyLight: baked ambient + the movable actors get GI from the volumetric
   lightmap.)
3. **Lightmass Importance Volume**: spawn an `ALightmassImportanceVolume`
   centred on the arena, scaled to ~`(1200, 1200, 400)` half-extents (covers the
   20 m arena + headroom). Focuses bake quality + builds the volumetric
   lightmap that lights the movable player/enemy. Idempotent (destroy prior).
4. **Scope baked GI to the arena PPV**: on the existing `Arena_PostProcess`
   volume, set
   `override_dynamic_global_illumination_method = True`,
   `dynamic_global_illumination_method = unreal.DynamicGlobalIlluminationMethod.NONE`,
   and the same for `reflection_method` → `NONE` (baked/SSR). Read both back and
   log; if a property name is wrong (raises), fall back to the global
   `DefaultEngine.ini` flip (Part 5 fallback).

`add_atmosphere` and the rest of the session-1 PPV/fog settings are unchanged.

### Part 3 — The bake

Attempt a **headless bake** after the level is rebuilt + saved:

```
UnrealEditor-Cmd.exe <proj> -run=ResavePackages ^
  -packagedir="<proj>/Content/Maps" -map=VerticalSlice ^
  -buildlighting -Quality=Medium -AllowCommandletRendering -Unattended -nopause
```

(Exact flags finalised in the plan; `-Quality` ∈ Preview/Medium for speed.)
Judge success by log content (`LogStaticLightingSystem` / "Lighting build
completed" / no "build failed") and by the verification render not being black.

**Fallback (documented):** if the headless bake does not produce baked data,
the operator runs a one-time manual editor bake — open the editor on
VerticalSlice, **Build → Build Lighting Only**, save. The spec/findings
document this explicitly (the bake is the accepted-risk part).

### Part 4 — Verify

- **Not black + baked shadows**: real-launch screenshot → Gemini. Confirm the
  arena is lit (NOT black) and shows baked soft shadows / ambient occlusion at
  wall bases and under pillars (vs the flat Movable look). This is the gate —
  do not declare success on a black arena.
- **Gameplay intact**: re-run `Project.Functional Tests.Maps.VerticalSlice.
  VSFunctionalTest` (`-nullrhi`, isolated `-abslog`) — #2 movement etc. green.
  (Lighting doesn't affect collision; this guards against map breakage.)
- Before/after screenshots (Movable-flat vs Stationary-baked).

### Part 5 — PoF app

One **knowledge tip** in the `level-design` module (`src/lib/module-registry.ts`)
documenting: Movable (headless, flat, no bake) vs Stationary/Static + Lightmass
bake (baked GI/shadows, needs a bake; black if unbaked); the per-PPV
GI-method-scoping trick (override GI method = None on a PostProcessVolume to
get baked GI in one level without flipping the project off Lumen); and the
headless `ResavePackages -buildlighting` command + the manual-bake fallback.
No other app change.

## Verification (of this session)

Passes when: `build_arena.py` packs a lightmap UV1; `SM_Arena` has
`light_map_coordinate_index=1`; lights are Stationary; the Lightmass Importance
Volume exists; the arena PPV scopes GI method to baked; the bake lands; the
Gemini check confirms a **lit, baked-shadowed** arena (not black); and the
functional test stays green. PoF: the lighting knowledge tip is added.

## Cross-cutting

- **Shared tree** ([[project_ue_shared_concurrency]]): use `-abslog` for the
  functional test; commit only this session's files; the per-PPV GI scoping is
  specifically to avoid forcing siblings onto baked GI. The global
  `DefaultEngine.ini` flip is the fallback only.
- **Full editor for Python** ([[arena polish findings]] lesson): the
  Interchange FBX re-import needs `-ExecutePythonScript` (full editor), not the
  `-run=pythonscript` commandlet. `build_arena_ue.py` self-quits.
- Repos: `build_arena.py`, `build_arena_ue.py`, the rebuilt assets, and any
  `DefaultEngine.ini` change → UE repo (`xkazm04/pof-exp`). The knowledge tip +
  spec/plan/findings → app repo (`xkazm04/pof`, local-only, do NOT push).

## Definition of done

1. `build_arena.py` packs a non-overlapping lightmap into UV1; FBX re-exported.
2. `build_arena_ue.py`: `SM_Arena` lightmap channel 1 + resolution; lights
   Stationary; Lightmass Importance Volume spawned; arena PPV GI method → baked
   (read-back confirmed).
3. The Lightmass bake lands (headless, or the documented manual fallback).
4. Gemini confirms the arena is **lit (not black) with baked soft shadows**.
5. The PS-1 functional test re-runs green.
6. PoF: the lighting/bake knowledge tip is added.
7. Findings doc under `docs/features/arpg-vertical-slice/scenario-runs/`;
   committed (scripts/assets → UE repo, docs/app → app repo).

**Success criterion:** the slice arena shows baked GI + baked soft shadows
(richer than the flat Movable look), gameplay provably intact, siblings still
on Lumen, and PoF documents the static-vs-movable + bake workflow.

## Risks & mitigations

- **Black arena (the PS-2 failure).** Stationary lights + no successful bake =
  black. Mitigation: the bake MUST land before any screenshot; Part 4 gates on
  Gemini "lit, not black". If the headless bake fails and the manual fallback
  isn't run, do NOT declare success — report the bake as the blocker.
- **Headless bake may not work.** `ResavePackages -buildlighting` /
  `-AllowCommandletRendering` is finicky (needs Swarm, commandlet rendering).
  Mitigation: documented manual-editor-bake fallback; the user accepted a
  possible manual step.
- **Per-PPV GI override may not be honored** in UE 5.7. Mitigation: read-back
  canary; fall back to the global `DefaultEngine.ini` GI flip (then siblings
  are affected — accepted as the fallback).
- **Lightmap UV overlap → bake splotches.** `lightmap_pack` on the joined mesh
  gives non-overlapping islands; a low resolution (256) keeps the bake fast;
  verify by the Gemini "clean shadows, no blotches" read.
- **Shared-tree bake races.** A sibling re-saving VerticalSlice could discard
  baked data (lighting is stored in the map/built-data). Mitigation: bake +
  screenshot promptly; note in findings; the baked-data package
  (`VerticalSlice_BuiltData.uasset`) is committed.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews + approves.
3. `writing-plans` → implementation plan.
4. Execute: lightmap UV → Stationary + importance volume + PPV GI scope →
   bake → verify.
