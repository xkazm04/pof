# Two missing gates on the "game-ready" claim — spec

> Sources: the game-ready cleanup pipeline write-up (strayspark, 2026), the ai-forge-mcp Rig
> Inspector pattern, and a repo audit. Written by `/research` 2026-09-07.
> Status: **spec + backlog.** The executing halves are editor-side and cannot be gated
> in-session — see the standing rule in `Patterns/user-preferences.md`.

PoF calls a mesh "game-ready" after retopo → UV → bake. Two things a shipping asset needs are
measured nowhere in the pipeline.

---

## 1. Collision (the knowledge half SHIPPED; the execution half is open)

**Audit result:** zero `UCX_` / collision references anywhere in `src/`, `scripts/` or `tools/`
except `visual-gen/ue5-import-templates.ts`, which exposes a `generateCollision` boolean →
`Factory->ImportUI->bAutoGenerateCollision`. Its only consumers are
`ImportAutomationView.tsx` (a template-display view) and `feature-definitions.ts`. **The
executing pipeline has no collision step at all**, and every generated asset therefore imports
as non-blocking geometry.

The `generated-mesh-arrives-without-collision` gotcha (shipped `3c871928`) now carries the
technique into every `ue-python` prompt. What remains is execution:

- A pure `collisionPlan(metrics, use)` in `visual-gen/` deciding primitive-vs-convex and hull
  budget from the Tier-1 metrics already computed (`mesh-critique.ts` has extents, component
  counts and watertightness in hand). Pure → gateable in-session.
- The UE-python emit: `add_simple_collisions` / `set_convex_decomposition_collisions`, then
  **read back `body_setup` aggregate geometry** — that read-back is the observation that turns
  this from a config change into a verified one.
- **Do not build the planner alone.** A planner with no caller is the orphan-module defect; it
  ships with the emit or not at all.

**Reconsider trigger:** when a generated asset is next imported to UE for a gameplay purpose
(anything the player collides with, as opposed to a gallery render).

---

## 2. A rig quality gate (nothing grades a rig today)

**Audit result:** `rig-presets.ts` holds three humanoid presets; the `ai-mesh-segment-before-rig`
and creature-anatomy gotchas warn about *choosing* a rig path; nothing **grades the resulting
rig**. Bestiary "3D & Rig" sits at A1 with zero real rigs across 94 entities, so the gap is
also the largest unpowered class in that catalog.

The commercial pattern worth stealing (ai-forge-mcp's "Rig Inspector" — the tool itself is
proprietary compiled binaries on a subscription and is **off-domain as a provider** by the
standing GUI/closed-tool rule; only the shape transfers):

- **Standard test poses**: T-Pose, A-Pose, Walk, Run, Attack, Death. Drive the rig to each and
  render it. A rig that looks correct in bind pose and shatters at 90° of shoulder rotation is
  the normal failure, and bind pose alone cannot see it.
- **Numeric dimensions** beside the render: weight symmetry (left/right vertex-weight mirror
  error), joint deformation (volume loss / candy-wrapper twist at elbow, knee, shoulder),
  unweighted-vertex count, bones with zero influence.

This composes with two things PoF already has: `anim-critique` (filmstrip → scored dimensions,
`POST /api/verify/animation`) is the right consumer for the posed renders, and the
`skintokens-rigging-spec.md` / `dataflow-rig-transfer-spec.md` paths are what would produce the
rigs being graded.

**Ordering matters:** the numeric half is worth more than the VLM half and is cheaper — weight
symmetry and unweighted-vertex counts are computable from the FBX/GLB skin data with no engine
and no model. Build that first; it is a real gate. The posed-render critique is the second
tier and inherits every calibration caveat in
[weak-verifier-ensemble-spec.md](./weak-verifier-ensemble-spec.md).

**Blocker:** posing a rig and rendering it needs Blender (headless, available) or UE
(editor-side). The numeric half needs neither and is the honest first slice.

**Reconsider trigger:** when creature/bestiary rigging is next pushed — the same trigger already
recorded for SkinTokens and Dataflow rig transfer. Whichever of those lands first should land
this gate with it, or its output will be ungraded by construction.

---

## Already covered (checked — do not re-propose)

The cleanup write-up's numeric standards are largely **already in the repo**, and only these
were absent:

| Standard | Status |
|---|---|
| Texel density consistency | **Have** — `visual-gen/texel-density.ts` (`gradeTexelDensity`, px/m, tolerance) |
| LOD ladder | **Have** — `blender-mcp/scripts/generate-lods.ts`; the impact-map also records that UE's importer auto-computes static-mesh LODs, so a Blender-side ladder duplicates the engine |
| Decimate vs remesh choice | **Have** — `mesh-finish.ts` `RetopoMode` (`collapse` \| `quadriflow`) |
| Smart-UV unwrap | **Have** — `unwrapPlan` + `UvMode`, with a documented face ceiling |
| UV stretch grading | **Have** — `gradeUvStretch`, beyond what the source describes |
| Collision | **Gap** — above |
| Rig grading | **Gap** — above |

A voxel-`REMESH` pre-pass (source suggests voxel 0.3 → decimate planar 5°) is **not** a new
finding: it is already recorded as the named candidate under the 2026-08-23
*"Quad-remeshing PoF's own generator output"* descope, whose blocker is residual non-manifold
geometry that QuadriFlow correctly refuses. That entry is where the work belongs; this run adds
only an external corroboration of the parameter choice.
