# Vertical-Slice Characters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vertical slice's primitive cylinder/box player and enemy with real, animated UE Mannequin characters.

**Architecture:** Enable UE 5.7's `MoverTests` experimental engine plugin (it ships `SKM_Manny` + a ready-made `ABP_Manny` Animation Blueprint — no download, no project rebuild). A UE Python script rewires `BP_VSPlayer` / `BP_VSEnemy`: remove the gray-box `StaticMeshComponent` body, set the inherited skeletal-mesh component to the mannequin + `ABP_Manny` at the standard offset, tint the enemy distinctly. No C++ change. Verified by the PS-1 functional test (gameplay intact) and a Gemini real-launch screenshot (two humanoid characters).

**Tech Stack:** UE 5.7 (`.uproject` plugin config, `unreal` Python — `SubobjectDataSubsystem`, skeletal-mesh + AnimClass on `ACharacter`), `UnrealEditor-Cmd` / `UnrealEditor`, the Leonardo skill's `gemini-recognize.mjs`.

**Spec:** `docs/superpowers/specs/2026-05-22-vertical-slice-characters-design.md`

---

## Planning-time facts

- UE5.7 project `C:\Users\kazda\Documents\Unreal Projects\PoF` — a git repo (remote `github.com/xkazm04/pof-exp`). The PoF app repo (git, Bash working dir) is `C:\Users\kazda\kiro\pof`.
- The character C++ (`AARPGPlayerCharacter`, `AARPGEnemyCharacter`, `AARPGCharacterBase`) **expects the skeletal mesh + AnimClass set per-Blueprint** — no C++ change is needed. The ragdoll/re-attach code hardcodes the mannequin offset location `(0,0,-90)`, rotation yaw `-90`.
- PS-1 added a gray-box body to each slice Blueprint as a **separate `StaticMeshComponent`** (PS-1's `build_vertical_slice.py` named it `VSBody`, attached under the root via `SubobjectDataSubsystem.add_new_subobject`). Read PS-1's `<UE>/Content/Python/build_vertical_slice.py` for the exact subobject machinery — this task uses the same APIs to *remove* `VSBody` and edit the inherited `Mesh`.
- The slice Blueprints: `/Game/VerticalSlice/BP_VSPlayer` (parent `AARPGPlayerCharacter`), `/Game/VerticalSlice/BP_VSEnemy` (parent `AARPGEnemyCharacter`).
- The UE Mannequin is in the experimental engine plugin **`MoverTests`**, on disk at `C:\Program Files\Epic Games\UE_5.7\Engine\Plugins\Experimental\MoverTests\Content\Characters\Mannequins\` — it ships prebuilt with the engine (enabling the plugin needs no rebuild). Expected assets under the `/MoverTests/` content mount: `SKM_Manny`, `SK_Mannequin`, `ABP_Manny` (+ blend spaces, animations). Exact paths are confirmed in Task 1.
- `UARPGAnimInstance` is **not** used here — `ABP_Manny` drives locomotion.
- The PS-1 functional test runs headless: `UnrealEditor-Cmd ... /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -log`.
- UE 5.7 headless Python: `-run=pythonscript` crashed on some prior content tasks; if it crashes, use the full editor `UnrealEditor.exe ... -ExecutePythonScript="<script>" -unattended`. Headless runs end with a benign shutdown crash (exit 3) AFTER the work — judge by log content.

Shorthand: `<UE>` = `C:\Users\kazda\Documents\Unreal Projects\PoF`; `UE_CMD` = `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"`; `UE_EDITOR` = `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe"`; `UPROJECT` = `"<UE>\PoF.uproject"`.

---

## File structure

| File | Action | Repo |
|------|--------|------|
| `<UE>/PoF.uproject` | Modify | UE repo (`pof-exp`) |
| `<UE>/Content/Python/setup_characters_ue.py` | Create | UE repo (`pof-exp`) |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-characters.md` | Create | app repo |

Total: 1 modified, 1 created script, 1 findings doc; ~2 commits to the UE repo + 1 to the app repo.

---

## Task 1: Enable the MoverTests plugin

**Files:**
- Modify: `<UE>/PoF.uproject`

- [ ] **Step 1: Inspect the plugin content on disk**

```bash
find "C:/Program Files/Epic Games/UE_5.7/Engine/Plugins/Experimental/MoverTests/Content/Characters/Mannequins" -iname "*.uasset" 2>/dev/null
```
Record the exact files — expect a `SKM_Manny` skeletal mesh, a `SK_Mannequin` skeleton, an `ABP_Manny` Animation Blueprint, and possibly `SKM_Quinn`/`SKM_Manny_Simple`. The `/Game`-equivalent content paths are `/MoverTests/Characters/Mannequins/<relative path without .uasset>`. Note whether a second mannequin (Quinn, or Manny_Simple) exists — it is the preferred enemy mesh for visual distinction; if only Manny exists, the enemy gets a tint material in Task 2.

- [ ] **Step 2: Enable the plugin in `PoF.uproject`**

Read `<UE>/PoF.uproject`. In its `"Plugins"` array, add (if not already present):
```json
		{
			"Name": "MoverTests",
			"Enabled": true
		}
```
Keep the JSON valid (comma placement). Do not remove or reorder existing entries.

- [ ] **Step 3: Verify the plugin loads and the assets resolve**

Create a throwaway check — write `<UE>/Content/Python/_check_mannequin.py`:
```python
import unreal
for p in [
    "/MoverTests/Characters/Mannequins/Meshes/SKM_Manny",
    "/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin",
]:
    unreal.log(f"EXISTS {p}: {unreal.EditorAssetLibrary.does_asset_exist(p)}")
# list the Mannequins folder so the real paths are visible
for a in unreal.EditorAssetLibrary.list_assets("/MoverTests/Characters/Mannequins", recursive=True):
    unreal.log(f"ASSET {a}")
unreal.log("=== mannequin check COMPLETE ===")
```
(Adjust the two probe paths to whatever Step 1 found.) Run it:
```bash
"<UE_CMD>" "<UPROJECT>" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\_check_mannequin.py" -unattended -nopause 2>&1
```
Expected: the log lists the mannequin assets under `/MoverTests/...` and prints `mannequin check COMPLETE` — confirming the plugin enabled and its content mounted. Record the real asset paths for `SKM_Manny` / `SK_Mannequin` / `ABP_Manny` (and a second mesh if present). Then delete the throwaway file: `rm "C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/_check_mannequin.py"`. If `-run=pythonscript` crashes, re-run via `"<UE_EDITOR>" "<UPROJECT>" -ExecutePythonScript="<script>" -unattended`.

- [ ] **Step 4: Commit the `.uproject` to the UE repo**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add PoF.uproject
git commit -m "$(cat <<'EOF'
feat(characters): enable the MoverTests plugin for the UE Mannequin

Provides SKM_Manny + the ready-made ABP_Manny Animation Blueprint, with no
download and no project rebuild.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 2: Wire the mannequin onto the characters

**Files:**
- Create: `<UE>/Content/Python/setup_characters_ue.py`

- [ ] **Step 1: Write the character-wiring script**

Create `<UE>/Content/Python/setup_characters_ue.py`. Using the `unreal` module, for each of `/Game/VerticalSlice/BP_VSPlayer` and `/Game/VerticalSlice/BP_VSEnemy` it must:
1. **Remove the gray-box body.** Via `unreal.SubobjectDataSubsystem`, enumerate the Blueprint's subobjects, find the `StaticMeshComponent` PS-1 added (named `VSBody`), and delete it (`delete_subobject` / `delete_subobjects`). Read PS-1's `<UE>/Content/Python/build_vertical_slice.py` for the exact `SubobjectDataSubsystem` add pattern — mirror it for removal/lookup.
2. **Configure the inherited `Mesh`.** Get the inherited skeletal-mesh component (the `ACharacter` `Mesh` — a `USkeletalMeshComponent`, typically the subobject named `CharacterMesh0` / `Mesh`). On it set: `SkeletalMeshAsset` → `SKM_Manny` (the path Task 1 confirmed); `AnimClass` → `ABP_Manny`'s generated class (load the `ABP_Manny` asset and use `.generated_class()`, or `unreal.load_class(None, "/MoverTests/.../ABP_Manny.ABP_Manny_C")`); and the relative transform — location `(0,0,-90)`, rotation `(roll=0,pitch=0,yaw=-90)`.
3. **Distinguish the enemy.** For `BP_VSEnemy` only: if Task 1 found a second mannequin mesh (Quinn / Manny_Simple), use that as the enemy's `SkeletalMeshAsset` instead. Otherwise create/assign a red-tinted material override on the enemy mesh's material slot 0 — a simple `Material` (base colour red, ~`(0.6,0.05,0.05)`) at `/Game/VerticalSlice/M_EnemyTint`, created with `unreal.MaterialFactoryNew` + `unreal.MaterialEditingLibrary` (the same pattern PS-2's `build_arena_ue.py` used), then `set_material(0, M_EnemyTint)` on the mesh component.
4. Save both Blueprints (`unreal.EditorAssetLibrary.save_asset`).

Wrap each Blueprint's work in try/except that `unreal.log_error`s and re-raises; log each step; make it idempotent (re-running must not error — e.g. `VSBody` already gone, mesh already set). Authoring section-by-section and running Step 2 between sections is recommended over writing it all blind — `SubobjectDataSubsystem` editing of an inherited component is API-shape-sensitive.

- [ ] **Step 2: Run the wiring script headless**

```bash
"<UE_CMD>" "<UPROJECT>" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\setup_characters_ue.py" -unattended -nopause 2>&1
```
Expected: runs to completion, the log shows `VSBody` removed and the mannequin mesh + `ABP_Manny` set on both Blueprints, both saved. If `-run=pythonscript` crashes, re-run via `"<UE_EDITOR>" "<UPROJECT>" -ExecutePythonScript="<script>" -unattended`. Iterate on errors (generous timeout, e.g. 900000 ms).

- [ ] **Step 3: Commit the script to the UE repo**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Python/setup_characters_ue.py Content/VerticalSlice/BP_VSPlayer.uasset Content/VerticalSlice/BP_VSEnemy.uasset
git add Content/VerticalSlice/M_EnemyTint.uasset 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat(characters): mannequin meshes on BP_VSPlayer / BP_VSEnemy

Removes the gray-box primitive bodies; sets the inherited skeletal-mesh
component to SKM_Manny + ABP_Manny at the standard mannequin offset; the enemy
is visually distinguished.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Verify + findings

**Files:**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-characters.md` (app repo)

- [ ] **Step 1: Re-run the PS-1 functional test**

```bash
"<UE_CMD>" "<UPROJECT>" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -log 2>&1
```
Expected: all four criteria (#2-#5) report pass, run Success. The capsule still drives movement/collision; the skeletal mesh is visual. Judge by the automation log's `Assertion passed` lines + `Result={Success}`, not the process exit code. If it fails, diagnose — the mesh swap should not affect gameplay; a failure points at the `VSBody` removal disturbing something or the mesh collision interfering (set the mannequin mesh's collision to `NoCollision` if so — the capsule handles gameplay collision).

- [ ] **Step 2: Launch the slice and capture a screenshot**

```bash
"<UE_EDITOR>" "<UPROJECT>" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -ExecCmds="HighResShot 1280x720" 2>&1
```
(If `HighResShot` via `-ExecCmds` does not flush a file, let the game run ~20-25 s then take the shot; screenshots land in `<UE>\Saved\Screenshots\`. Pick the newest.)

- [ ] **Step 3: Gemini check the characters**

```bash
cd C:/Users/kazda/kiro/personas
export $(grep -E '^(GEMINI_API_KEY)=' .env | xargs)
node .claude/skills/leonardo/tools/gemini-recognize.mjs --input "<screenshot path>" --prompt "Describe the two characters in this game scene. Are they humanoid figures (a person/character model), or simple geometric shapes (a cylinder, a box)? Are the two visually distinct from each other? Is each standing in a natural pose with feet on the floor, or in a stiff T-pose / sunk into the ground?"
cd C:/Users/kazda/kiro/pof
```
Record the description. The gate: Gemini confirms two **humanoid characters** (not a cylinder + box), visually distinct, standing naturally on the floor. If Gemini reports a stiff T/A-pose, `ABP_Manny` is not animating a plain `ACharacter` — see the spec's fallback (migrate the standard mannequin + an `ACharacter`-based AnimBP from a Third Person template); diagnose and either fix the `AnimClass` or take the fallback, then re-do Steps 2-3. If Gemini reports the character floating or sunk, adjust the `Mesh` relative location in `setup_characters_ue.py` and re-run Task 2 Step 2 + this step.

- [ ] **Step 4: Write the findings doc**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-characters.md` recording: the mannequin source (`MoverTests` plugin), what was wired (mesh + `ABP_Manny`, gray-box bodies removed, enemy distinguished), the functional-test result (#2-#5), the Gemini description of the characters, whether `ABP_Manny` animated a plain `ACharacter` (or the fallback was needed), the accepted gap (no attack-swing animation), and a note that this completes the vertical-slice build-out.

- [ ] **Step 5: Commit + final summary**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-characters.md
git commit -m "$(cat <<'EOF'
docs(features): characters sub-project findings — UE Mannequin

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```
Then post a chat summary: the characters outcome (mannequin player + enemy, animated), the functional-test result, the Gemini confirmation, and that the vertical-slice build-out (gameplay → arena → textures → HUD → characters) is complete.

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec Part 1 (enable the mannequin content) → Task 1; Part 2 (wire the characters — remove gray-box, set mesh + `ABP_Manny`, distinguish enemy) → Task 2; Part 4 (verify — functional test + Gemini) → Task 3. Part 3 (no C++ build) — no task needed, correctly. Spec DoD 1-6 map (1→T1, 2→T2, 3→T3 Step 1, 4→T3 Steps 2-3, 5→T3 Step 4, 6→all commits).
- [x] **Placeholder scan:** Task 1's `.uproject` edit and the check script are concrete. Task 2's script is specified as 4 concrete numbered operations with the exact `unreal` APIs + the PS-1 `build_vertical_slice.py` reference for the `SubobjectDataSubsystem` idiom — UE subobject Python is API-shape-sensitive and best done section-by-section (Step 1 says so); the contract (asset paths, what to remove/set, the transform, the enemy distinction) is concrete. No "TBD"/vague handling.
- [x] **Type consistency:** the `MoverTests` mannequin asset paths confirmed in Task 1 Step 1/3 feed Task 2 Step 1. `VSBody` (PS-1's component name) is the removal target. `BP_VSPlayer`/`BP_VSEnemy` paths, the functional-test path, and PS-1's `build_vertical_slice.py` reference are consistent with the prior sub-projects. The mannequin offset `(0,0,-90)`/yaw `-90` matches the spec and the C++ ragdoll code.
- [x] **No C++ / no rebuild:** confirmed — `MoverTests` is a prebuilt engine plugin, no project C++ change; correctly no build task.
- [x] **Two repos:** `.uproject` + script → UE repo (`cd` into the UE project); findings → app repo. Explicit per task.
- [x] **Bite-sized:** T1=4, T2=3, T3=5 steps; each a single action.
