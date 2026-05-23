---
date: 2026-05-23
status: draft
sub_project: Environment — biome → scatter pipeline (improvements folder 05, pof-app §4 rest / game.md §4)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/pof-app.md   # §4 biome editor
  - docs/improvements/05-environment/game.md       # §4 environment props (scatter)
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-driver-panel.md  # the driver-panel pattern this mirrors
---

# Environment — Biome → Scatter Pipeline

## Context

Folder-05 sessions shipped the arena, lighting, procedural dungeon, the UV
dropdown, and the procgen driver panel. This piece wires the project's existing
**vegetation/scatter** scaffolding end-to-end and surfaces it in PoF, delivering
both pof-app §4's "biome editor" value and game.md §4's "environment props"
value (they are the same system).

### What exists (verified by reading the source)

- `UARPGBiomeDefinition` (`Source/PoF/LevelDesign/ARPGBiomeDefinition.h`) — a
  `UPrimaryDataAsset` of **vegetation + scatter rules**: `Vegetation[]`
  (`FBiomeVegetationEntry`) and `ScatterLayers[]` (`FBiomeScatterLayer`: a
  `TArray<TSoftObjectPtr<UStaticMesh>> Meshes`, `DensityPer100Sq`, scale/slope/
  spacing, `bAlignToSurface`) + `GlobalDensityMultiplier`. (pof-app.md §4
  inaccurately called this "floor/wall/pillar mesh + lighting" — it is NOT.)
- `AARPGVegetationScatter` (`…/ARPGVegetationScatter.h/.cpp`) — a **complete,
  real** placeable actor: `GenerateVegetation()` (BlueprintCallable) instances
  meshes via `UHierarchicalInstancedStaticMeshComponent`s, tracing `ECC_Visibility`
  against world geometry within a `ScatterBounds` box, respecting slope/altitude/
  spacing; `GetTotalInstanceCount()`. Protected props: `BiomeDefinition`,
  `ScatterBounds` (UBoxComponent), `RandomSeed`, `LocalDensityMultiplier`,
  `bGenerateInEditor`, `bGenerateOnBeginPlay`, `TraceChannel`, `ExclusionVolumes`.
  It is referenced **nowhere** — never placed.
- PoF dispatch pattern (from the driver panel): `useModuleCLI` + a `CLITask`
  whose prompt runs a UE Python script via `-ExecutePythonScript` and reports
  via `@@CALLBACK` → an API route persisting the result; a panel reads it.

## Goals

1. Author a `BiomeDefinition` (one scatter layer, placeholder engine meshes) and
   place a real `AARPGVegetationScatter` over the VerticalSlice arena floor so
   greybox props visibly populate it.
2. Surface it in PoF: a "Scatter (UE)" tab with density + seed inputs + a
   Generate button that dispatches the scatter run and shows the instance count.
3. Keep `VSFunctionalTest` green — scatter instances are **no-collision**.

## Non-goals

- No Blender-authored rock meshes (engine basic shapes as placeholders;
  real meshes are a follow-up).
- No room-template-FBX generator (needs C++ to make `BlockoutRoom` render
  template meshes — deferred).
- No vegetation-vs-scatter distinction beyond one scatter layer; no exclusion
  volumes, no per-room props.
- The live click→CLI→UE→callback completion is operator-/CI-out-of-scope (the
  generic CLI leg, as with the driver panel); the script + route are proven
  directly + unit-tested.

## Decision record (from brainstorming)

1. **Scope = biome→scatter end-to-end, placeholder meshes** (chosen over the
   data-only biome UI, the Blender-rock variant, and the room-template editor).
2. **Approach A** — full pipeline mirroring the driver panel (UE script +
   `biome-scatter` CLITask + scatter-result route/db + panel/tab).
3. **Scatter into VerticalSlice** (the "break up the arena floor" intent) with
   **no-collision** instances (keeps VSFunctionalTest safe).
4. **New "Scatter (UE)" tab** (single-purpose, like the Dungeon (UE) tab).
5. Env-var params (`SCATTER_DENSITY`, `SCATTER_SEED`), matching the procgen
   script's convention.

