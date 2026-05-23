---
date: 2026-05-23
status: draft
sub_project: 06-TM (textures & materials — Leonardo PBR pipeline, master materials, 3D-texture arena re-texture)
parent_initiative: PoF improvements — docs/improvements/06-textures-materials/
branch: parallel CLI #6 of 8 (textures & materials)
predecessor_docs:
  - docs/improvements/06-textures-materials/README.md
  - docs/improvements/06-textures-materials/pof-app.md
  - docs/improvements/06-textures-materials/game.md
  - docs/improvements/06-textures-materials/tests.md
---

# 06-TM: Leonardo PBR pipeline + master materials + arena 3D-texture re-texture

Implements all three slices of the `06-textures-materials` improvement
folder, sequenced A → B → C (A enables C; B is how C's PBR set is applied).

## Context

The vertical-slice arena (PS-2/PS-3) is textured but its weakest point: PS-3
swapped *albedo only* (Leonardo `tiling:true`), kept PolyHaven normal/rough,
and the cube-projection UVs tile to a grid. The enemy `M_EnemyRed` is a one-off
`Material`. PoF's Leonardo integration (`src/lib/leonardo.ts`) is minimal —
Lucid Origin only, 512×512, **and it leaks generations** (no
download-then-delete, violating the `leonardo-generation-cleanup` memory). The
project ships an unused `Source/PoF/Materials/ARPGMasterMaterialConfig` and the
`material-configurator.ts` prompt builds master-material *instructions*, not
real assets. Leonardo's advanced API (the 3D-texture-on-OBJ endpoint, tiling,
transparency, upscaler) is documented in the `leonardo-api-capabilities` memory
but mostly unused.

## Goals

1. **Part A** — a real Leonardo PBR pipeline in PoF: download-then-delete on
   every generation; advanced generation options (model/tiling/transparency);
   the Universal Upscaler; and the **3D-texture-on-OBJ endpoint**.
2. **Part B** — a real `M_ARPG_Surface_Master` UE material; `M_Arena_*` and
   `M_EnemyRed` reparented as instances of it; the `material-configurator`
   prompt emits instances + carries the Constant3Vector gotcha.
3. **Part C** — re-texture `SM_Arena` via the 3D-texture endpoint (a coherent
   per-mesh PBR set), applied through the master material; honest A/B vs PS-3.

## Non-goals

- No geometry / level / lighting / UV-strategy change — that is branch #5
  (environment). Part C reads `SM_Arena`'s existing UVs as-is.
- No edits to the shared Blender scripts (`Content/Python/build_arena.py`,
  `build_arena_ue.py`) — branch #5 owns those. Part C uses **new, separate**
  scripts so the two branches don't collide.
- No edit to the shared gotchas pack / `module-registry.ts` /
  `prompt-context.ts` — that is branch #1 (generation-quality). The
  Constant3Vector gotcha is applied **locally in `material-configurator.ts`**
  here; the central gotchas-pack entry is branch #1's.
- No audio (deferred), no gameplay/HUD/character change.

## Parallel-CLI isolation contract

