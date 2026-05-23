# Environment — Arena Visual-Polish Pass (folder-05, session 1)

**Date:** 2026-05-23
**Spec:** `docs/superpowers/specs/2026-05-23-env-arena-visual-polish-design.md`
**Plan:** `docs/superpowers/plans/2026-05-23-env-arena-visual-polish.md`

## What shipped

### Game (UE repo `xkazm04/pof-exp`)
- **World-aligned planar UVs** in `Content/ArenaBuild/build_arena.py` — replaced
  `bpy.ops.uv.cube_project(cube_size=2.0)` with per-face world-aligned planar
  projection (floor→XY, N/S walls→XZ, E/W walls→YZ), `TILE_METERS = 8`; pillars
  keep `smart_project`. Geometry unchanged.
- **Material tiling 3.0 → 1.0** in `Content/Python/retexture_arena_ue.py` — the
  UVs now carry the real-world scale, so the `TextureCoordinate` is a
  pass-through. (Final repeat = `TILE_METERS` × `TILING` = 8 m.)
- **Post-process volume + height fog** in `Content/Python/build_arena_ue.py`
  (`add_atmosphere`) — unbound `APostProcessVolume` (auto-exposure clamp
  `[0.05, 1.5]` + EV bias `-1.5`, bloom 0.5, vignette 0.4, slight saturation) and
  `AExponentialHeightFog` (density 0.5, cool tint). Lights stay Movable.

### PoF app (`xkazm04/pof`, local-only)
- `src/lib/blender-mcp/scripts/uv-projection.ts` — reusable world-aligned-UV
  Blender-Python emitter (`worldAlignedUvScript`) + vitest (5 tests).
- `src/lib/module-registry.ts` — level-design knowledge tip baking in the
  FBX-scale=1.0 + world-aligned-UV gotchas.
- `e2e/fixtures/gemini-prompts/arena-check.txt` — added the
  grid-vs-continuous + atmosphere questions.

## Verification

### Gameplay (collision gate) — PASS
`Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`, headless
`-nullrhi`, isolated `-abslog`:

```
Result={Success}   EXIT CODE: 0
#2 movement: player should have moved >50cm, moved 531.9cm   PASS
#3 attack activation: melee ability should have activated     PASS
#4 damage: enemy Health < 100.0, is 80.0                      PASS
#5 death: enemy Health <= 0, is 0.0                           PASS
#5 loot: expected >= 1 AARPGWorldItem, found 1                PASS
```

The re-UV / re-export did **not** break collision — the player still stands on
and moves across the arena. `SM_Arena` box extent 1025×1025×260 uu confirms the
import scale stayed 1.0 (≈20 m, NOT 100× oversized).

### Visual (Gemini before/after) — PARTIAL

| Question | Before (`00016`) | After-untuned (`00017`) | After-tuned (`00018`) |
|---|---|---|---|
| Floor visible | yes | yes | yes |
| Enclosed arena | yes | yes | yes |
| Lit | yes | yes | yes |
| **Continuous (not a grid)?** | no (grid) | **no (grid)** | **no (grid)** |
| **Atmosphere / depth?** | no | **no** | **yes** ✓ |
| No artifacts | yes | yes | yes |

Screenshots: `img/env-arena-before.png`, `img/env-arena-after-untuned.png`,
`img/env-arena-after-tuned.png`.

## Honest outcome

- **Atmosphere: fixed.** The tuned pass (EV bias −1.5, fog density 0.5) flipped
  Gemini's atmosphere read from *no* → *yes*; the arena is now a dark, moody,
  hazy dungeon space instead of a flat bright box.
- **Grid: only partially fixed.** The cube-projection-*specific* faults are
  gone — the floor now has a single uniform world-aligned texture scale with no
  per-face seams and no harsh ~10× repeat. But the floor still reads as a
  **repeating tiled grid** to both the eye and Gemini, because the source
  albedo (`textures_v2/floor_albedo.png`) is a tileable cobblestone: any tiling
  stone texture on a flat 20 m floor repeats visibly. World-aligned UVs change
  the *scale/uniformity*, not the fact that a tile pattern repeats.

### Root cause + what would actually kill the grid
A tileable texture inherently repeats. Eliminating the grid read needs **macro
breakup**, not a UV tweak:
- a detail/secondary UV blend or a large-scale variation mask,
- vertex-paint blending between 2–3 floor materials,
- decals / debris / props to break the regular pattern,
- or a single large bespoke (non-tiling) floor texture.

These are follow-up work (a later folder-05 session — props/materials), out of
scope for this visual-polish pass.

## Lessons (for the harness / future env work)
- **UE 5.7 FBX import needs the FULL editor** (`-ExecutePythonScript`), NOT the
  `-run=pythonscript` commandlet — the Interchange importer asserts
  `CurrentApplication.IsValid()` (no Slate) under the commandlet. Added a
  `quit_editor()` footer to `build_arena_ue.py` so it self-terminates.
- **`FPostProcessSettings` override flags are `override_*`** in Python (the
  C++ `bOverride_X` drops the leading `b`), e.g. `override_bloom_intensity`.
  `b_override_*` raises `Failed to find property`. The read-back canary caught
  this.
- **Fog inscattering colour is `fog_inscattering_luminance`** in UE 5.7
  (`fog_inscattering_color` was deprecated/removed).
- **Exponential fog density is km-scale tuned** — in a 20 m arena 0.02 is
  invisible; 0.5 reads.
- **Parallel-session hazard:** sibling CLI sessions sharing the one UE project
  ran UE concurrently (a `PoF_2.log` appeared; a sibling-triggered functional
  test ran against this level mid-pipeline). Logs clobber; level saves can
  race. Used `-abslog` for an isolated, attributable functional-test log.
- **`HighResShot` arg quoting:** PowerShell `Start-Process -ArgumentList`
  splits `-ExecCmds=HighResShot 1280x720` on the space → UE sees no resolution
  (`Bad input`). Pass the argument line as one verbatim string.