## Design

### Part 1 — UE: `Content/Python/scatter_biome_ue.py`

Idempotent script (run via the full editor `-ExecutePythonScript`, self-quits):
1. **Author the biome** `/Game/Level/Biomes/BD_ArenaRubble` (load-or-create via
   `DataAssetFactory`, `data_asset_class = unreal.ARPGBiomeDefinition`):
   `biome_id`, one `FBiomeScatterLayer` (`unreal.BiomeScatterLayer`) with
   `meshes = [load /Engine/BasicShapes/Cube, /Engine/BasicShapes/Cylinder]`,
   `density_per100_sq ≈ 0.15`, `min_scale/max_scale` ≈ 0.3/0.7 (small props),
   `min_spacing ≈ 150`, `b_align_to_surface = True`, slope 0-60; save.
2. **Place the scatter actor** in `/Game/Maps/VerticalSlice` (load_level → bind):
   destroy any prior `AARPGVegetationScatter` (idempotent); spawn one at
   `(0,0,200)`; set `BiomeDefinition`, `RandomSeed = SCATTER_SEED`,
   `LocalDensityMultiplier = SCATTER_DENSITY`, `bGenerateInEditor/OnBeginPlay`
   as needed; set its `ScatterBounds` box extent ≈ `(1000,1000,200)` (covers the
   ~20 m floor, spanning above/through it for downward traces).
3. **Generate** `scatter.generate_vegetation()`; read `get_total_instance_count()`.
4. **Force no-collision**: for each `HierarchicalInstancedStaticMeshComponent` on
   the scatter actor, `set_collision_enabled(NO_COLLISION)` so the player passes
   through (VSFunctionalTest safe); re-save the level.
5. Log the instance count + `Persisted after reload` count (mirroring procgen).

Env params: `SCATTER_DENSITY` (float, default 1.0), `SCATTER_SEED` (int, default
1337). Guard API-name risks (struct/enum names) with read-back + try/except, as
prior UE-Python sessions did.

### Part 2 — PoF: `biome-scatter` CLITask

In `src/lib/cli-task.ts`: add `'biome-scatter'` to `CLITaskType`; a
`BiomeScatterTask extends CLITask { density: number; seed: number; appOrigin }`;
`TaskFactory.scatterBiome(moduleId, { density, seed }, appOrigin, label)`; a
`buildTaskPrompt` case (modeled on `procgen-dungeon`): header + a Task section
telling Claude to set `SCATTER_DENSITY`/`SCATTER_SEED`, run
`scatter_biome_ue.py` via the full editor `-ExecutePythonScript`, read the
`Scattered N instances` log line, and `@@CALLBACK` →
`${appOrigin}/api/level-design/scatter-result` (staticFields `{ moduleId, seed }`,
schemaHint `"instanceCount": <int>`). Not in `WIRING_TASK_TYPES`.

### Part 3 — PoF: scatter-result route + db

- `src/lib/scatter-db.ts` — `scatter_runs (id, instance_count, seed, created_at)`
  with `recordScatterRun({ instanceCount, seed })` / `getLatestScatterRun()`
  (lazy `ensureScatterTable()`; mirrors `procgen-db.ts`).
- `src/types/procgen.ts` — add `ScatterRun { id, instanceCount, seed, createdAt }`
  (co-located with `ProcgenRun`).
- `src/app/api/level-design/scatter-result/route.ts` — POST records, GET returns
  latest (mirrors `procgen-result`).

### Part 4 — PoF: `BiomeScatterPanel` + new tab

`src/components/modules/content/level-design/BiomeScatterPanel.tsx` — density
(clamp 0.1-3, default 1) + seed (default 1337, + randomize) inputs, a "Scatter
Props (UE)" button (`useModuleCLI.execute(TaskFactory.scatterBiome(...))`,
disabled while running), and a result line from `GET /api/level-design/
scatter-result` (refetch when a run finishes). `LevelDesignView.tsx`: a new
"Scatter (UE)" `TabButton` + conditional render (after the Dungeon (UE) tab),
a `scatterCli = useModuleCLI({ sessionKey: 'level-design-scatter-ue', … })`,
and `handleScatter(density, seed)`. Reuse module tokens.

