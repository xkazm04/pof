# Static Lighting + Lightmass Bake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the slice arena baked GI + baked soft shadows (Stationary lights + a Lightmass bake), scoped so sibling sessions stay on Lumen, with gameplay intact and the arena never black.

**Architecture:** Blender authors a 2nd UV channel (lightmap atlas) on the joined arena. `build_arena_ue.py` points `SM_Arena`'s lightmap at channel 1, switches the lights Movable→Stationary, spawns a Lightmass Importance Volume, and sets the existing arena PostProcessVolume's GI method → `None` (scopes baked-GI display to this level instead of flipping the project off Lumen). A Lightmass bake (headless `ResavePackages -buildlighting`, with a documented manual-editor fallback) produces the baked data. Verified by Gemini ("lit, not black, baked shadows") + the functional test.

**Tech Stack:** Blender 4.2 headless Python, UE 5.7 editor Python (`unreal`), UE Lightmass, TypeScript (PoF app, vitest), the `e2e/helpers` verification primitives.

**Spec:** `docs/superpowers/specs/2026-05-23-env-lightmass-bake-design.md`

---

## Environment constants

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

**Lessons baked into this plan (from session 1):**
- UE 5.7 FBX import + level Python needs the **full editor** (`-ExecutePythonScript`), NOT `-run=pythonscript` (the Interchange importer asserts on no-Slate). `build_arena_ue.py` self-quits.
- Headless UE exits **non-zero on shutdown** (benign) — judge by log content.
- `PowerShell Start-Process -ArgumentList` splits `-ExecCmds=HighResShot 1280x720` on the space; pass the arg line as ONE verbatim string (see Task 4).
- The Gemini script reads `GEMINI_API_KEY` from the **process env** (no dotenv); export it from `personas/.env`.
- The UE tree is **shared by ~8 sessions** — use `-abslog`, commit narrowly, never broad `git add`.
- App repo (`xkazm04/pof`) commits **local only, do NOT push**. UE repo (`xkazm04/pof-exp`) may be pushed.

---

## File Structure

**PoF app (`C:\Users\kazda\kiro\pof`):**
- Modify: `src/lib/module-registry.ts` — add a lighting knowledge tip to the `level-design` module's `knowledgeTips` array.

**UE project (`C:\Users\kazda\Documents\Unreal Projects\PoF`):**
- Modify: `Content/ArenaBuild/build_arena.py` — add a `lightmap_pack` UV1 on the joined arena before export.
- Modify: `Content/Python/build_arena_ue.py` — lightmap channel on `SM_Arena`; lights Movable→Stationary; a Lightmass Importance Volume; the PPV GI-method→None override.

**Docs (PoF app):**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-lightmass-bake.md` — findings.

---

## Task 1: PoF — level-design lighting knowledge tip

**Files:**
- Modify: `src/lib/module-registry.ts` (the `level-design` module `knowledgeTips` array)

Codify the Movable-vs-Stationary tradeoff + the bake workflow + the per-PPV GI-scoping trick so future UE5 lighting work doesn't relearn it.

- [ ] **Step 1: Add the knowledge tip**

In `src/lib/module-registry.ts`, the `level-design` module's `knowledgeTips` array currently ends with the world-aligned-UV tip added in session 1. Find:

```typescript
      { title: 'Blender→UE: author in metres, scale 1.0, world-aligned UVs', content: 'Author geometry in metres. Blender FBX export: apply_unit_scale=True, global_scale=1.0 (the exporter writes the FBX in centimetres). UE import: import_uniform_scale=1.0 — NOT 100, which makes the mesh 100x oversized. For tiling textures, unwrap world-aligned planar (one repeat per N metres) rather than cube_project, so the texture reads at a uniform real-world scale with no repeating grid; the material then samples UV0 directly (TextureCoordinate tiling 1.0).', source: 'best-practice' },
    ],
