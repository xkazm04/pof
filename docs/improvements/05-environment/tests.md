# 05 · Environment — Test Coverage

## What we have

- PS-2's verification: PS-1 functional test re-runs green (collision held,
  player didn't fall through), Gemini-vision confirmed the arena. PS-3
  re-ran the same after texture changes.
- No environment-specific functional tests yet.

## Tests to add — UE side (`AFunctionalTest`s)

1. **`AVSArenaCollisionTest`** — at five positions across the arena floor
   (centre + 4 corners), drops a small physics body from above; asserts
   each lands and rests on the floor (z > floor surface). Detects a
   regression where re-UVing or re-exporting the arena breaks collision.
2. **`AVSArenaBoundsTest`** — moves the player to the four perimeter
   walls; asserts the walls block movement (player did not pass through).
   Detects a regression where wall collision flips.
3. **`AVSLevelGeneratorSmokeTest`** — once [[game.md]] §3 lands, runs
   `ARPGLevelGenerator` with a fixed seed; asserts the resulting world has
   ≥ N spawned room actors and the player can reach at least one other
   room from the start. Snapshot of the deterministic seed catches
   regressions in the generator.
4. **`AVSLightingPresentTest`** — samples scene luminance at a few player
   positions; asserts it's above a "this is not a black screen" threshold.
   Detects the PS-2 black-arena class of failure (Static lights without
   bake) early, headlessly.

## Tests to add — PoF app side

1. **UV-strategy prompt test** — vitest snapshots the level-design
   module's arena-generation prompt; asserts the UV-strategy dropdown
   produces three valid Blender-script variants
   (cube-project / smart-project / world-aligned).
2. **FBX-import-scale gotcha test** — vitest asserts the env module's
   generated `build_arena_ue.py` template uses
   `import_uniform_scale = 1.0` (the corrected PS-2 value), not 100.0.
3. **`ARPGLevelGenerator` PoF surface test** — vitest asserts the
   `level-design` module exposes a "level-generator preview" panel and
   that the panel knows about the `BiomeDefinition` / `RoomTemplate` data
   asset paths.

## E2E harness extensions

1. **`environment-arena.spec.ts`** — fresh UE project, dispatch the
   arena-generation flow with `world-aligned` UV strategy; build; launch;
   Gemini-confirm: "no obvious grid; surfaces tile naturally; the scene
   is lit." End-to-end gate for a quality arena.
2. **`environment-level-gen.spec.ts`** — after [[game.md]] §3 lands,
   dispatch `LevelGenerator` with a fixed biome + seed; confirm the
   resulting level contains > 1 room and the PS-1 functional test passes
   in it.

## Lessons that motivate each test

- **PS-2's black-arena bug** — the lighting-present functional test makes
  the regression headless-catchable (you don't need Gemini to see "the
  screen is black").
- **PS-3's texture-grid look** — the UV-strategy prompt test guarantees
  PoF can always emit a non-grid variant, even if cube-project remains an
  option.
- **The 100× scale bug took an iteration to find.** The FBX-import-scale
  gotcha test stops that regression at prompt-generation time.
- **`ARPGLevelGenerator` is dead code** — the level-gen smoke test +
  PoF surface test together force the procedural-level scaffolding to
  remain wired as it gets built out.

## What this folder does *not* test

Texture / material content (folder 06), characters and AI (folder 02),
gameplay abilities (folder 03), HUD (folder 04), packaging (folder 07).
