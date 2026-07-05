# Recipe / handoff — AI character mesh → UE 5.8 MetaHuman conform (the auto-rig bridge)

> Research-originated **recipe + handoff** (not built). From the `/research` run 2026-07-05 on "From AI to Metahuman — Best New UE 5.8 Workflow for Custom Character" (Stefan 3D AI). This is the **concrete, verified end-to-end recipe** for [Candidate B](../ue5-capability-integration-candidates.md#candidate-b--generated-mesh--metahuman-conform-closes-the-auto-rig-gap-) — the "generated 3D shape has no rig" gap in PoF's asset pipeline. Effort **XL** → spec/handoff per the action-by-effort rule. **UE 5.8 is installed locally** (not an install blocker); the remaining dependency is a live editor session (conform is editor-dependent) + Asset Forge wiring.

## Why this closes a real gap

PoF's official asset pipeline (impact-map `visual-gen`) is **Leonardo 2D → Hunyuan3D-2 / TripoSR shape → CLIP/geometry/Qwen-VL critique** — a **shape-only** output with **no rig**, so the generated character is not animatable. `rig-presets.ts` names MetaHuman only as a *retarget target* (bone table), with an empty `mixamoMapping` and the comment "MetaHuman requires custom retargeting workflow." UE 5.8's **Mesh-to-MetaHuman conform** *is* that custom workflow: it turns an arbitrary-topology human mesh into a fully-rigged MetaHuman (facial + body rig, Live Link, markerless-mocap-ready). It's the missing `design → 3D → playable character` link, and it retires the placeholder UniRig path.

## Automation reality — GROUND-TRUTHED on the real install (2026-07-05)

Two headless introspection probes on **UE 5.8.0 Release** (`UnrealEditor-Cmd PoF.uproject -run=pythonscript -nullrhi`) settle the feasibility question — and the answer is **stronger than the release notes imply**:

- **The full conform API is Python-exposed and loads in a HEADLESS commandlet** — no editor GUI, no `-nullrhi`-blocker. Verified methods on `unreal.MetaHumanCharacterEditorSubsystem`:
  - `conform_to_target_meshes` — **the "conform to a custom mesh" entry point.**
  - `conform_body`, `conform_body_to_target`, `set_body_mesh`, `set_body_joints`, `set_body_constraints`.
  - `get_face_model_coefficients` / `set_face_model_coefficients` — the exact conform-to-PCA API from the 5.8 notes.
  - `get_mesh_for_body_conforming{,_from_dna,_from_template}`, `get_joints_for_body_conforming{,_from_dna,_from_template}`, `get_preset_body_key_points`, `get_mesh_data_for_conforming`.
  - Plus the legacy MetaHuman-Identity path: `MetaHumanIdentityFace.conform`, `is_conformal_rig_valid`, and the `MetaHumanCharacterBodyFitOptions.FIT_FROM_MESH_ONLY / _AND_SKELETON / _TO_FIXED_SKELETON` fit modes.
- **The catch that hid it:** these classes live in the **`MetaHumanCharacter` (Experimental) plugin, which `PoF.uproject` does NOT enable** — with the project's default plugin set the API is absent (probe 1: 108 MH classes, `HAS_MetaHumanCharacter=False`). Enabling it (`-EnablePlugins=MetaHumanCharacter`, or add it to the `.uproject`) jumps to **243 MH classes** and surfaces the full subsystem (probe 2). So Candidate B's original "scriptable, headless" claim is **vindicated** once the plugin is on — the earlier "editor-dependent, no commandlet" tempering (from the release-notes' silence) was too pessimistic.
- **Caveat (fidelity, not availability):** without the **MetaHuman Optional Content** installed the plugin logs *"initialized with limited features"* — the API loads but some presets/textures are limited. Install the optional content for full-fidelity conform output.
- **Manual point-align remains a QUALITY concern, not an API gap.** Auto-solve mis-detects complex topology (fused fingers → 4 markers on 2). Mitigate with input-mesh prep (the cheap lever) and/or a scripted correction via `set_face_model_coefficients` / the body-key-points API — both now confirmed callable headlessly. See the gotchas below.

## The recipe (grounded in the video)

**Prerequisites:** UE 5.8 + MetaHuman Creator plugins (Content > enable MetaHuman); Blender (free); the free **"MetaHuman conform body" size reference** (Fab); a 3D generator (Tripo in the video — any works). For markerless animation later: the **MetaHuman Animator markerless motion capture** plugin (Fab) — see [Candidate H](../ue5-capability-integration-candidates.md).

1. **Generate + prep the mesh** (Tripo/Hunyuan/…): A-pose, fingers separated, armpits/legs clear, hair + lashes removed, head as a separate high-poly mesh, accessories (hair/branches) as separate meshes. Keep it HIGH-POLY — it's also the bake reference. → gotcha `metahuman-conform-input-prep`.
2. **Assemble in Blender:** join head + body into one high-poly mesh; drop the MetaHuman conform-body reference; set size; `Ctrl+A` apply scale + rotation; zero transforms; export a **combined GLB (static mesh)**.
3. **Conform in UE:** import the GLB; create a MetaHuman Character; **Import tab → "from custom mesh"** → drag the static mesh into "combine mesh"; **Auto Solve** (~2 min on a 4070; enable the mocap preview). If topology mis-detects → **Reset Body**, hand-place/add solve points, **Solve Body** again.
4. **Save the DNA pose** at the manual-solve stage — **before** the next tab changes the pose (baking needs matching poses). → gotcha `metahuman-conform-texture-export`.
5. **Adjust + rig:** head/body tweaks; material tab (eyes/teeth kept original); **Create full rig** + **Download texture sources** → a compiled MetaHuman in the `MetaHuman` folder.
6. **Texture** — two paths:
   - **Bake (realistic):** generate a skeletal mesh from the DNA, export FBX, in Blender bake color + normal from the original high-poly to the conformed body (Cycles, selected-to-active). Handle **UDIMs** (shift body UV −1 tile). Fix neck-seam transition with clone/smear.
   - **Bake-free (stylized/toon):** export the MetaHuman-UV mesh, texture it with image-to-3D AI (Tripo) keeping **"use original UV" ON** so color follows the MetaHuman UV — no seam work.
7. **Rig accessories** (custom head, ears, hair, cloth volume): export the final MetaHuman skeletal mesh + armature; in Blender parent the accessory to the armature, transfer weights (rigid parts 100% to one bone — cf. `modular-character-accessory-rigging`); export FBX with **Add Leaf Bones OFF**, armature named `root`; import to UE with **flip normal-map green channel** if baked in Blender/Marmoset; drag the skeletal mesh onto the MetaHuman Blueprint body.
8. **Animate (optional):** MetaHuman Animator markerless mono-video mocap (body + face) via Live Link Hub → capture manager → MetaHuman performance (enable body tracking) → process → export; or Live Link facial capture from a phone.

## PoF integration points (when unblocked)

- `src/lib/visual-gen/providers.ts` + `src/app/api/visual-gen/generate/route.ts` — Asset Forge character output becomes the conform input (step 1–2).
- `src/components/modules/visual-gen/auto-rig/AutoRigView.tsx` — add a **"Conform to MetaHuman"** path beside the UE5-Mannequin / Mixamo presets; `rig-presets.ts` `metahuman` preset is the target.
- **PoF Bridge (`:30040`)** — a `conform` step that runs the MetaHuman Python in the attached editor (NOT a headless commandlet), reports the DNA path + skeletal-mesh asset back.
- Reuse the **mesh-critique / VLM tiers** (`mesh-critique.ts`, `pof_vlm_critique.py`) as the post-conform quality gate (rig integrity + on-model check), and the L4 visual critic for the final in-engine frame.

## Status & next step (NOT install-blocked)

**UE 5.8.0 is installed** (`C:/Program Files/Epic Games/UE_5.8`; `PoF.uproject` EngineAssociation `5.8`) and the conform API is **verified headless-scriptable** (above). This is **no longer an install/feasibility blocker** — it's a prototype-and-wire task. Remaining work, in order:

1. **Enable the `MetaHumanCharacter` (Experimental) plugin** in `PoF.uproject` (currently off) and **install the MetaHuman Optional Content** (removes the "limited features" cap).
2. **Prototype script** (headless is fine): import a generated GLB → `MetaHumanCharacterEditorSubsystem.conform_to_target_meshes` / `set_body_mesh` → save DNA → generate skeletal mesh → export. Dispatch via the PoF Bridge or the `ue-experiment` runner (both already spawn 5.8 Python).
3. **Wire Asset Forge → conform** (`AutoRigView.tsx` "Conform to MetaHuman" path) and **measure the auto-solve failure rate** on real Hunyuan/Tripo output — that determines whether a scripted point-align correction step is needed or input-prep alone suffices.
4. Gate the result with the mesh-critique / L4 visual critic.

Repro of the ground-truth probe: `UnrealEditor-Cmd PoF.uproject -run=pythonscript -script=<probe> -EnablePlugins=MetaHumanCharacter -nullrhi -unattended -NoLiveCoding -abslog=<log>` then grep the log.

## Sources

- Video: "From AI to Metahuman — Best New UE 5.8 Workflow for Custom Character" (Stefan 3D AI).
- [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine) — conform any-topology; `Get/SetFaceModelCoefficients`; batch API; MetaHumanGenerator Toolset.
- [MetaHuman 5.8 is now available](https://www.metahuman.com/news/metahuman-5-8-is-now-available).