## Verification (of this session)

- **UE (I run directly):** `SCATTER_DENSITY=1 SCATTER_SEED=7
  UnrealEditor.exe … -ExecutePythonScript=scatter_biome_ue.py` → log
  `Scattered N instances` with **N > 0**; Gemini check on a real-launch
  screenshot ("are greybox boxes/props scattered across the arena floor?").
- **VSFunctionalTest still green** (`-abslog`) — no-collision scatter doesn't
  block the player.
- **vitest:** `buildTaskPrompt` for `biome-scatter` (env vars + run command +
  `@@CALLBACK` + scatter-result URL); `scatter-db` (record/latest, in-memory
  mock of `@/lib/db`).
- typecheck/lint clean; full suite green.
- **Live (Playwright):** the "Scatter (UE)" tab renders, reads a seeded run, and
  the button dispatches a CLI session (like the driver panel). A committed
  CI-safe spec asserts render + API-read + button (no Generate click).
- **Honest gap:** the live CLI→UE→callback completion is operator-verified.

## Cross-cutting

- Repos: `scatter_biome_ue.py` → UE repo; everything else → app repo (local).
- **Shared tree** ([[ue-shared-concurrency]]): stage by name; reviewers diff
  single commits; re-read shared files before edit. **Never broad-kill
  processes** ([[no-broad-process-kill]]) — for screenshots/UE, kill only my own
  PID; leave the dev server for the user.
- Conventions: `@/` imports; `logger`; no hardcoded hex; API envelope;
  relative `/api/...`; `getAppOrigin()` for the callback URL.

## Definition of done

1. `scatter_biome_ue.py` authors `BD_ArenaRubble` + places a no-collision
   `AARPGVegetationScatter` over the arena + generates; proven by a direct run
   with `instance count > 0`.
2. `biome-scatter` CLITask + `TaskFactory.scatterBiome` + `buildTaskPrompt` case.
3. `scatter-db` + `/api/level-design/scatter-result` (POST/GET) + `ScatterRun`.
4. `BiomeScatterPanel` in a new "Scatter (UE)" tab; Generate dispatches; result
   line shows the latest run.
5. vitest (prompt + db) green; typecheck/lint clean; full suite green;
   VSFunctionalTest green; Gemini confirms props on the floor.
6. Findings doc; committed (script → UE repo, app → app repo local).

**Success criterion:** from the PoF level-design UI, an operator triggers a real
`AARPGVegetationScatter` run that populates the arena floor with greybox props
(no-collision, gameplay intact), with the instance count returned to the panel —
turning the unused scatter scaffolding into an in-app capability.

## Risks & mitigations

- **Scatter places 0 instances** (trace misses the floor / bounds wrong).
  Mitigation: bounds span above+through the floor for downward `ECC_Visibility`
  traces; the SM_Arena floor has collision; verify by `instance count > 0` (the
  gate). If 0, adjust bounds Z / density and re-run.
- **VSFunctionalTest breaks** (scatter blocks the player). Mitigation:
  no-collision HISM (Part 1 step 4) + re-run the test as a gate.
- **UE-Python API names** (`BiomeScatterLayer` struct fields, `DataAssetFactory`,
  `generate_vegetation`, `get_total_instance_count`, HISM collision enum).
  Mitigation: read-back + try/except guards, as prior sessions; a wrong name
  raises and is fixed on the first run.
- **DataAssetFactory create-after-delete returns None** (seen in the procgen
  script). Mitigation: load-or-create the biome asset (don't delete+create).
- **Shared VerticalSlice** — a sibling could re-save the level. Mitigation:
  commit promptly; the durable artifact is the idempotent `scatter_biome_ue.py`.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews + approves.
3. `writing-plans` → implementation plan.
4. Execute: scatter script → CLITask → route+db → panel+tab → verify.