```

Replace it with (adds one entry after it):

```typescript
      { title: 'Blender→UE: author in metres, scale 1.0, world-aligned UVs', content: 'Author geometry in metres. Blender FBX export: apply_unit_scale=True, global_scale=1.0 (the exporter writes the FBX in centimetres). UE import: import_uniform_scale=1.0 — NOT 100, which makes the mesh 100x oversized. For tiling textures, unwrap world-aligned planar (one repeat per N metres) rather than cube_project, so the texture reads at a uniform real-world scale with no repeating grid; the material then samples UV0 directly (TextureCoordinate tiling 1.0).', source: 'best-practice' },
      { title: 'UE5 lighting: Movable (Lumen, headless) vs Static/Stationary (baked)', content: 'Movable lights + Lumen = dynamic GI, works headless, no bake, but flatter. Static/Stationary lights = baked GI + soft shadows via a Lightmass bake — richer, but a static-mesh arena renders BLACK until the bake runs. To bake: author a 2nd (non-overlapping) lightmap UV channel (Blender uv.lightmap_pack), set the mesh light_map_coordinate_index=1, lights→Stationary, add a LightmassImportanceVolume, then Build Lighting (editor) or headless ResavePackages -buildlighting -AllowCommandletRendering. The project defaults to Lumen; to show baked GI WITHOUT flipping the whole project off Lumen, override the GI method to None on a PostProcessVolume (scopes baked lighting to that level).', source: 'best-practice' },
    ],
```

- [ ] **Step 2: Typecheck (filter the pre-existing leonardo.ts error)**

Run: `npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS"`
Expected: no output (the only error in the repo is the pre-existing `src/lib/leonardo.ts:208` `Uint8Array` one, which is filtered out; the new tip is the same `{title, content, source}` shape).

- [ ] **Step 3: Lint the file**

Run: `npx eslint src/lib/module-registry.ts`
Expected: `0 errors` (the 7 pre-existing hex-color warnings at lines ~367-415 are unrelated; no new warnings near the edited `knowledgeTips`).

- [ ] **Step 4: Commit (PoF app — local only, do NOT push)**

```bash
cd "C:/Users/kazda/kiro/pof"
git add src/lib/module-registry.ts
git commit -m "feat(level-design): knowledge tip for UE5 static-lighting + Lightmass bake

Movable/Lumen vs Static/Stationary+bake tradeoff, the lightmap-UV + bake
workflow, and the per-PostProcessVolume GI-method scoping trick (baked GI in
one level without flipping the project off Lumen).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Game — lightmap UV channel in `build_arena.py`

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\build_arena.py`

Add a non-overlapping lightmap unwrap into a 2nd UV layer on the joined arena. UV0 stays the world-aligned texture UVs.

- [ ] **Step 1: Insert the lightmap-pack block after the join**

In `build_arena.py`, find the join + export boundary:

```python
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
arena = bpy.context.active_object
arena.name = "Arena"

# --- export FBX ------------------------------------------------------------
```

Replace it with (inserts the lightmap block between the rename and the export comment):

```python
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
arena = bpy.context.active_object
arena.name = "Arena"

# --- lightmap UV (channel 1) ----------------------------------------------
# A non-overlapping unwrap into a 2nd UV layer for the Lightmass bake. UV0
# stays the world-aligned texture UVs; UV1 is the lightmap atlas. UE points
# light_map_coordinate_index at channel 1.
lm = arena.data.uv_layers.new(name="Lightmap")
arena.data.uv_layers.active = lm
bpy.ops.object.select_all(action='DESELECT')
arena.select_set(True)
bpy.context.view_layer.objects.active = arena
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
try:
    bpy.ops.uv.lightmap_pack(PREF_CONTEXT='ALL_FACES', PREF_MARGIN_DIV=0.2)
except TypeError:
    bpy.ops.uv.lightmap_pack()   # older/newer arg names -> defaults pack all
bpy.ops.object.mode_set(mode='OBJECT')
arena.data.uv_layers.active_index = 0   # UV0 (texture UVs) is the render/active layer
print("LIGHTMAP_UV_PACKED channels=%d" % len(arena.data.uv_layers))

# --- export FBX ------------------------------------------------------------
```

- [ ] **Step 2: Re-export the FBX (run Blender headless)**

