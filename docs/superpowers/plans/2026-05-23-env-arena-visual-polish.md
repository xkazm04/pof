# Arena Visual-Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the arena's cube-projection-UV grid (Blender world-aligned UVs), add a post-process volume + atmospheric fog to the vertical-slice level, and ship the matching PoF-app improvements — with gameplay provably intact.

**Architecture:** Three layers. (1) **Game / UE repo** — re-UV `build_arena.py` to world-aligned planar UVs, re-export `Arena.fbx`; drop the material tiling in `retexture_arena_ue.py` from 3.0 → 1.0 (the UVs now carry the real-world scale); add an unbound `APostProcessVolume` + `AExponentialHeightFog` to the level in `build_arena_ue.py`. (2) **PoF app** — a new reusable world-aligned-UV Blender-Python emitter, a level-design knowledge tip baking in the FBX-scale + UV gotchas, and a tightened Gemini visual-check prompt. (3) **Verify** — re-run the full pipeline, the PS-1 functional test (collision gate), and a Gemini before/after.

**Tech Stack:** Blender 4.2 headless Python, UE 5.7 editor Python (`unreal`), TypeScript (Next.js app, vitest), the existing `e2e/helpers` verification primitives.

**Spec:** `docs/superpowers/specs/2026-05-23-env-arena-visual-polish-design.md`

---

## Environment constants (used throughout)

```
BLENDER  = "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
UE_CMD   = "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
UE_EDIT  = "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe"
UPROJECT = "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject"
SHOTS    = "C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Screenshots\WindowsEditor"
GEMINI   = "C:\Users\kazda\kiro\personas\.claude\skills\leonardo\tools\gemini-recognize.mjs"
PERSONAS = "C:\Users\kazda\kiro\personas"
TESTPATH = Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest
```

- **Two repos.** PoF app = `C:\Users\kazda\kiro\pof` (`xkazm04/pof`) — commit locally only, do **NOT** push. UE project = `C:\Users\kazda\Documents\Unreal Projects\PoF` (`xkazm04/pof-exp`) — pushing works.
- **Headless UE often exits non-zero on shutdown** (a benign teardown crash) *after* the work completes. Judge success by **log content**, not the exit code.

---

## File Structure

**PoF app (`C:\Users\kazda\kiro\pof`):**
- Create: `src/lib/blender-mcp/scripts/uv-projection.ts` — reusable world-aligned-UV Blender-Python emitter (one exported function, mirrors the existing `apply-texture.ts` / `level-blockout.ts` pattern).
- Create: `src/__tests__/lib/blender-mcp/uv-projection.test.ts` — vitest on the emitter's output.
- Modify: `src/lib/module-registry.ts` — add a `knowledgeTip` to the `level-design` module (its `knowledgeTips` array is at ~line 692).
- Modify: `e2e/fixtures/gemini-prompts/arena-check.txt` — add the grid-vs-continuous + atmosphere questions.

**UE project (`C:\Users\kazda\Documents\Unreal Projects\PoF`):**
- Modify: `Content/ArenaBuild/build_arena.py` — replace the cube-projection UV loop (lines 49-57) with world-aligned planar UVs (floor/walls) + `smart_project` (pillars); add a `TILE_METERS` constant.
- Modify: `Content/Python/retexture_arena_ue.py` — `TILING = 3.0` → `TILING = 1.0` (line 64) + comment.
- Modify: `Content/Python/build_arena_ue.py` — add `add_atmosphere()` (post-process volume + height fog), called from `rebuild_level()` before the level save.

