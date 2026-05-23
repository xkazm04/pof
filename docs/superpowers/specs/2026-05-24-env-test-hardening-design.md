---
date: 2026-05-24
status: draft
sub_project: Environment — test hardening (improvements folder 05, tests.md)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/tests.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-arena-polish.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-dungeon.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-biome-scatter.md
---

# Environment — Test Hardening

## Context

Folder-05 built the arena (re-UV, Lightmass, post-process, fog), the procedural
dungeon, the UV dropdown, and the biome→scatter pipeline — but the environment
has thin automated coverage (one `AProcGenWalkTest` + the PoF unit tests). This
piece adds the feasible, valuable subset of tests.md to lock those changes in
against regression.

### What exists (verified)

- `Source/PoF/Test/`: `AARPGFunctionalTestBase` (phased Tick; `GetPlayerCharacter`,
  `GetFirstEnemy`, `ApplyDamage`, `GetHealth`, `WaitForCondition`, `RunPhase`,
  `OnTestStarted`, `GetPhaseTime`); `VSFunctionalTest` (`: AFunctionalTest`,
  open-coded phases, `AddMovementInput` movement at #2); `Environment/ProcGenWalkTest`
  (`: AARPGFunctionalTestBase`, traversal). Tests run via `Automation RunTests`
  on a map, headless `-nullrhi`.
- The arena (`build_arena.py`): floor 20 m (top z=0), 4 walls at ±10 m
  (±1000 uu after import), 4 corner pillars. `SM_Arena` collision
  `CTF_USE_COMPLEX_AS_SIMPLE` (the player capsule stands on it — proven by
  VSFunctionalTest #2). VerticalSlice has a DirectionalLight + SkyLight + the
  session-1 `Arena_PostProcess` PostProcessVolume + the scatter actor.
- PoF: the `level-design` module's `knowledgeTips` include the FBX-scale
  (`import_uniform_scale=1.0`) guidance; `TaskFactory.procgenDungeon` +
  `TaskFactory.scatterBiome` are the §4 dispatch surface.

### Feasibility of the tests.md items

- Arena collision / bounds → feasible (physics + movement, headless). ✓
- Lighting-present (luminance) → **infeasible headless** (`-nullrhi`, no render).
  Reframed to a setup-invariant (lights + PPV present).
- Level-gen smoke → **already covered** by `AProcGenWalkTest` (≥2 rooms +
  traversal); not re-built here.
- UV-strategy prompt vitest → **already done** (`uv-strategy.test.ts`).

## Goals

1. Catch a regression where re-UV / re-export / scatter breaks the arena floor
   collision or wall bounds, headlessly.
2. Catch deletion of the arena's lights / post-process volume, headlessly.
3. Guard the PoF FBX-scale knowledge tip + the §4 dispatch surface with vitests.
4. No regression to `VSFunctionalTest`.

## Non-goals

- No real-luminance lighting test (render-dependent; the Gemini check covers
  the visual "not black").
- No new level-gen smoke test (AProcGenWalkTest covers it).
- No new gameplay/feature behavior — tests only.

## Decision record (from brainstorming)

1. **Subset = arena C++ tests (collision + bounds + setup) + 2 PoF vitests**
   (chosen over collision+bounds-only and vitest-only).
2. `AVSArenaSetupTest` (lights + PPV **present**) is the headless reframe of
   "lighting-present" (vs. real luminance).
3. The bounds test asserts **"moved toward the wall but stayed inside the
   arena"** (vs. a stricter exact-stop position).

## Design

### Part 1 — UE C++ tests (`Source/PoF/Test/Environment/`, one recompile)

1. **`AVSArenaCollisionTest : AFunctionalTest`** — `StartTest` spawns 5
   `AStaticMeshActor` physics probes (engine `Sphere`, Movable,
   `SetSimulatePhysics(true)`, BlockAll) at z=300 over center + (±600,±600);
   record refs. `Tick`: after ~2.5 s settle, `AssertTrue` each probe's
   `GetActorLocation().Z > 0` (rested on the floor, didn't fall through);
   `FinishTest`. (No player needed → extends `AFunctionalTest` directly.)
2. **`AVSArenaBoundsTest : AARPGFunctionalTestBase`** — `Phases = {"WalkIntoWall"}`;
   `OnTestStarted` records the player start + picks the +X wall (~+1000 uu).
   `RunPhase`: `AddMovementInput(FVector::ForwardVector)` each tick; after ~4 s,
   `AssertTrue(playerX > startX && playerX < 1000.f)` — moved toward the wall
   but the wall blocked it inside the arena; `Advance`.
3. **`AVSArenaSetupTest : AFunctionalTest`** — `StartTest` iterates
   `TActorIterator` for `ADirectionalLight`, `ASkyLight`, `APostProcessVolume`;
   `AssertTrue(count >= 1)` for each; `FinishTest`. (No tick.)

All three set `LogWarningHandling = OutputIgnored` (gray-box warnings aren't
failures) + a `TimeLimit`. They reparent to the established patterns.

### Part 2 — PoF vitests (no recompile)

4. **`src/__tests__/registry/level-design-knowledge.test.ts`** — load the
   `level-design` module from `module-registry`, assert its `knowledgeTips`
   contain an entry whose `content` includes `import_uniform_scale=1.0`.
5. **`src/__tests__/lib/cli-task-leveldesign-surface.test.ts`** — assert
   `typeof TaskFactory.procgenDungeon === 'function'` and
   `typeof TaskFactory.scatterBiome === 'function'`, and that each produces a
   task with the expected `type` (`procgen-dungeon` / `biome-scatter`).

## Verification (of this session)

- Recompile (`Build.bat PoFEditor Win64 Development`); DLL mtime confirmed
  newer than the edits (no live editor locking it).
- Each new C++ test green via `UnrealEditor-Cmd … -ExecCmds="Automation RunTests
  Project.Functional Tests.Maps.VerticalSlice.<TestName>;Quit" -nullrhi
  -abslog="<own path>"` → `Result={Success}`.
- `VSFunctionalTest` still green (no regression from the new test classes).
- vitests 4 + 5 green; full `npm run test` green; typecheck/lint clean.

## Cross-cutting

- Repos: C++ tests → UE repo; vitests → app repo (local). Commit narrowly
  (shared tree). **Never broad-kill processes** ([[no-broad-process-kill]]) —
  no live UE launches needed beyond the headless test runner (no `/IM`).
- The C++ recompile: confirm no live `UnrealEditor.exe` locks
  `UnrealEditor-PoF.dll`; verify via DLL mtime ([[ue-shared-concurrency]]).
- Test names: `AVSArenaCollisionTest`, `AVSArenaBoundsTest`, `AVSArenaSetupTest`
  — the automation framework auto-discovers `AFunctionalTest`s placed in the
  map. **These tests must be placed in VerticalSlice** (like the other
  functional tests) to be discovered — add them via a small idempotent Python
  placement (mirroring how `AProcGenWalkTest` was baked into ProcGenDungeon),
  OR confirm the runner discovers class instances spawned at runtime. (Plan
  resolves the exact placement mechanism.)

## Definition of done

1. `AVSArenaCollisionTest`, `AVSArenaBoundsTest`, `AVSArenaSetupTest` exist +
   compile + are placed in VerticalSlice + each runs `Result={Success}`.
2. `VSFunctionalTest` still green.
3. The 2 PoF vitests green; full suite green; typecheck/lint clean.
4. Findings doc; committed (C++ + placement → UE repo; vitests + docs → app
   repo local).

**Success criterion:** the arena's floor collision, wall bounds, and
lighting/PP setup are guarded by headless functional tests, and the §4 dispatch
surface + FBX-scale tip are guarded by vitests — so a future re-UV / re-export /
scatter / refactor that breaks them fails CI deterministically.

## Risks & mitigations

- **Physics probes fall through / never settle.** Mitigation: generous settle
  (~2.5 s) + assert `Z > 0`; the player capsule already proves the floor blocks,
  so a probe-specific failure points to the probe's collision profile (fix the
  spawn). If probes legitimately fall through, that's a real regression the test
  rightly catches.
- **Test placement/discovery.** `AFunctionalTest`s are discovered when present
  in the loaded map. Mitigation: bake the three actors into VerticalSlice via an
  idempotent Python placement (the plan specifies it), as `AProcGenWalkTest` was
  placed in ProcGenDungeon.
- **Bounds-test wall axis/position.** Mitigation: read the exact wall coords
  from `build_arena.py` (±1000 uu); assert against the confirmed value; the
  no-collision scatter doesn't interfere.
- **Recompile** (heaviest) — sibling-tree safe (check no live editor; DLL mtime;
  commit C++ narrowly).
- **Shared VerticalSlice** — placing test actors re-saves the umap; commit it
  best-effort, with the placement script as the durable artifact.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews + approves.
3. `writing-plans` → implementation plan.
4. Execute: C++ tests → recompile → place in map → run each → vitests → verify.