Run (PowerShell):

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --background --python "C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\build_arena.py"
```

Expected: stdout contains `LIGHTMAP_UV_PACKED channels=2` AND `ARENA_EXPORTED C:\...\Arena.fbx`, exit 0. If `channels` is not 2, the lightmap layer wasn't created — stop and inspect.

- [ ] **Step 3: Commit (UE repo)**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/ArenaBuild/build_arena.py Content/ArenaBuild/Arena.fbx
git commit -m "feat(arena): lightmap UV channel (uv.lightmap_pack) for Lightmass bake

Add a non-overlapping 2nd UV layer (lightmap atlas) on the joined arena; UV0
stays the world-aligned texture UVs. Re-export Arena.fbx with both channels.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Game — static-lighting setup in `build_arena_ue.py`

**Files:**
- Modify: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_arena_ue.py`

Four edits in one file: (a) mesh lightmap channel; (b) lights Movable→Stationary; (c) Lightmass Importance Volume; (d) PPV GI-method→None.

- [ ] **Step 1: Use the authored lightmap UV on import**

In `import_arena_mesh`, find:

```python
        sm_data.set_editor_property("generate_lightmap_u_vs", True)
```

Replace with (use the Blender-authored channel 1 instead of auto-generating):

```python
        # Blender now authors UV1 as the lightmap (uv.lightmap_pack); don't
        # auto-generate a 3rd channel.
        sm_data.set_editor_property("generate_lightmap_u_vs", False)
```

- [ ] **Step 2: Point the mesh's lightmap at channel 1**

In `import_arena_mesh`, find the collision block followed by the save:

```python
        else:
            unreal.log_warning("[build_arena_ue] SM_Arena has no body_setup")

        asset_lib.save_asset(SM_ARENA_PATH)
```

Replace with (insert the lightmap settings before the save):

```python
        else:
            unreal.log_warning("[build_arena_ue] SM_Arena has no body_setup")

        # Lightmap: use Blender-authored UV channel 1 + a modest resolution.
        mesh.set_editor_property("light_map_coordinate_index", 1)
        mesh.set_editor_property("light_map_resolution", 256)
        try:
            num_uv = mesh.get_num_uv_channels(0)
        except Exception:
            num_uv = -1
        _log("SM_Arena lightmap: coord_index=1, res=256, uv_channels=%d" % num_uv)

        asset_lib.save_asset(SM_ARENA_PATH)
```

- [ ] **Step 3: Switch lights Movable → Stationary**

In `rebuild_level`, find the entire Movable-lights block:

```python
        # --- Force lights Movable so the STATIC arena is lit without a bake --
        # The arena StaticMesh is STATIC mobility and this pipeline never runs
        # Lightmass. With STATIONARY/STATIC lights the un-baked arena renders
        # pitch black (UE shows "LIGHTING NEEDS TO BE REBUILT"). Movable lights
        # light it fully dynamically -- no build step required.
        #
        # The DirectionalLight is also angled down (pitch -50 deg) and given a
        # healthy intensity: at its default rotation (0,0,0) it points straight
        # along +X, grazing the floor at ~0 deg so the floor reads near-black.
        # The SkyLight intensity is raised so walls/floor in shadow still read.
        for actor in actor_subsystem.get_all_level_actors():
            if isinstance(actor, unreal.DirectionalLight):
                actor.set_actor_rotation(
                    unreal.Rotator(0.0, -50.0, -35.0), False)
                for comp in actor.get_components_by_class(
                        unreal.DirectionalLightComponent):
                    comp.set_mobility(unreal.ComponentMobility.MOVABLE)
                    comp.set_editor_property("intensity", 6.0)
                _log("DirectionalLight -> Movable, pitch -50, intensity 6.0")
            elif isinstance(actor, unreal.SkyLight):
                for comp in actor.get_components_by_class(
                        unreal.SkyLightComponent):
                    comp.set_mobility(unreal.ComponentMobility.MOVABLE)
                    comp.set_editor_property("intensity", 3.0)
                    try:
                        comp.set_editor_property("real_time_capture", True)
                    except Exception:
                        pass
                _log("SkyLight -> Movable, intensity 3.0, real-time capture")
```

Replace with:

