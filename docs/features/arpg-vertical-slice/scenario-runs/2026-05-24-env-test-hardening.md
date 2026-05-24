# Environment — Test Hardening (folder-05, tests.md: Arena C++ tests + PoF vitests)

**Date:** 2026-05-24
**Spec:** `docs/superpowers/specs/2026-05-24-env-test-hardening-design.md`
**Plan:** `docs/superpowers/plans/2026-05-24-env-test-hardening.md`

## What shipped

### UE repo (`xkazm04/pof-exp`)
- **`Source/PoF/Test/Environment/VSArenaCollisionTest.{h,cpp}`** — `AFunctionalTest`.
  Spawns 5 physics probes (engine Sphere, BlockAll) at z=300 over the arena
  centre + corners; after 2.5 s asserts every probe rested on the floor (Z>0).
  Guards arena floor collision.
- **`Source/PoF/Test/Environment/VSArenaBoundsTest.{h,cpp}`** — `AARPGFunctionalTestBase`.
  **Sweeps** the player capsule from a probe-free lane toward x=5000 and asserts
  the arena wall blocks it (blocking hit on the arena `StaticMeshActor`, swept
  >500 uu in, stopped <1500), then restores the player to spawn. Guards arena
  containment.
- **`Source/PoF/Test/Environment/VSArenaSetupTest.{h,cpp}`** — `AFunctionalTest`.
  Asserts ≥1 `DirectionalLight`, `SkyLight`, and `PostProcessVolume` exist
  (headless-safe "lighting configured" invariant; luminance/screenshots are
  impossible under `-nullrhi`).
- **`Content/Python/place_arena_tests.py`** — idempotently spawns the 3 test
  actors into `VerticalSlice` (functional tests are discovered by placement).
- **`Content/Python/scatter_biome_ue.py`** — `generate_on_begin_play=false` (bug
  fix, see below).
- **`Content/Maps/VerticalSlice.umap`** — the 3 placed test actors + re-baked
  no-collision scatter instances.

### PoF app (`xkazm04/pof`, local-only)
- **`src/__tests__/registry/level-design-knowledge.test.ts`** — guards the
  level-design knowledge tips that reach dispatch prompts: the
  `import_uniform_scale=1.0` (NOT 100) scale fix and the Lumen-vs-baked lighting
  note.

### Deliberately NOT shipped
- A `cli-task-leveldesign-surface.test.ts` was in the plan, but the
  procgen/scatter dispatch surface is **already** covered by the existing
  `cli-task-procgen.test.ts` + `cli-task-scatter.test.ts` (factory type strings,
  params, `buildTaskPrompt` body). Adding it would have duplicated coverage, so
  it was dropped.

## Bugs the hardening surfaced (and fixed)

1. **Scatter props had runtime collision** — `AARPGVegetationScatter` regenerates
   its HISM instances on `BeginPlay` (default `bGenerateOnBeginPlay=true`), which
   rebuilt them with **default collision** and discarded the edit-time
   `NO_COLLISION` pass. So the "gameplay-safe" props from the biome-scatter
   session actually blocked the player at runtime. The earlier
   `2026-05-23-env-biome-scatter.md` claim ("the no-collision scatter didn't
   break the player path") was only *partly* true — the player still moved, but
   was obstructed. **Fix:** `generate_on_begin_play=false` so the baked
   no-collision instances persist. Surfaced because the first bounds run stopped
   the player ~60 uu from spawn (on a prop) instead of at the wall.

2. **The walk-based bounds test passed trivially** — headless characters walk far
   too slowly (~40–160 uu/phase) to traverse the ~1300 uu to the +X wall within a
   phase, so the original `AddMovementInput` + "stayed <1000" assertion was
   satisfied without ever reaching the wall. **Fix:** rewrote it to sweep the
   capsule toward x=5000 and assert a real wall block (now stops at X≈934.7 against
   the arena mesh — a genuine containment check).

3. **Cross-test contamination (regression I introduced, then fixed)** — these
   functional tests share one world + player and run in sequence. The reworked
   bounds test left the player pinned against the wall, so `VSFunctionalTest`'s
   later walk leg failed (`moved 33.7cm < 50cm`). **Fix:** restore the player to
   its spawn at the end of the bounds phase. Documented inline as a gotcha for
   future shared-world functional tests.

## Verification

- **Full UE functional suite, headless** (`UnrealEditor-Cmd … VerticalSlice
  -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice;Quit"
  -nullrhi -abslog`): **8/8 `Result={Success}`, EXIT CODE 0**.
  - New: `VSArenaBoundsTest` (wall blocked the swept move, hit `StaticMeshActor_1`,
    X −300 → 934.7, contained <1500), `VSArenaCollisionTest` (5/5 probes rested,
    Z>0), `VSArenaSetupTest` (DirectionalLight 2, SkyLight 2, PostProcessVolume 1).
  - Regression: `VSCombatAbilityGrantTest`, `VSCombatGrayBoxPathTest`,
    `VSCombatHotbarTest`, `VSFunctionalTest`, `VSHUDFunctionalTest` — all green
    after the player-restore fix.
- **PoF vitest (new file):** 3/3 pass.
- **PoF vitest (full suite):** **111 files, 1008 tests, all passed** — no
  regressions. `typecheck` clean (only the pre-existing unrelated
  `leonardo.ts:208`).

## Commits
- UE (`pof-exp`, local): `6af491d` scatter no-collision at runtime ·
  `eb7bbe4` bounds test sweep + restore · `6603263` place tests + bake scatter
  (`a1200c9` had the initial C++).
- App (`pof`, local): `b950197` level-design knowledge-tip guard
  (`5bf64bc` had the plan).

## Headless-testing notes (for future env tests)
- `-nullrhi` runs physics + movement but **no rendering** — no screenshots, no
  luminance asserts. Test setup invariants by *actor presence*, not pixels.
- Functional tests share one PIE world + player and run in sequence. **Leave the
  world as you found it** (restore player position/velocity) or you'll break
  sibling tests.
- For containment/collision against far geometry, **sweep the capsule** rather
  than walking — deterministic, fast, and independent of headless move speed.
