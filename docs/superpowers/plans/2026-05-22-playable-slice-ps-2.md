# PS-2: Textured Combat Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gray-box cube floor of the vertical slice with a real, textured 3D combat arena authored in Blender, with the PS-1 gameplay loop provably intact.

**Architecture:** A headless Blender Python script procedurally authors the arena geometry (floor, walls, pillars) with UVs and named material slots and exports an FBX. PolyHaven textures are fetched over HTTP. A UE Python script imports the FBX + textures, builds UE materials, and rebuilds `/Game/Maps/VerticalSlice` around the existing PS-1 gameplay actors. Verified by re-running the PS-1 functional test green on the rebuilt level.

**Tech Stack:** Blender 4.2 (`bpy`, headless `--background --python`), PolyHaven HTTP API, UE 5.7 (`unreal` Python API, FBX import, `MaterialEditingLibrary`), `UnrealEditor-Cmd`, the Leonardo skill's `gemini-recognize.mjs`.

**Spec:** `docs/superpowers/specs/2026-05-22-playable-slice-ps-2-design.md`

---

## Planning-time facts

UE project: `C:\Users\kazda\Documents\Unreal Projects\PoF` (UE 5.7, NOT under git). PoF repo (git): `C:\Users\kazda\kiro\pof` (Bash working directory).

- PS-1 produced `/Game/Maps/VerticalSlice.umap` containing: a floor (a `/Engine/BasicShapes/Cube` `AStaticMeshActor`, scaled 40×40×1), a `DirectionalLight`, a `SkyLight`, an `APlayerStart`, one `BP_VSEnemy` (at ~(400,0,150)), and one `AVSFunctionalTest` actor. The gameplay Blueprints (`BP_VSPlayer`, `BP_VSEnemy`, `BP_VSGameMode`, `BP_VSPlayerController`, `BP_GA_MeleeAttack`) and `IMC_VerticalSlice` are under `/Game/VerticalSlice/`, `/Game/Abilities/`, `/Game/Input/` — PS-2 does not touch them.
- The PS-1 functional test runs headless via `UnrealEditor-Cmd ... -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi`. It verifies #2 movement, #3 attack activation, #4 damage, #5 death+loot. PS-2 must keep it green.
- Blender 4.2 at `C:\Program Files\Blender Foundation\Blender 4.2\blender.exe`.
- PolyHaven API (keyless, CC0): `https://api.polyhaven.com/assets?t=textures` lists texture assets; `https://api.polyhaven.com/files/<asset_id>` returns a JSON map of file URLs (Diffuse/nor_gl/Rough at resolutions like `1k`/`2k`, `jpg`/`png`).