```python
        # --- Lights -> Stationary for a baked-GI arena -----------------------
        # The static arena gets baked GI + soft shadows from the Lightmass bake;
        # the movable player/enemy get a dynamic shadow from the Stationary
        # directional + GI from the volumetric lightmap. NOTE: Stationary lights
        # render the static arena BLACK until a Lightmass bake runs -- the bake
        # (ResavePackages -buildlighting, or a manual editor Build Lighting) is a
        # required follow-up step, gated by the "lit, not black" verification.
        for actor in actor_subsystem.get_all_level_actors():
            if isinstance(actor, unreal.DirectionalLight):
                actor.set_actor_rotation(
                    unreal.Rotator(0.0, -50.0, -35.0), False)
                for comp in actor.get_components_by_class(
                        unreal.DirectionalLightComponent):
                    comp.set_mobility(unreal.ComponentMobility.STATIONARY)
                    comp.set_editor_property("intensity", 6.0)
                _log("DirectionalLight -> Stationary, pitch -50, intensity 6.0")
            elif isinstance(actor, unreal.SkyLight):
                for comp in actor.get_components_by_class(
                        unreal.SkyLightComponent):
                    comp.set_mobility(unreal.ComponentMobility.STATIONARY)
                    comp.set_editor_property("intensity", 3.0)
                _log("SkyLight -> Stationary, intensity 3.0")
```

- [ ] **Step 4: Add the Lightmass Importance Volume function**

In `build_arena_ue.py`, immediately before `def add_atmosphere(actor_subsystem):`, insert:

```python
def add_lightmass_importance_volume(actor_subsystem):
    """Spawn a Lightmass Importance Volume around the arena (idempotent).

    Best-effort: it focuses bake quality + builds the volumetric lightmap that
    lights the movable player/enemy. Not load-bearing for "not black" -- if
    spawning/sizing fails, Lightmass falls back to the level bounds.
    """
    try:
        for actor in actor_subsystem.get_all_level_actors():
            if isinstance(actor, unreal.LightmassImportanceVolume):
                actor_subsystem.destroy_actor(actor)
        liv = actor_subsystem.spawn_actor_from_class(
            unreal.LightmassImportanceVolume, unreal.Vector(0.0, 0.0, 200.0))
        liv.set_actor_label("Arena_LightmassImportance")
        # Default volume brush is a ~200uu cube; scale to cover the ~2050uu
        # arena + headroom (~4800x4800x1600 uu).
        liv.set_actor_scale3d(unreal.Vector(24.0, 24.0, 8.0))
        _log("Spawned LightmassImportanceVolume (scale 24,24,8)")
    except Exception as exc:
        unreal.log_warning(
            "[build_arena_ue] LightmassImportanceVolume failed (%s); "
            "bake will use level bounds" % str(exc))
```

- [ ] **Step 5: Scope baked GI to the arena PPV (in `add_atmosphere`)**

In `add_atmosphere`, find the write-back + read-back block:

```python
    settings.set_editor_property("color_saturation",
                                 unreal.Vector4(1.1, 1.1, 1.1, 1.0))
    settings.set_editor_property("override_color_saturation", True)
    ppv.set_editor_property("settings", settings)

    # Read back the scalar values to confirm the field names are correct.
    chk = ppv.get_editor_property("settings")
```

Replace with (insert the GI override before the write-back, and read it back):

```python
    settings.set_editor_property("color_saturation",
                                 unreal.Vector4(1.1, 1.1, 1.1, 1.0))
    settings.set_editor_property("override_color_saturation", True)
    # Scope baked GI to this volume instead of flipping the project off Lumen:
    # GI method None -> the arena uses baked static lighting + skylight only.
    # Other maps (sibling sessions) keep the project-default Lumen.
    gi_scoped = False
    try:
        settings.set_editor_property(
            "dynamic_global_illumination_method",
            unreal.DynamicGlobalIlluminationMethod.NONE)
        settings.set_editor_property(
            "override_dynamic_global_illumination_method", True)
        settings.set_editor_property(
            "reflection_method", unreal.ReflectionMethod.NONE)
        settings.set_editor_property("override_reflection_method", True)
        gi_scoped = True
    except Exception as exc:
        unreal.log_warning(
            "[build_arena_ue] PPV GI override failed (%s); baked GI may need "
            "the global DefaultEngine.ini r.DynamicGlobalIlluminationMethod=0 "
            "flip" % str(exc))
    ppv.set_editor_property("settings", settings)

    # Read back the scalar values to confirm the field names are correct.
    chk = ppv.get_editor_property("settings")
    if gi_scoped:
        try:
            _log("PPV GI method = %s (None = baked, scoped to this level)"
                 % str(chk.get_editor_property(
                     "dynamic_global_illumination_method")))
        except Exception:
            pass
```