This branch (#6) touches only:
- PoF app: `src/lib/leonardo.ts`, `src/app/api/leonardo/route.ts`,
  `src/lib/prompts/material-configurator.ts`,
  `src/components/modules/content/materials/` (new tiles only),
  `src/__tests__/` (new test files under a `leonardo/` + `materials/` subdir).
- UE project: `Content/Materials/` (the master material + MIs),
  `Content/Python/build_master_material.py` (new),
  `Content/Python/export_arena_obj.py` (new),
  `Content/Python/retexture_arena_3d.py` (new). It does **not** edit
  `build_arena.py` / `build_arena_ue.py` / `setup_characters_ue.py` (those are
  branches #5 / #2). `M_EnemyRed`'s reparent is done by a new script, not by
  editing `setup_characters_ue.py`.

## Design

### Part A — Leonardo PBR pipeline (PoF app)

Extend `src/lib/leonardo.ts` (keep the existing `generateImage` signature
working; add capability):

1. **`deleteGeneration(id)`** and a `downloadThenDelete` wrapper. Every
   generation path (`generateImage`, the new texture path) deletes its
   generation after the image bytes are retrieved. The existing `generateImage`
   currently returns a URL and leaves the generation — fix it to optionally
   download + delete (a `cleanup?: boolean` option, default true). This closes
   the leak the `leonardo-generation-cleanup` memory mandates.
2. **`generateImage(prompt, opts?)`** — `opts` adds `modelId` (default Lucid
   Origin; `LUCID_REALISM_MODEL_ID = '05ce0082-2d80-4a2d-8653-4d1c85e2418e'`
   for surfaces), `width`/`height`, `tiling`, `transparency`, `contrast`,
   `num_images`. Backward-compatible (string-only call still works).
3. **`upscaleImage(imageId, style)`** — `POST /universal-upscaler`.
4. **`generateTextureOn3DModel({ objBytes, prompt, preview? })`** — the
   3-step endpoint from the `leonardo-api-capabilities` memory:
   `POST /models-3d/upload` (presigned URL + modelAssetId) →
   `PUT <presigned>` the OBJ bytes → `POST /generations-texture` →
   poll `GET /generations-texture/{id}` → return the PBR map URLs (albedo /
   normal / roughness per the memory) → delete the texture job. Returns
   `{ albedoUrl, normalUrl?, roughnessUrl? }` or a clear failure.
5. **`src/app/api/leonardo/route.ts`** — extend to accept a `mode` field
   (`image` | `upscale` | `texture3d`) routing to the right function; keep the
   existing prompt-only POST working.
6. Tests (`src/__tests__/leonardo/`): vitest snapshots of each request body
   shape; a `downloadThenDelete` protocol test asserting every generation path
   issues a `DELETE`.

### Part B — master material (game + PoF)

**Game (UE Python, new `Content/Python/build_master_material.py`):**
Create `/Game/Materials/M_ARPG_Surface_Master` via `MaterialFactoryNew` +
`MaterialEditingLibrary`:
- `TextureSampleParameter2D` Albedo → Base Color, Normal (`SAMPLERTYPE_NORMAL`)
  → Normal, Roughness (`SAMPLERTYPE_LINEAR_GRAYSCALE`) → Roughness.
- A `TextureCoordinate` × a `ScalarParameter` `TilingScale` driving all
  samplers' UVs.
- A `VectorParameter` `BaseColorTint` (default white) multiplied into albedo,
  and a `ScalarParameter` `EmissiveStrength` × tint → Emissive (for the enemy).
- Constant3Vector pin gotcha: any `Constant3Vector` uses output pin `""` not
  `"RGB"` (see the `material-configurator` prompt update).
Then reparent: rebuild `M_Arena_Floor/Wall/Pillar` and `M_EnemyRed` as
`MaterialInstanceConstant`s of the master (a new
`Content/Python/reparent_materials.py` — does NOT edit the branch-5/2 scripts),
setting the per-instance texture + tint params to match today's look (no visual
change yet).

**PoF (`material-configurator.ts`):** add the Constant3Vector gotcha to the
prompt's best-practices ("`Constant3Vector` output pin is `\"\"`, not
`\"RGB\"`"); prefer emitting `MaterialInstanceConstant` of a shared master over
one-off materials. A vitest snapshot guards both.

### Part C — arena re-texture via the 3D-texture endpoint (game + PoF)

1. **`Content/Python/export_arena_obj.py`** (new) — loads `SM_Arena`, exports a
   UV-mapped OBJ to `Content/ArenaBuild/Arena.obj` (UE's
   `unreal.EditorStaticMeshLibrary` / a mesh-export helper; or, if UE OBJ
   export is impractical, re-export from the Blender source headlessly via a
   new throwaway Blender call that imports the existing FBX and exports OBJ —
   without touching branch #5's `build_arena.py`).
2. **PoF** — a small runner (a script or a `materials/` UI tile) calls
   `generateTextureOn3DModel` (Part A) with the arena OBJ + a "dark fantasy
   dungeon stone" prompt; downloads the PBR maps to
   `Content/ArenaBuild/textures_3d/`; deletes the Leonardo job.
3. **`Content/Python/retexture_arena_3d.py`** (new) — imports the PBR maps as
   UE textures under `/Game/ArenaBuild/Textures3D/`; creates
   `MI_Arena_3D` instances of `M_ARPG_Surface_Master`; applies them to
   `SM_Arena`'s slots.
4. **Honest fallback:** if the 3D-texture endpoint fails, returns no usable
   maps, or the Gemini A/B judges it *worse* than PS-3's tiled textures, keep
   PS-3's textures (revert the slot assignment) and record the finding. Part B's
   master-material refactor stands regardless.

### Verification

- **Part A:** vitest green (request shapes + download-then-delete). A live
  one-shot smoke (a `tiling:true` generation) downloads + deletes (verified: no
  leftover on the account).
- **Part B:** PS-1 functional test still green (materials are visual — no
  gameplay impact); Gemini confirms the arena + enemy look unchanged after the
  reparent (a refactor, not a re-skin).
- **Part C:** Gemini A/B compares the 3D-endpoint result against PS-3's tiled
  result on the same arena view; record which reads better; apply the winner.

## Cross-cutting

- **Branch:** PoF app repo `master` (this repo, parallel CLI #6); UE project
  repo `github.com/xkazm04/pof-exp`.
- Leonardo API consumes credits; download-then-delete keeps the account clean.
- All Leonardo generations download-then-delete (the `leonardo-generation-cleanup`
  feedback memory).

## Definition of done

1. `src/lib/leonardo.ts` extended (download-then-delete + advanced options +
   upscaler + 3D-texture endpoint); route updated; vitest green.
2. `M_ARPG_Surface_Master` exists; `M_Arena_*` + `M_EnemyRed` are instances of
   it; PS-1 functional test green; no visual regression (Gemini).
3. The arena 3D-texture pass run; the better of (3D-endpoint, PS-3) applied;
   the choice recorded with the Gemini A/B read.
4. `material-configurator.ts` carries the Constant3Vector gotcha + emits
   instances; vitest snapshot green.
5. A findings doc under `docs/improvements/06-textures-materials/runs/`.
6. Committed (PoF app repo + UE repo); chat summary.

**Success criterion:** PoF can generate PBR textures (2D tiling + per-mesh 3D)
via Leonardo with proper cleanup; the project's materials are consolidated on a
parameterised master; and the arena is re-textured with the best available PBR
set — all without disturbing the parallel branches.

## Risks & mitigations

- **3D-texture endpoint is "legacy"-flagged / OBJ-only / result-format
  uncertain.** Part C is explicitly exploratory with a documented fallback to
  PS-3's textures. Worst case: Parts A+B still ship value (the pipeline + the
  master material), and Part C records "endpoint not usable" as a finding.
- **UE OBJ export of `SM_Arena` may be awkward** (UE favours FBX). Mitigation:
  fall back to a throwaway headless Blender import-FBX→export-OBJ (new script,
  not branch-5's).
- **MaterialEditingLibrary graph authoring is fiddly** (the Constant3Vector
  pin, normal sampler types). Mitigation: mirror PS-2/PS-3's working
  `build_arena_ue.py` material code (read it, don't edit it).
- **Parallel-CLI collisions.** Mitigated by the isolation contract above — new
  files only on the shared-script paths; local-only prompt edit.

## Next steps after this spec

1. Spec self-review (inline).
2. `writing-plans` → implementation plan (the user has pre-approved "do all 3 +
   continue"; proceed without a separate gate, but the spec is committed for
   review-in-flight).
3. Execute A → B → C via subagent-driven development.
4. Findings + commit.
