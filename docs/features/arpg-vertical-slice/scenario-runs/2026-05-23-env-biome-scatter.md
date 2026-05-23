# Environment — Biome → Scatter Pipeline (folder-05, pof-app §4 / game.md §4)

**Date:** 2026-05-23
**Spec:** `docs/superpowers/specs/2026-05-23-env-biome-scatter-design.md`
**Plan:** `docs/superpowers/plans/2026-05-23-env-biome-scatter.md`

## What shipped

### UE repo (`xkazm04/pof-exp`)
- **`Content/Python/scatter_biome_ue.py`** — authors `/Game/Level/Biomes/BD_ArenaRubble`
  (one `FBiomeScatterLayer`, meshes = engine Cube + Cylinder placeholders, density
  0.15, scale 0.3-0.7, spacing 150, align-to-surface) + places an
  `AARPGVegetationScatter` over the VerticalSlice arena floor (bounds 1000³),
  `generate_vegetation()`, forces the HISM instances **no-collision**, saves.
  Env params `SCATTER_DENSITY` / `SCATTER_SEED`.

### PoF app (`xkazm04/pof`, local-only)
- **`cli-task.ts`** — `biome-scatter` task type + `TaskFactory.scatterBiome({density, seed})`
  + a `buildTaskPrompt` case (run the script via `-ExecutePythonScript` with the
  env vars, read `Scattered N instances`, `@@CALLBACK` → `/api/level-design/scatter-result`).
- **`scatter-db.ts` + `/api/level-design/scatter-result`** (POST/GET) + `ScatterRun` type.
- **`BiomeScatterPanel.tsx`** + a new **"Scatter (UE)" tab** in `LevelDesignView`
  (density + seed inputs, "Scatter Props (UE)" button via `useModuleCLI.execute`,
  result line "Last scatter: N instances").

## Verification

- **UE scatter (run directly, `SCATTER_SEED=7`):** `[scatter_biome] Biome
  BD_ArenaRubble: 1 scatter layer(s)`, **`Scattered 50 instances`**, `Scatter
  HISM set to NO_COLLISION`, `Persisted after reload: scatter actors=1`,
  `COMPLETE`. (Exit 3 = benign shutdown.)
- **VSFunctionalTest still green** (`-abslog`): `Result={Success}`, `#2 movement
  … 146.5cm`, `#5 loot found 1`, EXIT 0 — the no-collision scatter didn't break
  the player path.
- **Gemini (real-launch screenshot, HighresScreenshot00022):** "multiple small
  scattered objects/props (blocks, cylinders, debris) distributed across the
  floor" = **yes**; lit = yes; no artifacts. The previously-bare arena floor is
  populated.
- **vitest:** `scatter-db` (record/latest, in-memory) 2/2; `cli-task-scatter`
  (factory + `buildTaskPrompt` contains the env vars, the `-ExecutePythonScript`
  run, `@@CALLBACK`, `instanceCount`) 2/2.
- typecheck clean; lint 0 errors; full suite **1005 tests / 110 files** green.
- **Live (Playwright, `e2e/biome-scatter-panel.spec.ts`):** opens project →
  Content → Level Design → (select a doc) → **Scatter (UE)** tab; the panel
  renders "Biome Scatter (UE)", shows the seeded run "57 instances (seed 4242)"
  from the live route, and the Scatter button is present. CI-safe (self-seeds;
  does NOT click Scatter, so no `claude.exe` spawn).
- **Live CLI→UE→callback completion** is the generic CLI leg (operator-verified),
  same as the driver panel; its two ends are proven (the script + the route).

## Outcome

Closes pof-app §4's "biome editor" + game.md §4's "environment props" (they are
the same vegetation/scatter system). PoF now drives the previously-unused
`AARPGVegetationScatter` end-to-end: from the level-design UI an operator
triggers a real scatter run that populates the arena floor with no-collision
greybox props (gameplay intact), with the instance count returned to the panel.

## Notes / lessons

- **`UARPGBiomeDefinition` is vegetation/scatter rules**, NOT floor/wall meshes
  (pof-app.md §4 was inaccurate). `AARPGVegetationScatter` (a real, complete
  actor) is the consumer; it was never placed until now.
- **`bAlignToSurface` → Python `align_to_surface`** — the `b` bool prefix is
  dropped (same as `spawn_blockout_actors` / `override_*`). `b_align_to_surface`
  raised `Failed to find property`; fixed on the first run.
- No-collision was set by iterating the scatter actor's
  `HierarchicalInstancedStaticMeshComponent`s and calling
  `set_collision_enabled(NO_COLLISION)` after generation — keeps the player
  passing through (VSFunctionalTest safe).
- Process-kill safety: the screenshot launch killed only its own PID
  (`Start-Process -PassThru` → `taskkill /PID <pid> /T`), never `/IM`.

## Follow-ups (out of scope)

- Real Blender-authored rock/debris meshes (placeholders now).
- The room-template-FBX generator (needs C++ to make `BlockoutRoom` render
  template meshes).
- Scatter into the ProcGenDungeon rooms (not just the arena).
- A live e2e harness step that drives the in-app scatter dispatch to completion.