- [ ] **Step 6: Call the importance volume from `rebuild_level`**

In `rebuild_level`, find:

```python
        add_atmosphere(actor_subsystem)

        level_subsystem.save_current_level()
```

Replace with:

```python
        add_atmosphere(actor_subsystem)
        add_lightmass_importance_volume(actor_subsystem)

        level_subsystem.save_current_level()
```

- [ ] **Step 7: Commit (UE repo) — run happens in Task 4**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Python/build_arena_ue.py
git commit -m "feat(arena): static-lighting setup (Stationary lights, lightmap, baked-GI PPV)

SM_Arena uses authored lightmap UV channel 1 (res 256); DirectionalLight +
SkyLight -> Stationary; spawn a LightmassImportanceVolume; and scope baked GI
to the arena by setting the PostProcessVolume GI method -> None (keeps siblings
on Lumen). Requires a Lightmass bake (next) or the arena renders black.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Run the pipeline, bake, and verify

**Files:** none except the findings doc at the end.

- [ ] **Step 1: BEFORE screenshot (current Movable-lit state, pre-rebuild)**

Run (PowerShell):

```powershell
$shots = "C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Screenshots\WindowsEditor"
$b = (Get-ChildItem $shots -Filter *.png | Sort LastWriteTime -Desc | Select -First 1).Name
$argline = '"C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -NoLoadingScreen -ExecCmds="HighResShot 1280x720"'
$p = Start-Process -FilePath "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" -ArgumentList $argline -PassThru
Start-Sleep -Seconds 55
try { & taskkill /PID $p.Id /T /F 2>&1 | Out-Null } catch {}
Start-Sleep -Seconds 3
$a = (Get-ChildItem $shots -Filter *.png | Sort LastWriteTime -Desc | Select -First 1).Name
if ($a -ne $b) { "BEFORE_OK: $a" } else { "NO SHOT" }
```

Copy the new PNG to `docs/features/arpg-vertical-slice/scenario-runs/img/env-lighting-before.png` (app repo).

- [ ] **Step 2: Run the Blender re-export** (done in Task 2 Step 2; re-run if `Arena.fbx` is stale)

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --background --python "C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild\build_arena.py"
```
Expected: `LIGHTMAP_UV_PACKED channels=2`, `ARENA_EXPORTED`.

- [ ] **Step 3: Run the UE import + level rebuild (full editor)**

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" -ExecutePythonScript="C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/build_arena_ue.py" -unattended -nopause -nosplash >/dev/null 2>&1; echo "exit=$?"
LOG="/c/Users/kazda/Documents/Unreal Projects/PoF/Saved/Logs/PoF.log"; grep -E "build_arena_ue\]" "$LOG" | grep -E "lightmap: coord_index|uv_channels|-> Stationary|LightmassImportance|PPV GI method|Saved level|COMPLETE|FAILED"
```

Expected log lines: `SM_Arena lightmap: coord_index=1, res=256, uv_channels=2`; `DirectionalLight -> Stationary`; `SkyLight -> Stationary`; `PPV GI method = ...None...`; `Spawned LightmassImportanceVolume`; `Saved level`; `COMPLETE`.
- If `uv_channels` ≠ 2, the lightmap UV is missing — fix Task 2, re-run.
- If `PPV GI method` is absent (override failed), note it; the global flip is the Step 6 fallback.
- (`PoF.log` may be clobbered by a sibling — if absent, check `PoF_2.log` and the most recent `PoF*.log` by mtime.)

- [ ] **Step 4: Run the re-texture (restore dungeon-stone v2 + tiling 1.0)**

