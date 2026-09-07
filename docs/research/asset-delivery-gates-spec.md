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

The `generated-mesh-arrives-without-collision` gotcha (shipped `3c871928`) carries the technique
into every `ue-python` prompt, and the execution shipped in the follow-up:

**BUILT** — `visual-gen/ue-import.ts` (`collisionPlan` + `buildGlbImportPython({ collision })` +
`importGlbToUE`, 18 tests):

- `collisionPlan({ use, components })` is pure: `decorative` → **none** (a wrong hull blocks
  the player worse than nothing), single-shell `blocking` → one BOX primitive, multi-shell
  `blocking` → convex decomposition at 6 hulls / 16 verts. `complex` (the render mesh as
  collision) is deliberately **not representable in the type**, so no plan can select it.
- The emit runs `add_simple_collisions` / `set_convex_decomposition_collisions`, **reads back
  `body_setup` and logs the element count**, and saves the asset *after* the collision call
  (`task.save = False` when a plan is present — saving at import time would persist the mesh
  without it).
- `importGlbToUE` **fails the import** when collision was requested and the read-back is 0 or
  absent. Collision is claimed from the observation, never from the call having been emitted.

**Two honest limits, both stated in the code:**

1. The `body_setup` → `agg_geom` → `*_elems` property chain is **not introspected against a
   live editor**. The emitted python is syntax-checked (`ast.parse`) and the call names come
   from the documented `EditorStaticMeshLibrary` surface, but per `python-api-introspect-first`
   the first live run should `dir()` these objects. A wrong name here **fails safe**: the
   read-back throws or yields 0, and the import then refuses to claim collision.
2. **`ue-import.ts` itself has no production caller** — see below. The collision work improves
   the real import path; it does not yet run on any real generation.

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

---

## 3. The bigger finding underneath #1: the UE import path was an orphan — RESOLVED

`visual-gen/ue-import.ts` is the module that actually brings a generated `.glb` into `/Game` as
a Static Mesh (AssetImportTask, driven through the Experiment Lab editor runner because the
glTF/Interchange importer is unreliable under `-run=pythonscript`). A consumer census on
2026-09-07 returned **only its own test file**.

So the shape of the gap is worse than "generated assets have no collision". It is: **nothing in
the app imports a generated mesh into UE at all** — the pipeline produces `.glb` files under
`generated/`, grades them, and stops. Every UE import to date has been a session driving the
editor by hand or through a probe script.

That reframes the collision work honestly: it hardened the import path so that when something
calls it, the asset arrives blocking and the claim is observed. It did not make the pipeline
import anything.

**WIRED (2026-09-07).** The chain now runs end to end and every link has a non-test consumer:

```
AssetForgeView -> UeImportPanel -> POST /api/visual-gen/ue-import
                                -> startUeImportJob (ue-import-job-store)
                                -> critiqueMesh -> collisionPlanFor -> collisionPlan
                                -> importGlbToUE -> the editor
   (poll) GET /api/visual-gen/ue-import/status
```

- **`ue-import-job-store.ts`** — job-based because the editor launch runs for minutes, the
  same reason `mesh-finish-job-store.ts` exists. It adds what a route could not do by hand:
  `collisionPlanFor(critique, use, declared?)` **derives** the shell count from the Tier-1
  critic and records the BASIS (`measured` / `declared` / `assumed` / `not-needed`). Shells
  come from `classifyComponents`, not the raw `components` field — a mesh with 40 two-face
  specks and 3 real parts must plan hulls for 3, not 43.
- **The critic is best-effort on purpose.** A missing trimesh costs the plan its evidence,
  never the import; the job then reports `assumed` and the panel renders that as a warning.
- **The route requires `use` and has no default** — the one fact the mesh cannot supply and
  the one collision depends on. It also refuses a non-`.glb` path and a missing file up
  front, rather than after a multi-minute launch that could only fail.
- **`collisionElements` is `null`, never absent, in the status payload.** JSON drops
  `undefined`, which on this field would make "nothing counted it" indistinguishable from
  "this API doesn't report collision" — on the one field whose absence IS the failure. A
  panel test pins that the requested plan and the observed count render as separate lines.

38 tests across the store, the routes and the panel.

**PROVEN LIVE (2026-09-07).** Three real imports of `generated/meshes/props__crate.glb`
through the running route on `:3001`, driving UE 5.8. The final run:

```
status             done
assetPath          /Game/Generated/ResearchImport2/props__crate/StaticMeshes/ResearchCrate2
collisionElements  2      (read back from body_setup, not assumed)
```

and five `.uasset` files on disk — the mesh, its material, and Color / NormalGL / ORM
textures. The `body_setup` -> `agg_geom` -> `*_elems` property chain, flagged in this doc as
un-introspected, **is correct**; it is no longer an assumption.

**The live run found two defects nothing else could have.** Both are now `ue-python`
gotchas (`gltf-import-returns-many-assets`), because they are general UE truths rather than
route trivia:

1. **`imported_object_paths` is not mesh-first.** Run 1 died with
   `TypeError: NativizeObject: Cannot nativize 'Texture2D' as 'StaticMesh'` — a glTF import
   yields textures and materials too, and `paths[0]` was a **Texture2D**. The reported
   `assetPath` was a texture as well, which is a defect that predates this work. The mesh
   must be selected with `isinstance(o, unreal.StaticMesh)`, and a distinct marker has to
   say "imported, but nothing was a StaticMesh" — that state shares its import marker with
   success and has an entirely different cause.
2. **Suppressing `task.save` means nothing is saved.** Run 2 succeeded (collision observed,
   2 elements) and wrote exactly **one** `.uasset`: the glTF's textures and materials had
   imported into memory and never reached disk, leaving the saved mesh referencing assets
   that would not survive an editor restart. The fix loops `imported_object_paths` and
   saves every object. **Artifact diff: 1 -> 5 `.uasset`** — the only evidence that counts
   here, since both runs had a green test suite and a success marker.

**The honesty machinery held under real failure.** Run 1 reported `status: error` with the
engine's own TypeError and **refused to claim collision**; nothing was left half-saved,
because `task.save = False` and the explicit save never ran.

**What is still NOT proven:** the `measured` plan basis. The Tier-1 critic could not run on
this machine (`POF_TRIPOSR_ROOT is not set (the TripoSR venv is where trimesh lives)`), so
all three runs planned on basis `assumed` and the route said so — the designed fallback,
exercised live. Measuring the crate out-of-band with the system `trimesh` shows this is not
cosmetic: **451 components, 59 real parts after the floater rule, 392 specks**, so a measured
plan would have chosen **convex hulls**, where the assumed plan chose a **BOX**. The basis
field is reporting a real difference in outcome, not a formality. Installing the TripoSR venv
is what closes this last gap.
