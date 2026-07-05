# Recipe / handoff — AI character mesh → UE 5.8 MetaHuman conform (the auto-rig bridge)

> Research-originated **recipe + handoff** (not built). From the `/research` run 2026-07-05 on "From AI to Metahuman — Best New UE 5.8 Workflow for Custom Character" (Stefan 3D AI). This is the **concrete, verified end-to-end recipe** for [Candidate B](../ue5-capability-integration-candidates.md#candidate-b--generated-mesh--metahuman-conform-closes-the-auto-rig-gap-) — the "generated 3D shape has no rig" gap in PoF's asset pipeline. Effort **XL** and **externally blocked** (UE 5.8 not installed locally; conform is editor-dependent) → spec/handoff per the action-by-effort rule, plus a `descoped-reopenable` trigger.

## Why this closes a real gap

PoF's official asset pipeline (impact-map `visual-gen`) is **Leonardo 2D → Hunyuan3D-2 / TripoSR shape → CLIP/geometry/Qwen-VL critique** — a **shape-only** output with **no rig**, so the generated character is not animatable. `rig-presets.ts` names MetaHuman only as a *retarget target* (bone table), with an empty `mixamoMapping` and the comment "MetaHuman requires custom retargeting workflow." UE 5.8's **Mesh-to-MetaHuman conform** *is* that custom workflow: it turns an arbitrary-topology human mesh into a fully-rigged MetaHuman (facial + body rig, Live Link, markerless-mocap-ready). It's the missing `design → 3D → playable character` link, and it retires the placeholder UniRig path.

## Automation reality (verified 2026-07-05)

- **Conform is scriptable** — 5.8 exposes almost every Creator op (sculpt, **conform**, wardrobe, **rigging**, texture synthesis) via Python/Blueprint; it added `GetFaceModelCoefficients`/`SetFaceModelCoefficients` (conform-to-PCA), a batch-processing API for captured performance data, and a `MetaHumanGenerator` MCP Toolset (instantiate a MetaHuman, set eye/skin/body-shape).
- **…but editor-dependent, not headless.** Epic documents **no commandlet** for the conform itself (only `ConvertLegacyDNAAssets` for DNA migration). Dispatch conform through the **PoF Bridge (editor-attached Python at `:30040`)**, not a headless `-run=pythonscript` commandlet.
- **Manual fallback is expected.** Auto-solve mis-detects complex/custom topology (fused fingers → 4 markers on 2). A fully-autonomous path needs either (a) input-mesh prep good enough that auto-solve never mis-detects, or (b) a scripted point-alignment / `SetFaceModelCoefficients` correction step. Prep guidance is the cheap lever — see the gotchas below.

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

## Blocker & reconsider trigger

**Blocked on:** a live UE 5.8 editor (5.8 not installed; engine targets 5.7) to verify the scripted in-editor conform end-to-end, and on Asset Forge generation being wired to feed it.
**Reconsider when:** UE 5.8 is installed locally / the PoF Bridge runs 5.8 — then prototype the scripted conform (`Get/SetFaceModelCoefficients` + the MetaHumanGenerator Toolset) against a Hunyuan/Tripo character output and measure how often the manual point-align fallback is actually needed.

## Sources

- Video: "From AI to Metahuman — Best New UE 5.8 Workflow for Custom Character" (Stefan 3D AI).
- [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine) — conform any-topology; `Get/SetFaceModelCoefficients`; batch API; MetaHumanGenerator Toolset.
- [MetaHuman 5.8 is now available](https://www.metahuman.com/news/metahuman-5-8-is-now-available).