`build_arena_ue.py` rebuilds materials from the original textures; re-run retexture to restore the session-1 look:

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" -ExecutePythonScript="C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/retexture_arena_ue.py" -unattended -nopause -nosplash >/dev/null 2>&1; echo "exit=$?"
for f in $(ls -t "/c/Users/kazda/Documents/Unreal Projects/PoF/Saved/Logs"/PoF*.log | head -3); do grep -E "retexture_arena_ue\]" "$f" | grep -E "tiling 1.00|COMPLETE"; done | sort -u
```
Expected: `Rebuilt material (tiling 1.00)` ×3 + `COMPLETE`.

- [ ] **Step 5: Run the Lightmass bake (headless attempt)**

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" -run=ResavePackages -map=VerticalSlice -buildlighting -Quality=Medium -AllowCommandletRendering -unattended -nopause -abslog="C:/Users/kazda/kiro/pof/_bake.log" >/dev/null 2>&1; echo "exit=$?"
grep -iE "Lighting build|LogStaticLightingSystem|Lightmass|build failed|Lighting need|finished|complete" "/c/Users/kazda/kiro/pof/_bake.log" | tail -25
```

Expected: log shows Lightmass running and a "Lighting build" completion (e.g. `LogStaticLightingSystem: ... Lighting build ... completed`) and saves the map. The bake writes `Content/Maps/VerticalSlice_BuiltData.uasset`.

**If the headless bake fails or produces no built data (Step 7 render is black):** fall back to the **manual editor bake** — tell the operator: open the editor on `/Game/Maps/VerticalSlice`, menu **Build → Build Lighting Only** (Quality: Medium), wait for completion, **File → Save All**, then re-run Step 7. (The user accepted a possible manual step.)

- [ ] **Step 6: (Fallback only) global GI flip if the PPV scoping didn't take**

Only if Step 3 reported the PPV GI override failed AND Step 7 shows the arena is **not** using baked GI (still Lumen-lit / no baked shadows): edit `Config/DefaultEngine.ini`, add under a `[/Script/Engine.RendererSettings]` section:

```ini
[/Script/Engine.RendererSettings]
r.DynamicGlobalIlluminationMethod=0
r.ReflectionMethod=0
```

Then re-run Step 5. (This affects sibling sessions — only use if the scoped path failed; the user accepted this as the fallback.)

- [ ] **Step 7: AFTER screenshot + Gemini gate (lit, not black, baked shadows)**

```powershell
$shots = "C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Screenshots\WindowsEditor"
$b = (Get-ChildItem $shots -Filter *.png | Sort LastWriteTime -Desc | Select -First 1).Name
$argline = '"C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -NoLoadingScreen -ExecCmds="HighResShot 1280x720"'
$p = Start-Process -FilePath "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" -ArgumentList $argline -PassThru
Start-Sleep -Seconds 55
try { & taskkill /PID $p.Id /T /F 2>&1 | Out-Null } catch {}
Start-Sleep -Seconds 3
$a = (Get-ChildItem $shots -Filter *.png | Sort LastWriteTime -Desc | Select -First 1)
"AFTER: $($a.Name)"
```

View the PNG (Read tool) — it MUST NOT be black. Then Gemini:

```bash
cd "/c/Users/kazda/kiro/personas" && export GEMINI_API_KEY=$(grep -E "^GEMINI_API_KEY=" .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'); P=$(cat "/c/Users/kazda/kiro/pof/e2e/fixtures/gemini-prompts/arena-check.txt"); node "/c/Users/kazda/kiro/personas/.claude/skills/leonardo/tools/gemini-recognize.mjs" --input "<AFTER png path>" --prompt "$P" 2>&1 | tail -20
```

Expected: Gemini reports the scene **lit (not black/unlit)** and ideally notes shadows. **GATE: if the arena is black/unlit, the bake did NOT land — do the Step 5 manual fallback and re-run. Do NOT declare success on a black arena.** Copy the AFTER PNG to `docs/.../img/env-lighting-after.png`.

