# Stream 1 — Environment: Ancient Arena (design)

Date: 2026-06-24 · Extends `docs/parallel-development-plan.md` (Stream 1).

## Goal

A lit `Arena_Ancient` map that reads as an **ancient desert arena with a sandy floor**:
sandy floor material, ancient ruins (reusing existing pillars/walls), warm desert key +
cool sky (movable, **no Lightmass bake**), ExponentialHeightFog, an unbound PostProcess
volume, a `PlayerStart`, and a navmesh.

**Acceptance:** a headless `-game /Game/Maps/Arena_Ancient -RenderOffScreen` frame that the
agent **reads** and that shows the lit sandy arena. No "done" without that frame (project law,
see memory `project-llm-ue-interface`).

## Ground truth (verified 2026-06-24)

- UE project: `C:\Users\kazda\Documents\Unreal Projects\PoF`, repo `xkazm04/pof-exp`, branch
  `main` @ `3ffd972` (Phase 0 complete). Only the main worktree exists; no `feature/env-arena` yet.
- `Content/Maps/Arena_Ancient.umap` exists — a Phase-0 duplicate of the lit `VerticalSlice`.
- Existing arena assets in `Content/ArenaBuild/`: `SM_Arena` mesh + `M_Arena_Floor/Pillar/Wall`
  (+ `MI_*` in `Content/Materials/`) with albedo/normal/rough textures → pillars/walls already exist.
- Lit-arena recipe ready: `Content/Python/improve_arena_lighting.py` (movable warm key + cool sky
  + height fog + unbound post-process).

## Decisions (approved)

- **Isolation:** plan-strict git worktree (`../PoF-env`, branch `feature/env-arena` off `main`).
- **Sandy floor:** procedural parametric sand material (noise-driven), no external texture gen.
- Reuse the existing arena mesh + scatter a few ruins (no brand-new ruin mesh authoring).
- Copy the main project's compiled `Binaries/Win64` into the worktree (same commit = valid) to
  skip a full rebuild; clean bundled-dotnet UBT build only as fallback.

## Plan of work

1. **Worktree + build**: `git worktree add "../PoF-env" -b feature/env-arena main`. Verify Git LFS
   smudged binaries (`Arena_Ancient.umap` ≈129 KB, not a pointer). Copy `Binaries/Win64` from the
   main project; confirm the headless editor launches against `PoF-env/PoF.uproject`.
2. **Inspect baseline**: Python dump of `Arena_Ancient` actors + current floor material; baseline capture.
3. **Procedural sand material** `M_Sand_Floor` (+MI) under `Content/Environments/AncientArena/`:
   warm noise albedo, subtle normal/roughness, large tiling. **Set `used_with_static_lighting` /
   `used_with_skeletal_mesh` usage flags** (grey-fallback gotcha) + recompile. Assign to the floor.
4. **Ancient-ruins read**: reuse `SM_Arena` pillars/walls; scatter a few broken-pillar/rubble
   instances (engine shapes / duplicated arena pieces; no new imports).
5. **Lighting**: desert-tuned variant of `improve_arena_lighting.py` applied to `Arena_Ancient`
   (warm low key for long shadows, cool dim sky, height fog, unbound PP, auto-exposure −1).
6. **PlayerStart + navmesh**: ensure a `PlayerStart` + a `NavMeshBoundsVolume` over the play space.
7. **Save** via `LevelEditorSubsystem.save_current_level()` (no `new_level` — editing the existing map).
8. **Verify**: headless capture → read the frame; iterate until it reads as a lit sandy arena
   (watch for grey-fallback). Optional VLM critique (advisory). Commit content to `feature/env-arena`
   locally (user pushes; pushes 403 for the default git user — see memory `ue-project-git`).

## Risks

- Silent grey assets (usage-flag check mandatory before claiming a visual pass).
- LFS not smudging in the worktree (→ assets are pointer stubs; editor fails to load).
- Copied binaries refusing to launch (→ clean rebuild via bundled-dotnet UBT).
- Shader compile on first capture (expected; the sand material is new regardless).