**Docs (PoF app):**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-arena-polish.md` — findings.

---

## Task 1: PoF — world-aligned-UV Blender-Python emitter

**Files:**
- Create: `src/lib/blender-mcp/scripts/uv-projection.ts`
- Test: `src/__tests__/lib/blender-mcp/uv-projection.test.ts`

This is the reusable, codified form of the Blender change in Task 4 — future textured-geometry exporters call it instead of hand-rolling cube projection. Follows the established convention in `src/lib/blender-mcp/scripts/` (each file exports a function returning a Python string; string fields escaped with `py()` from `@/lib/blender-mcp/escape`).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/blender-mcp/uv-projection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { worldAlignedUvScript } from '@/lib/blender-mcp/scripts/uv-projection';

describe('worldAlignedUvScript', () => {
  it('embeds the tile size as the UV divisor', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    expect(s).toContain('TILE = 4');
    expect(s).toContain('/ TILE');
  });

  it('emits the three world-axis projection branches', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    // floor/ceiling -> XY, N/S walls -> XZ, E/W walls -> YZ
    expect(s).toContain('co.x, co.y');
    expect(s).toContain('co.x, co.z');
    expect(s).toContain('co.y, co.z');
  });

  it('classifies faces by the dominant world-space normal axis', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    expect(s).toContain('matrix_world');
    expect(s).toContain('poly.normal');
  });

  it('targets all mesh objects when no names are given', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    expect(s).toContain("obj.type == 'MESH'");
    expect(s).toContain('TARGETS = []');
  });

  it('restricts to named objects and escapes them when provided', () => {
    const s = worldAlignedUvScript({ tileMeters: 2, objectNames: ['Wall "A"'] });
    expect(s).toContain('TILE = 2');
    expect(s).toContain('Wall \\"A\\"');
    expect(s).toContain('obj.name in TARGETS');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/blender-mcp/uv-projection.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/blender-mcp/scripts/uv-projection"` (module does not exist yet).

- [ ] **Step 3: Write the emitter**

Create `src/lib/blender-mcp/scripts/uv-projection.ts`:

```typescript
import { py } from '@/lib/blender-mcp/escape';

/**
 * Emit Blender Python that re-UVs meshes with world-aligned planar projection:
 * each face's world position is projected onto the plane perpendicular to its
 * dominant world-normal axis and divided by `tileMeters`, so one texture
 * repeat equals `tileMeters` of world space everywhere. This gives a single
 * uniform real-world texture scale (no per-face cube-projection grid).
 *
 * - `tileMeters` — world metres per texture repeat (e.g. 4).
 * - `objectNames` — restrict to these objects; omit/empty to re-UV every mesh.
 */
export function worldAlignedUvScript(params: {
  tileMeters: number;
  objectNames?: string[];
}): string {
  const targets = (params.objectNames ?? [])
    .map((n) => `"${py(n)}"`)
    .join(', ');

  return `
import bpy

TILE = ${params.tileMeters}
TARGETS = [${targets}]

def world_aligned_uv(obj):
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    uv = mesh.uv_layers.active.data
    mw = obj.matrix_world
    rot = mw.to_3x3()
    for poly in mesh.polygons:
        n = rot @ poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            co = mw @ mesh.vertices[mesh.loops[li].vertex_index].co
            if az >= ax and az >= ay:      # floor / ceiling -> world XY
                u, v = co.x, co.y
            elif ay >= ax:                  # N/S walls -> world XZ
                u, v = co.x, co.z
            else:                           # E/W walls -> world YZ
                u, v = co.y, co.z
            uv[li].uv = (u / TILE, v / TILE)

count = 0
for obj in bpy.data.objects:
    if obj.type == 'MESH' and (not TARGETS or obj.name in TARGETS):
        world_aligned_uv(obj)
        count += 1

print(f"World-aligned UV applied to {count} mesh(es), tile={TILE}m")
`.trim();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/blender-mcp/uv-projection.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit (PoF app — local only, do NOT push)**

```bash
git add src/lib/blender-mcp/scripts/uv-projection.ts src/__tests__/lib/blender-mcp/uv-projection.test.ts
git commit -m "feat(blender-mcp): world-aligned UV projection script emitter

Reusable Blender-Python emitter that re-UVs meshes with world-aligned planar
projection (one repeat == tileMeters of world space), the codified form of the
arena re-UV. Replaces per-face cube projection so tiling textures read at a
uniform real-world scale with no grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: PoF — level-design knowledge tip (FBX-scale + UV gotchas)