- [ ] **Step 8: Functional test (gameplay intact)**

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && rm -f /c/Users/kazda/kiro/pof/_vsft.log; "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" "/Game/Maps/VerticalSlice" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -abslog="C:/Users/kazda/kiro/pof/_vsft.log" >/dev/null 2>&1; echo "exit=$?"; grep -E "Assertion passed|Assertion failed|Result=\{|TEST COMPLETE" "/c/Users/kazda/kiro/pof/_vsft.log" | tail -10
```

Expected: `Result={Success}`, `#2 movement ... moved` PASS, `EXIT CODE: 0`. Clean up: `rm -f /c/Users/kazda/kiro/pof/_vsft.log /c/Users/kazda/kiro/pof/_bake.log`.

- [ ] **Step 9: Write the findings doc (PoF app)**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-lightmass-bake.md`: lightmap UV1 + Stationary lights + importance volume + PPV-scoped baked GI; whether the headless bake worked or the manual fallback was needed; the Gemini "lit, not black, baked shadows" verdict; the functional-test result; before/after screenshots. Note the per-PPV-vs-global GI outcome and any new UE-Python API names learned (lightmap props, GI-method enums, the bake command).

- [ ] **Step 10: Commit UE assets (UE repo) + findings (app repo, local)**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/ArenaBuild/SM_Arena.uasset Content/Maps/VerticalSlice.umap Content/Maps/VerticalSlice_BuiltData.uasset
git status --short | head
# stage only arena-concern assets that THIS session changed (mesh, level, baked data,
# and the M_Arena_*/textures if retexture re-ran); NOT sibling C++/assets.
git commit -m "chore(arena): baked lighting (Stationary lights + Lightmass bake)

SM_Arena lightmap channel 1; VerticalSlice rebuilt with Stationary lights +
LightmassImportanceVolume + baked-GI PPV; VerticalSlice_BuiltData holds the
Lightmass bake. Functional test green; arena lit (not black) with baked shadows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

```bash
cd "C:/Users/kazda/kiro/pof"
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-lightmass-bake.md docs/features/arpg-vertical-slice/scenario-runs/img/env-lighting-before.png docs/features/arpg-vertical-slice/scenario-runs/img/env-lighting-after.png docs/superpowers/plans/2026-05-23-env-lightmass-bake.md
git commit -m "docs(env): static-lighting + Lightmass bake findings (folder-05 session 2)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(If a sibling already committed the shared `.umap`/`_BuiltData` — `git status` shows no diff — skip those paths, as in session 1.)

---

## Final validation

- [ ] **Step 1: PoF-app tests**

Run: `cd "C:/Users/kazda/kiro/pof" && npm run test`
Expected: all tests pass (this session adds no new tests; confirms no regression).

- [ ] **Step 2: Confirm the definition of done**

Verify each spec DoD: (1) lightmap UV1 packed + FBX re-exported; (2) `SM_Arena` lightmap channel 1, lights Stationary, importance volume, PPV GI→baked (read-back confirmed); (3) the bake landed (headless or manual fallback); (4) Gemini confirms **lit, not black, baked shadows**; (5) functional test green; (6) lighting knowledge tip added. Any unchecked item: return to its task. **If the arena is black (bake never landed), this session is NOT done — report the bake as the blocker rather than declaring success.**

---

## Self-review notes (addressed during writing)

- **Bake-command risk** is the central unknown — Step 5 attempts headless `ResavePackages -buildlighting` and Step 7 GATES on a non-black render, with an explicit manual-editor-bake fallback. The plan never declares success on a black arena.
- **GI scoping** uses the per-PPV override (Task 3 Step 5) with a read-back canary; the global `DefaultEngine.ini` flip is a clearly-fenced Step 6 fallback only.
- **Shared-tree hazards** (session-1 lessons) carried in: `-abslog`, narrow `git add`, sibling-clobbered-log handling, "skip if no diff" on the shared `.umap`/`_BuiltData`.
- **API-name risks** (lightmap props, `DynamicGlobalIlluminationMethod`/`ReflectionMethod` enums, `get_num_uv_channels`, `lightmap_pack` args) are guarded with try/except + read-back logging, mirroring session 1's `override_*`/`fog_inscattering_luminance` discoveries.
- Type/name consistency: `add_lightmass_importance_volume` defined (Task 3 Step 4) and called (Step 6); `light_map_coordinate_index`=1 set on the mesh (Step 2) matches the Blender UV1 (Task 2); `gi_scoped` flag used consistently in Task 3 Step 5.