Shorthand used below:
- `BLENDER` = `"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"`
- `UE_CMD` = `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"`
- `UPROJECT` = `"C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject"`
- `<UE>` = `C:\Users\kazda\Documents\Unreal Projects\PoF`

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `<UE>/Content/ArenaBuild/build_arena.py` | Create | Blender: author arena geometry, export `Arena.fbx` |
| `<UE>/Content/ArenaBuild/fetch_textures.mjs` | Create | Fetch PolyHaven texture sets over HTTP |
| `<UE>/Content/Python/build_arena_ue.py` | Create | UE: import FBX+textures, build materials, rebuild the level |
| `docs/features/arpg-vertical-slice/ps-2-artifacts/` | Create | Git-tracked copies of the three scripts (UE project is not git) |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-2-arena.md` | Create | PS-2 findings |

Generated (not committed): `<UE>/Content/ArenaBuild/Arena.fbx`, `<UE>/Content/ArenaBuild/textures/*`, the UE assets under `/Game/ArenaBuild/`, the rebuilt `VerticalSlice.umap`.

Total: 3 scripts created, 1 findings doc, ~4 commits to the PoF repo.

---

## Task 1: Blender authors the arena

**Files:**
- Create: `<UE>/Content/ArenaBuild/build_arena.py`

- [ ] **Step 1: Smoke-test headless Blender**

```bash
mkdir -p "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild"
"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --background --python-expr "import bpy; print('BLENDER_OK', bpy.app.version_string)"
```
Expected: output contains `BLENDER_OK 4.2...` and exit 0. If `blender.exe` is not at that path, locate it under `C:\Program Files\Blender Foundation\` and use the real path for the rest of the task.

- [ ] **Step 2: Write the arena authoring script**

Create `<UE>/Content/ArenaBuild/build_arena.py`:
```python
"""Headless Blender: build a combat-arena mesh and export Arena.fbx.
Run: blender --background --python build_arena.py
Authored in metres; the UE import applies a x100 scale (m -> cm)."""
import bpy, os, math

OUT = os.path.join(os.path.dirname(bpy.data.filepath) or os.path.dirname(__file__), "Arena.fbx")
ARENA = 20.0           # floor is 20 m square
WALL_H = 5.0           # wall height (m)
WALL_T = 0.5           # wall thickness (m)

# --- clean scene -----------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

def new_material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return m

def add_box(name, size, location, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(material)
    return obj

mat_floor  = new_material("M_Floor")
mat_wall   = new_material("M_Wall")
mat_pillar = new_material("M_Pillar")

parts = []
# floor: 20x20x0.2, top at z=0
parts.append(add_box("Floor", (ARENA, ARENA, 0.2), (0, 0, -0.1), mat_floor))
# four perimeter walls
half = ARENA / 2.0
parts.append(add_box("Wall_N", (ARENA, WALL_T, WALL_H), (0,  half, WALL_H/2), mat_wall))
parts.append(add_box("Wall_S", (ARENA, WALL_T, WALL_H), (0, -half, WALL_H/2), mat_wall))
parts.append(add_box("Wall_E", (WALL_T, ARENA, WALL_H), ( half, 0, WALL_H/2), mat_wall))
parts.append(add_box("Wall_W", (WALL_T, ARENA, WALL_H), (-half, 0, WALL_H/2), mat_wall))
# four corner pillars
for i, (sx, sy) in enumerate([(1,1),(1,-1),(-1,1),(-1,-1)]):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.6, depth=WALL_H,
        location=(sx*(half-1.5), sy*(half-1.5), WALL_H/2))
    p = bpy.context.active_object
    p.name = f"Pillar_{i}"
    p.data.materials.append(mat_pillar)
    parts.append(p)

# --- UV unwrap each part (cube projection is fine for a gray-arena) --------
for obj in parts:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=2.0)
    bpy.ops.object.mode_set(mode='OBJECT')

# --- join into one object "Arena" -----------------------------------------
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
arena = bpy.context.active_object
arena.name = "Arena"

# --- export FBX ------------------------------------------------------------
bpy.ops.export_scene.fbx(filepath=OUT, use_selection=True,
    apply_unit_scale=True, global_scale=1.0, object_types={'MESH'},
    mesh_smooth_type='FACE', path_mode='COPY')
print("ARENA_EXPORTED", OUT)
```

- [ ] **Step 3: Run it headless**

```bash
"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --background --python "C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\build_arena.py" 2>&1
```
Expected: output contains `ARENA_EXPORTED` and exit 0. Verify the FBX:
```bash
ls -la "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild/Arena.fbx"
```
Expected: the file exists, non-zero size. If Blender errors (e.g. an op-context issue running headless), read the error, adjust the script (headless ops sometimes need an explicit `bpy.context.view_layer.objects.active` or an override), and re-run.

- [ ] **Step 4: Commit the archived copy**

```bash
mkdir -p docs/features/arpg-vertical-slice/ps-2-artifacts
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild/build_arena.py" docs/features/arpg-vertical-slice/ps-2-artifacts/
git add docs/features/arpg-vertical-slice/ps-2-artifacts
git commit -m "feat(ps-2): Blender arena-authoring script (UE project)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fetch PolyHaven textures

**Files:**
- Create: `<UE>/Content/ArenaBuild/fetch_textures.mjs`

- [ ] **Step 1: Write the texture-fetch script**

Create `<UE>/Content/ArenaBuild/fetch_textures.mjs`:
```javascript
// Fetch 3 PolyHaven texture sets (floor, wall, pillar) into ./textures/.
// PolyHaven is CC0 / keyless. Node 18+ (global fetch).
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'textures');
// slot -> a PolyHaven texture category to search
const WANT = { floor: 'floor', wall: 'wall', pillar: 'concrete' };
const RES = '1k', FMT = 'jpg';

async function listTextures(category) {
  const r = await fetch(`https://api.polyhaven.com/assets?t=textures&categories=${category}`);
  if (!r.ok) throw new Error(`assets list ${category}: ${r.status}`);
  return Object.keys(await r.json()); // asset ids
}
async function filesFor(id) {
  const r = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!r.ok) throw new Error(`files ${id}: ${r.status}`);
  return r.json();
}
function pickUrl(files, mapKeys) {
  for (const k of mapKeys) {
    const m = files[k];
    if (m && m[RES] && m[RES][FMT] && m[RES][FMT].url) return m[RES][FMT].url;
  }
  return null;
}
async function dl(url, path) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url}: ${r.status}`);
  await writeFile(path, Buffer.from(await r.arrayBuffer()));
}

await mkdir(OUT, { recursive: true });
for (const [slot, category] of Object.entries(WANT)) {
  const ids = await listTextures(category);
  let done = false;
  for (const id of ids.slice(0, 8)) {
    const files = await filesFor(id);
    const albedo = pickUrl(files, ['Diffuse', 'diff', 'albedo', 'col_01', 'diffuse']);
    if (!albedo) continue;
    const normal = pickUrl(files, ['nor_gl', 'nor_dx', 'Normal']);
    const rough  = pickUrl(files, ['Rough', 'rough', 'arm']);
    await dl(albedo, join(OUT, `${slot}_albedo.${FMT}`));
    if (normal) await dl(normal, join(OUT, `${slot}_normal.${FMT}`));
    if (rough)  await dl(rough,  join(OUT, `${slot}_rough.${FMT}`));
    console.log(`TEXTURE_OK ${slot} <- polyhaven:${id} (albedo${normal?'+normal':''}${rough?'+rough':''})`);
    done = true;
    break;
  }
  if (!done) throw new Error(`no usable texture found for slot '${slot}' in category '${category}'`);
}
console.log('TEXTURES_DONE');
```

- [ ] **Step 2: Run it**

```bash
node "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild/fetch_textures.mjs" 2>&1
ls "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild/textures/"
```
Expected: three `TEXTURE_OK` lines + `TEXTURES_DONE`, and at least `floor_albedo.jpg`, `wall_albedo.jpg`, `pillar_albedo.jpg` present (normal/rough optional). If the PolyHaven API shape differs (a map key not in the `pickUrl` lists), inspect one `files/<id>` JSON response and extend the key lists; re-run.

- [ ] **Step 3: Commit the archived copy**

```bash
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild/fetch_textures.mjs" docs/features/arpg-vertical-slice/ps-2-artifacts/
git add docs/features/arpg-vertical-slice/ps-2-artifacts
git commit -m "feat(ps-2): PolyHaven texture-fetch script (UE project)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: UE import + materials + level rebuild

**Files:**
- Create: `<UE>/Content/Python/build_arena_ue.py`

- [ ] **Step 1: Write the UE import + rebuild script**

Create `<UE>/Content/Python/build_arena_ue.py`. It must, using the `unreal` module:
1. **Import `Arena.fbx`** as a Static Mesh at `/Game/ArenaBuild/SM_Arena`. Use `unreal.AssetImportTask` + `unreal.FbxImportUI` / `unreal.FbxStaticMeshImportData`: set `import_uniform_scale = 100.0` (Blender metres → UE centimetres), `combine_meshes = True`, and enable collision generation (`FbxStaticMeshImportData.auto_generate_collision = True`). After import, set the static mesh's collision so the player can stand on it — if auto collision is unreliable for the combined mesh, set `collision_complexity` to `CTF_UseComplexAsSimple` on `SM_Arena` (a static, non-moving floor can use complex-as-simple collision).
2. **Import the textures** from `<UE>/Content/ArenaBuild/textures/` as UE Texture2D assets under `/Game/ArenaBuild/Textures/` (one import task per file; mark the `*_normal` ones as normal maps — `compression_settings = TC_NORMALMAP`).
3. **Build three materials** `/Game/ArenaBuild/M_Arena_Floor`, `M_Arena_Wall`, `M_Arena_Pillar` with `unreal.MaterialFactoryNew` + `unreal.MaterialEditingLibrary`: a `TextureSample` for albedo → Base Color; if a normal texture exists, a `TextureSample` (normal) → Normal; if a roughness texture exists → Roughness. Save them.
4. **Assign** the materials to `SM_Arena`'s material slots by slot name (`M_Floor`→`M_Arena_Floor`, `M_Wall`→`M_Arena_Wall`, `M_Pillar`→`M_Arena_Pillar`) via `unreal.StaticMesh.set_material` / the static-mesh material slot API. (Slot names come from the Blender material names.)
5. **Rebuild the level** `/Game/Maps/VerticalSlice`: load it; find and **delete** the gray-box floor actor (the `AStaticMeshActor` using `/Engine/BasicShapes/Cube` scaled large — identify it by its mesh or large scale); spawn an `AStaticMeshActor` using `SM_Arena` at the origin; **keep** the `APlayerStart`, the `BP_VSEnemy` actor, the `AVSFunctionalTest` actor, the `DirectionalLight` and `SkyLight`. Reposition the `APlayerStart` to ~`(-300, 0, 120)` and the `BP_VSEnemy` to ~`(300, 0, 120)` — both on the arena floor (floor top is z≈0 after the x100 scale; lift them so the capsule sits above it), a few metres apart and well within the walls. Save the level.

Use `unreal.EditorAssetLibrary` (exists/save), `unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(...)`, `unreal.LevelEditorSubsystem` / `unreal.EditorActorSubsystem` (`get_all_level_actors`, `spawn_actor_from_object`, `destroy_actor`). Wrap each numbered section in try/except that `unreal.log_error`s and re-raises. Make it idempotent (skip/overwrite already-imported assets). Authoring the script section by section and running Step 2 after each section is recommended over writing all 5 blind.

- [ ] **Step 2: Run the UE import + rebuild headless**

```bash
"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_arena_ue.py" -unattended -nopause 2>&1
```
Expected: runs to completion, exit 0, the log shows the FBX/textures imported, materials built, the level rebuilt. On error, read the logged exception, fix that section, re-run (slow — generous timeout, e.g. 900000 ms).

- [ ] **Step 3: Verify the assets**

```bash
ls "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild/SM_Arena.uasset"
ls "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/ArenaBuild/"
```
Expected: `SM_Arena.uasset` and the `M_Arena_*` / texture assets exist. Spot-check the log confirmed the level saved.

- [ ] **Step 4: Commit the archived copy**

```bash
cp "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/build_arena_ue.py" docs/features/arpg-vertical-slice/ps-2-artifacts/
git add docs/features/arpg-vertical-slice/ps-2-artifacts
git commit -m "feat(ps-2): UE arena import + level-rebuild script (UE project)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Verify the slice still plays + findings

**Files:**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-2-arena.md`

- [ ] **Step 1: Re-run the PS-1 functional test**

```bash
"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -log 2>&1
```
Expected: all four criteria (#2 movement, #3 attack, #4 damage, #5 death+loot) report pass, run Success, exit 0 — the new arena did not break the gameplay loop.

- [ ] **Step 2: Fix-loop if it fails**

The most likely failure is **#2 movement** — the player falls through the arena floor (no/bad collision) or is mis-placed. Diagnose from the automation log + `<UE>\Saved\Logs\PoF.log`:
- Floor collision: re-check the `SM_Arena` collision (Task 3 Step 1.1) — set complex-as-simple, or give the floor its own simple box collision; re-run `build_arena_ue.py`.
- Placement: the player/enemy must spawn above the floor (z above the floor top) and within the walls — adjust the reposition coordinates.
- If a wall or pillar blocks the player from the enemy and #4 fails on range, widen their spacing or move the enemy clear of geometry.
Each fix: edit `build_arena_ue.py` (or `build_arena.py` if the geometry itself is wrong), re-run the relevant script, re-run Step 1. Iterate until all of #2–#5 are green. Record every fix.

- [ ] **Step 3: Gemini visual check**

Capture a screenshot of the rebuilt level and describe it with Gemini:
```bash
"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -ExecCmds="HighResShot 1280x720"
```
(If `HighResShot` via `-ExecCmds` does not flush a file, launch the map briefly and let UE settle, then take the shot — the screenshot lands in `<UE>\Saved\Screenshots\`. This is a sanity check; if no screenshot can be captured, record that and continue.) Then:
```bash
cd C:/Users/kazda/kiro/personas
export $(grep -E '^(GEMINI_API_KEY)=' .env | xargs)
node .claude/skills/leonardo/tools/gemini-recognize.mjs --input "<screenshot path>" --prompt "Describe this game environment: is it an enclosed arena with a textured floor, walls, and pillars? List what you see and whether it reads as a real game level rather than a plain gray box."
cd C:/Users/kazda/kiro/pof
```
Record Gemini's description.

- [ ] **Step 4: Write the findings doc**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-2-arena.md` recording: the arena built (geometry + which PolyHaven textures), the functional-test result per criterion (#2–#5) on the rebuilt level, every fix made in the Step 2 loop, the Gemini visual description, whether full texturing was achieved or the geometry-only fallback was taken, and a "ready for the next sub-project" note (the environment is real; characters are still primitives).

- [ ] **Step 5: Commit + final summary**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-2-arena.md docs/features/arpg-vertical-slice/ps-2-artifacts
git commit -m "docs(features): PS-2 findings — textured combat arena, slice intact

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git log --oneline -8
```
Then post a chat summary: PS-2 outcome, the functional-test result on the new arena, fixes made, the Gemini check, and that the next sub-project is PS-3 (Leonardo 2D content) or the deferred real-character sub-project.

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec Part 1 (Blender authors the arena) → Task 1; Part 2 (PolyHaven textures) → Task 2; Part 3 (UE import + level rebuild) → Task 3; Part 4 (verify — functional test + Gemini) → Task 4. Spec DoD 1–6 map (1→T1, 2→T2, 3→T3, 4→T4 Step 1–2, 5→T4 Step 4, 6→T1–T4 commits). The collision risk (spec's #1 risk) is Task 3 Step 1.1 + Task 4 Step 2's primary fix target.
- [x] **Placeholder scan:** Task 1 and Task 2 give complete scripts. Task 3's script is specified as 5 concrete numbered operations with the exact `unreal` APIs to use rather than full code — justified: UE FBX-import + material-graph + level-actor Python is long and has 5.7 API-shape variation best resolved by running section-by-section (Step 1 says so); the contract (assets, paths, slot names, coordinates) is concrete. No "TBD"/vague-error-handling.
- [x] **Type consistency:** material slot names `M_Floor`/`M_Wall`/`M_Pillar` are set in `build_arena.py` (Task 1) and read by `build_arena_ue.py` (Task 3 Step 1.4). Texture file names `<slot>_albedo/normal/rough.jpg` written by Task 2 and consumed by Task 3 Step 1.2. `SM_Arena`, `M_Arena_*`, `/Game/ArenaBuild/` paths consistent across Tasks 3–4. `Arena.fbx` path consistent T1↔T3.
- [x] **UE project not git:** all three scripts archived into the git-tracked `ps-2-artifacts/` and committed there; PoF-repo commits are the archived scripts + the findings doc.
- [x] **Fix-loop honesty:** Task 4 Step 2 is an explicit bounded fix-loop targeting the spec's known collision/placement risks — the first run on the new arena is expected to need iteration.
- [x] **Bite-sized:** T1=4, T2=3, T3=4, T4=5 steps; each a single action.