**Files:**
- Modify: `src/lib/module-registry.ts` (the `level-design` module's `knowledgeTips` array, ~line 692)

Bake the two hard-won lessons (the 100× FBX-scale trap and the cube-projection grid) into the level-design module's knowledge so future Blender→UE level work avoids them.

- [ ] **Step 1: Add the knowledge tip**

In `src/lib/module-registry.ts`, find the `level-design` module's `knowledgeTips` array. It currently reads:

```typescript
    knowledgeTips: [
      { title: 'Procedural generation is strong', content: 'Code-driven level generation is an area where Claude can contribute significantly - algorithms over art.', source: 'feasibility' },
    ],
```

Replace it with (adds one entry — keep the existing one):

```typescript
    knowledgeTips: [
      { title: 'Procedural generation is strong', content: 'Code-driven level generation is an area where Claude can contribute significantly - algorithms over art.', source: 'feasibility' },
      { title: 'Blender→UE: author in metres, scale 1.0, world-aligned UVs', content: 'Author geometry in metres. Blender FBX export: apply_unit_scale=True, global_scale=1.0 (the exporter writes the FBX in centimetres). UE import: import_uniform_scale=1.0 — NOT 100, which makes the mesh 100x oversized. For tiling textures, unwrap world-aligned planar (one repeat per N metres) rather than cube_project, so the texture reads at a uniform real-world scale with no repeating grid; the material then samples UV0 directly (TextureCoordinate tiling 1.0).', source: 'best-practice' },
    ],
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0 (the new object matches the existing `{ title, content, source }` shape).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exit 0 (no new warnings from the edited block).

- [ ] **Step 4: Commit (PoF app — local only, do NOT push)**

```bash
git add src/lib/module-registry.ts
git commit -m "feat(level-design): knowledge tip for FBX scale + world-aligned UVs

Bake the vertical-slice arena lessons into the level-design module: author in
metres with import_uniform_scale=1.0 (not 100x), and unwrap world-aligned
planar instead of cube_project so tiling textures avoid the repeating grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: PoF — tighten the arena Gemini-check prompt

**Files:**
- Modify: `e2e/fixtures/gemini-prompts/arena-check.txt`

The existing fixture asks about missing textures (checkerboard = *no* texture) but not about the **repeating-grid** look (texture present but tiled too much — the cube_project problem) or the new **atmosphere** (fog / post-process). Add those two discriminating questions so the Task 7 before/after check actually measures what this pass changes. `geminiCheck('arena-check')` resolves this file by name (see `e2e/helpers/verification-core.ts` `resolveGeminiPrompt`).

- [ ] **Step 1: Rewrite the fixture**

Overwrite `e2e/fixtures/gemini-prompts/arena-check.txt` with:

```
Look at this game screenshot of an arena level. Answer each question explicitly with yes/no. (1) Is there a visible ground/floor surface the characters stand on? (2) Is the area enclosed by walls or boundaries (an arena), or open void? (3) Is the scene lit (you can see surfaces and colour), or is it black/unlit? (4) Do the floor and wall textures read as continuous natural surfaces, or as an obviously repeating tiled grid / checkerboard pattern? (5) Is there any sense of atmosphere or depth — fog, haze, or graded lighting — or is the air perfectly clear and flat? (6) Any obvious rendering artifacts: missing textures (magenta/grey), z-fighting, or floating objects?
```

- [ ] **Step 2: Verify the existing fixture-resolution test still passes**

Run: `npx vitest run e2e/helpers/verification-core.test.ts`
Expected: PASS (this test uses temp fixtures, not the real file — it should be unaffected; this step just confirms nothing else broke).

- [ ] **Step 3: Commit (PoF app — local only, do NOT push)**

```bash
git add e2e/fixtures/gemini-prompts/arena-check.txt
git commit -m "test(e2e): arena Gemini prompt asks about grid + atmosphere

Add the repeating-grid-vs-continuous and fog/atmosphere questions so the
visual-polish before/after check measures what the pass changes, not just
'is a texture present'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Game — world-aligned UVs in `build_arena.py`

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\build_arena.py`

Replace the single cube-projection UV pass with world-aligned planar UVs for the floor + walls, keeping `smart_project` for the curved pillars. The geometry is unchanged; only the UVs change. Then re-export `Arena.fbx`.

- [ ] **Step 1: Add the `TILE_METERS` constant**

In `build_arena.py`, after the line `WALL_T = 0.5           # wall thickness (m)` (line 9), add:

```python
TILE_METERS = 4.0      # world metres per texture repeat (world-aligned UVs)
```

- [ ] **Step 2: Replace the UV-unwrap block**

Replace lines 49-57 (the block beginning `# --- UV unwrap each part (cube projection is fine for a gray-arena) --------` through the end of the `for obj in parts:` cube-projection loop) with:

```python
# --- UV unwrap ------------------------------------------------------------
# World-aligned planar UVs: project each face's world position onto the plane
# perpendicular to its dominant world-normal axis, divided by TILE_METERS, so
# one texture repeat == TILE_METERS of world space everywhere. This replaces
# the per-face cube projection that produced a repeating grid. Pillars are
# curved, so they keep a smart unwrap.
def world_aligned_uv(obj, tile):
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    uv = mesh.uv_layers.active.data
    mw = obj.matrix_world
    rot = mw.to_3x3()
    for poly in mesh.polygons:
        n = rot @ poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            co = mw @ mesh.vertices[mesh.loops[li].vertex_index].co
            if az >= ax and az >= ay:      # floor / ceiling -> world XY
                u, v = co.x, co.y
            elif ay >= ax:                  # N/S walls -> world XZ
                u, v = co.x, co.z
            else:                           # E/W walls -> world YZ
                u, v = co.y, co.z
            uv[li].uv = (u / tile, v / tile)

for obj in parts:
    if obj.name.startswith("Pillar"):
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
        bpy.ops.object.mode_set(mode='OBJECT')
    else:
        world_aligned_uv(obj, TILE_METERS)
```

(The join + FBX export block that follows, lines 59-73, is unchanged.)

- [ ] **Step 3: Re-export the FBX (run Blender headless)**

Run (PowerShell):

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --background --python "C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\build_arena.py"
```

Expected: stdout ends with `ARENA_EXPORTED C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\Arena.fbx` and exit 0. If `blender.exe` is not at that path, locate it under `C:\Program Files\Blender Foundation\` and use the real path.

- [ ] **Step 4: Commit (UE repo)**

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Content/ArenaBuild/build_arena.py Content/ArenaBuild/Arena.fbx
git commit -m "feat(arena): world-aligned planar UVs (kill the cube-projection grid)

Replace cube_project with per-face world-aligned planar UVs (4 m per repeat;
floor->XY, walls->XZ/YZ); pillars keep smart_project. Geometry unchanged.
Re-export Arena.fbx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Game — drop material tiling to 1.0 in `retexture_arena_ue.py`

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\retexture_arena_ue.py`

The world-aligned UVs now encode the real-world tile scale (Task 4), so the material's `TextureCoordinate` must be a pass-through (1.0) instead of re-multiplying by 3.0 — otherwise the texture tiles 3× too fast and the grid returns. Final repeat scale = `TILE_METERS` (Blender) × `TILING` (material) = 4 m × 1.0.

- [ ] **Step 1: Change the TILING constant and its comment**

In `retexture_arena_ue.py`, replace the tiling comment block + constant (lines 55-64) with:

```python
# Tiling correction.
#   build_arena.py now unwraps the arena with WORLD-ALIGNED planar UVs at
#   TILE_METERS = 4 m per repeat -- the UVs already encode the real-world
#   texture scale. So the material's TextureCoordinate must be a pass-through
#   (UTiling = VTiling = 1.0); any other value re-multiplies the UVs and brings
#   back the repeating-grid look. Final repeat = TILE_METERS (4 m) x TILING.
#   (Tune from here: bump TILING for more repeats without re-exporting the FBX.)
TILING = 1.0
```

- [ ] **Step 2: Commit (UE repo) — material rebuild happens in Task 7's pipeline run**

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Content/Python/retexture_arena_ue.py
git commit -m "fix(arena): material tiling 3.0 -> 1.0 for world-aligned UVs

World-aligned UVs (build_arena.py, 4 m/repeat) now carry the texture scale, so
the TextureCoordinate is a pass-through. Tiling 3.0 would re-multiply and
restore the grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Game — post-process volume + height fog in `build_arena_ue.py`

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_arena_ue.py`

Add an unbound `APostProcessVolume` (auto-exposure clamp, bloom, vignette, slight saturation) and an `AExponentialHeightFog` (low density, cool tint) to `/Game/Maps/VerticalSlice`. Idempotent: any prior atmosphere actor is destroyed first. The lights stay Movable (unchanged). The functional test runs `-nullrhi` so this does not affect it; the Gemini check (real launch) is the gate.

- [ ] **Step 1: Add the `add_atmosphere` function**

In `build_arena_ue.py`, immediately before the `# ---- Section 5: Rebuild the VerticalSlice level` comment block (above `def rebuild_level():`, ~line 332), insert:

```python
# ---------------------------------------------------------------------------
# Section 4b: Atmosphere — post-process volume + height fog
# ---------------------------------------------------------------------------

def add_atmosphere(actor_subsystem):
    """Spawn an unbound PostProcessVolume + ExponentialHeightFog (idempotent).

    A wrong FPostProcessSettings Python field name raises on get/set (caught by
    the caller) for value fields; the bOverride_* flags only take effect at
    render time, so the real gate is the Gemini visual check.
    """
    # Clean any previously-spawned atmosphere actors for an idempotent re-run.
    for actor in actor_subsystem.get_all_level_actors():
        if isinstance(actor, (unreal.PostProcessVolume,
                              unreal.ExponentialHeightFog)):
            actor_subsystem.destroy_actor(actor)

    # --- Unbound post-process volume -----------------------------------------
    ppv = actor_subsystem.spawn_actor_from_class(
        unreal.PostProcessVolume, unreal.Vector(0.0, 0.0, 0.0))
    ppv.set_actor_label("Arena_PostProcess")
    ppv.set_editor_property("unbound", True)

    settings = ppv.get_editor_property("settings")
    settings.set_editor_property("auto_exposure_min_brightness", 0.5)
    settings.set_editor_property("b_override_auto_exposure_min_brightness", True)
    settings.set_editor_property("auto_exposure_max_brightness", 2.0)
    settings.set_editor_property("b_override_auto_exposure_max_brightness", True)
    settings.set_editor_property("bloom_intensity", 0.5)
    settings.set_editor_property("b_override_bloom_intensity", True)
    settings.set_editor_property("vignette_intensity", 0.4)
    settings.set_editor_property("b_override_vignette_intensity", True)
    settings.set_editor_property("color_saturation",
                                 unreal.Vector4(1.1, 1.1, 1.1, 1.0))
    settings.set_editor_property("b_override_color_saturation", True)
    ppv.set_editor_property("settings", settings)

    # Read back the scalar values to confirm the field names are correct.
    chk = ppv.get_editor_property("settings")
    _log("PostProcess bloom=%.2f vignette=%.2f autoexp=[%.2f,%.2f]" % (
        chk.get_editor_property("bloom_intensity"),
        chk.get_editor_property("vignette_intensity"),
        chk.get_editor_property("auto_exposure_min_brightness"),
        chk.get_editor_property("auto_exposure_max_brightness")))

    # --- Exponential height fog ----------------------------------------------
    fog = actor_subsystem.spawn_actor_from_class(
        unreal.ExponentialHeightFog, unreal.Vector(0.0, 0.0, 0.0))
    fog.set_actor_label("Arena_HeightFog")
    fog_comp = fog.get_editor_property("component")
    fog_comp.set_editor_property("fog_density", 0.02)
    fog_comp.set_editor_property("fog_height_falloff", 0.2)
    fog_comp.set_editor_property("fog_inscattering_color",
                                 unreal.LinearColor(0.4, 0.45, 0.6, 1.0))
    _log("Spawned PostProcessVolume + ExponentialHeightFog")
```

- [ ] **Step 2: Call it from `rebuild_level()` before the save**

In `rebuild_level()`, find the two lines at the end of the function:

```python
        level_subsystem.save_current_level()
        _log("Saved level: " + LEVEL_PATH)
```

Insert the `add_atmosphere` call immediately before them:

```python
        add_atmosphere(actor_subsystem)

        level_subsystem.save_current_level()
        _log("Saved level: " + LEVEL_PATH)
```

- [ ] **Step 3: Commit (UE repo) — run happens in Task 7**

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Content/Python/build_arena_ue.py
git commit -m "feat(arena): post-process volume + height fog in the slice level

Add an unbound APostProcessVolume (exposure clamp, bloom, vignette, slight
saturation) and an AExponentialHeightFog (low density, cool tint) to
/Game/Maps/VerticalSlice. Idempotent; lights stay Movable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Verify — run the pipeline, the functional test, and the Gemini before/after

**Files:** none modified except the findings doc at the end.

Run the full game pipeline against the edited scripts, prove gameplay (collision) survives the re-export with the PS-1 functional test, and confirm the visual change with a real-launch Gemini check. The reusable wrappers for these steps already exist in `e2e/helpers/ue-verification.ts` (`runFunctionalTest`, `launchAndScreenshot`, `geminiCheck`); this task runs the underlying commands directly so verification needs no harness wiring.

- [ ] **Step 1: Capture a BEFORE screenshot (current built state, pre-pipeline)**

Run:

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" "/Game/Maps/VerticalSlice" -game -windowed -ResX=1280 -ResY=720 "-ExecCmds=HighResShot 1280x720"
```

Wait ~25 s, then terminate: `taskkill /IM UnrealEditor.exe /F`. The newest PNG in `C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Screenshots\WindowsEditor` is the BEFORE. Copy it to `docs/features/arpg-vertical-slice/scenario-runs/img/arena-before.png` (in the PoF app repo) for the findings doc.

- [ ] **Step 2: Run the Blender re-export** (already done in Task 4 Step 3 — re-run if `Arena.fbx` is stale)

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --background --python "C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\build_arena.py"
```

Expected: `ARENA_EXPORTED ...Arena.fbx`.

- [ ] **Step 3: Run the UE import + level rebuild + atmosphere**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_arena_ue.py" -unattended -nopause
```

Expected log lines (search the output):
- `SM_Arena box extent (uu): ~1000.x, ~1000.x, ~...` (a ~2000 uu / 20 m footprint — confirms the import scale is still 1.0, NOT 100×).
- `PostProcess bloom=0.50 vignette=0.40 autoexp=[0.50,2.00]` — confirms the FPostProcessSettings field names are correct. **If this line is absent or `get_editor_property` raised**, a Python field name is wrong: print `dir(settings)` to find the right name, fix Task 6 Step 1, re-run.
- `Spawned PostProcessVolume + ExponentialHeightFog`
- `=== Arena import + level rebuild COMPLETE ===`

(Headless may exit non-zero on shutdown — judge by these log lines. If the FBX import fails under `-run=pythonscript`, retry via the full editor: replace `-run=pythonscript -script="..."` with `-ExecutePythonScript="..."`.)

- [ ] **Step 4: Run the re-texture (tiling 1.0)**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\retexture_arena_ue.py" -unattended -nopause
```

Expected log: `Rebuilt material (tiling 1.00): /Game/ArenaBuild/M_Arena_Floor` (and `_Wall`, `_Pillar`), then `=== Arena re-texture COMPLETE ===`.

- [ ] **Step 5: Run the PS-1 functional test (the collision gate)**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" "/Game/Maps/VerticalSlice" "-ExecCmds=Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -log
```

Expected: the log contains `Result={Success}` AND `Assertion passed (#2 movement: ...)` (the player stands on and moves across the re-exported arena — proves the re-UV/re-import did not break collision). **If `#2 movement` failed**, the re-export perturbed collision: re-assert `CTF_USE_COMPLEX_AS_SIMPLE` (already in `import_arena_mesh`, lines 155-160) and confirm `auto_generate_collision=True`; re-run Step 3. Do not proceed until #2 passes.

- [ ] **Step 6: Capture the AFTER screenshot**

Same as Step 1 (re-run the `UnrealEditor.exe ... HighResShot` command, wait, taskkill). The newest PNG is the AFTER. Copy to `docs/features/arpg-vertical-slice/scenario-runs/img/arena-after.png`.

- [ ] **Step 7: Run the Gemini before/after check**

For each screenshot, run (cwd = personas dir so its `.env` / `GEMINI_API_KEY` loads):

```powershell
$prompt = Get-Content -Raw "C:\Users\kazda\kiro\pof\e2e\fixtures\gemini-prompts\arena-check.txt"
Push-Location "C:\Users\kazda\kiro\personas"
node "C:\Users\kazda\kiro\personas\.claude\skills\leonardo\tools\gemini-recognize.mjs" --input "<after.png>" --prompt $prompt
Pop-Location
```

Expected (AFTER): Gemini answers yes to floor / enclosed / lit; says the textures read as **continuous** (NOT a repeating grid); reports a sense of **atmosphere/fog/depth**; reports no missing-texture/z-fighting artifacts. Compare against the BEFORE answers (which should report the grid and no atmosphere). **If AFTER still reports a grid**, the tiling is too dense — bump `TILE_METERS` in `build_arena.py` (e.g. 4 → 6) and re-run Steps 2-4, or as a fast material-only tune lower `TILING` is not applicable (it's 1.0); prefer raising `TILE_METERS`.

- [ ] **Step 8: Write the findings doc (PoF app)**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-arena-polish.md` summarising: the world-aligned UV change (TILE_METERS=4), tiling 3.0→1.0, the post-process + fog added; the functional-test result (paste the `#2 movement` assertion line); the Gemini before/after verdicts (grid→continuous, no-atmosphere→atmosphere); and any tuning done (final `TILE_METERS`). Embed `img/arena-before.png` and `img/arena-after.png`.

- [ ] **Step 9: Commit the UE-project asset changes (UE repo)**

The pipeline run modified the level, materials, and textures. From the UE project:

```bash
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Content/Maps/VerticalSlice.umap Content/ArenaBuild/M_Arena_Floor.uasset Content/ArenaBuild/M_Arena_Wall.uasset Content/ArenaBuild/M_Arena_Pillar.uasset Content/ArenaBuild/SM_Arena.uasset Content/ArenaBuild/Textures
git status
git commit -m "chore(arena): rebuilt slice level with world-aligned UVs + atmosphere

Pipeline run: world-aligned-UV SM_Arena, materials at tiling 1.0,
PostProcessVolume + height fog in VerticalSlice. Functional test #2 movement
green (collision intact).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(Adjust the `git add` paths to whatever `git status` actually shows changed — asset filenames/paths may differ. The UE repo CAN be pushed if desired.)

- [ ] **Step 10: Commit the findings doc (PoF app — local only, do NOT push)**

```bash
cd "C:\Users\kazda\kiro\pof"
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-arena-polish.md docs/features/arpg-vertical-slice/scenario-runs/img/arena-before.png docs/features/arpg-vertical-slice/scenario-runs/img/arena-after.png docs/superpowers/plans/2026-05-23-env-arena-visual-polish.md
git commit -m "docs(env): arena visual-polish findings + implementation plan

World-aligned UVs killed the grid, post-process + fog added depth, functional
test #2 movement stayed green. Gemini before/after confirms continuous
surfaces + atmosphere.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final validation

- [ ] **Step 1: PoF-app full check**

Run: `npm run validate` (typecheck + lint + test)
Expected: exit 0. The new `uv-projection.test.ts` and the existing `verification-core.test.ts` pass; no new lint warnings.

- [ ] **Step 2: Confirm the definition of done**

Verify each spec DoD item: (1) `build_arena.py` world-aligned + `Arena.fbx` re-exported; (2) `build_arena_ue.py` adds PP/fog + `retexture_arena_ue.py` tiling 1.0; (3) functional test #2 movement green; (4) Gemini AFTER = no grid, lit, atmospheric; (5) PoF `uv-projection.ts` + test + knowledge tip + tightened fixture; (6) findings doc committed. Anything unchecked: return to its task.

---

## Self-review notes (addressed during writing)

- **Spec said tiling lives in `build_arena_ue.py`; it actually lives in `retexture_arena_ue.py`** (verified — `build_arena_ue.py` has no `TextureCoordinate`). Task 5 targets the correct file.
- **Spec said add a `uvStrategy` param to `level-blockout.ts`; that file is a blockout tool with no UV/texture/FBX export** (verified). Replaced with a new, genuinely-reusable `uv-projection.ts` emitter (Task 1) — the codified form of the Blender change.
- **Spec said create a Gemini-check helper; it already exists** (`geminiCheck` in `ue-verification.ts`, verified). Narrowed to tightening the `arena-check.txt` fixture (Task 3).
- **FPostProcessSettings field names are the known risk** — Task 6 sets the value + `b_override_*` flag per field and reads back the scalars (Task 7 Step 3) as the canary; the Gemini visual check is the final gate.
- **Pillars** kept on `smart_project` (curved surface) per the spec, world-aligned for floor/walls.
- Type/name consistency: emitter export `worldAlignedUvScript` and Python token `TILE` / `TARGETS` are used identically in Task 1's source and test.
