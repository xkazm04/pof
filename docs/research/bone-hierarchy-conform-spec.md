# Bone-hierarchy conform — applying a rename plan to a generated rig

**Status:** planner BUILT and tested (`src/lib/visual-gen/bone-conform.ts`), applier SPECIFIED, not built.
**Source run:** 2026-09-07, `tripo-smart-mesh-animated-character` (Building Aeon, Tripo Smart Mesh P2.0).
**Owning subsystem:** Visual-gen / asset pipeline (2D→3D→rig→texture→assemble).

## Why

A rigged mesh and an animation clip are bound **by bone name** — UE's IK Retargeter maps
chains by name, Blender assigns actions by name, and a third-party clip library ships the
names of whatever skeleton it was authored against. So a good auto-rig plus a good clip
produce nothing when the vocabularies disagree, which is the normal case: the rigger and
the clip author never coordinated.

The source run's own workaround is the shape of the problem. Its author rigged a dog with
Tripo, downloaded free *fox* clips from a third-party library, found the hierarchies did
not line up `[09:24]`, and fixed it with an ad-hoc Claude Code + Blender-MCP session that
transferred the bone hierarchy by hand. That works once. It is not a pipeline.

## What is already built

`planConform(rigNames, clipNames)` decides, deterministically and for free, what the
renames should be:

- **exact** — identical strings; nothing to apply.
- **canonical** — paired within a `(side, stem)` group by chain order, indices agreeing.
- **chain-order** — paired by order with differing/absent indices.

Vendor prefixes (`mixamorig:`), case, separators and side-marker position are normalized
away, and a small observed-only synonym table folds `UpLeg`/`Thigh`/`Femur`,
`Shoulder`/`Clavicle`, `ForeArm`/`LowerArm` and so on onto one stem.

**Verified against a known answer, not its own opinion:** handed the Mixamo source names
and the UE5 Mannequin target names from `rig-presets.ts`, it re-derives that file's
hand-authored 20-bone mapping — **20/20 agreeing, 100 % coverage** — without being shown
it. The one thing name comparison cannot do is bridge a chain-index *origin* difference
(Mixamo `Spine, Spine1, Spine2` vs UE5 `spine_01, spine_02, spine_03`), which is why
ordering, not index equality, is load-bearing; an index-equality pass looks confident and
silently shifts the whole spine by one.

`unmatchedClip` reports lost motion (a clip that animates a tail against a rig with no
tail), and `coverage` is measured against the **clip**, because a spare rig bone is usually
harmless while an undriven clip bone is motion thrown away.

## The hard limit — read this before extending the planner

An **anonymously-named** rig cannot be conformed by name at all, and this is not an edge
case: `skin-tokens.cpp`, PoF's only local rig engine, names its joints `bone_0 … bone_N`
(measured 2026-09-07 off `src/__tests__/fixtures/rig/skintokens_cube_rigged.glb`).
`planConform` returns a **blocker**, not 0 % coverage, because the fix is categorically
different — the joints must first be identified from their **positions in the mesh**, which
is a geometric problem, and only then named. Do not paper over this with a better string
matcher.

## What remains: the applier

Not built because it cannot be honestly gated in-session — it is a live-Blender armature
edit, and `tsc`/vitest prove nothing about it (the promoted preference on editor-side
findings applies).

**Shape** — mirror `mesh-finish.ts`, which already drives headless Blender 4.2:

1. `src/lib/visual-gen/bone-conform-apply.ts` — a pure argv/marker-parse core plus an
   injected spawn seam. Input: rig GLB/FBX path, the `BoneRename[]` from `planConform`,
   an output path. Output: the written file plus the applied-rename count.
2. `scripts/visual-gen/pof_bone_conform.py` — headless Blender. Import the rig, then for
   each rename set `armature.bones[from].name = to`. Blender propagates a bone rename to
   vertex groups, constraints and drivers automatically, which is the reason to do this in
   Blender rather than by patching glTF JSON — the skin's joint references and the vertex
   groups would have to be kept in step by hand.
   - Apply renames in **two phases** through unique temporary names. A one-phase rename
     collides whenever the plan swaps or rotates names within a chain (`Spine1`→`spine_02`
     while `Spine2`→`spine_02` is still taken), and Blender silently suffixes `.001`
     instead of failing.
   - Print `POF_CONFORM_RENAMED=<n>` and `POF_CONFORM_SKIPPED=<name>` markers; judge the
     run by marker content, not exit code (the headless-shutdown-crash rule).
3. **The gate must be an artifact diff, not a passing test.** Re-read the written file with
   `parseGlbRig` and assert the joint names now equal the plan's targets. A unit test on
   the argv proves only that the argv was built — this repo has shipped that mistake.

**Then, and only then, the pipeline step:** rig → `planConform` against the target clip
library → apply → re-gate with `gateRig(path, { morphology })` → retarget. Both halves of
the gate matter: `skeleton-profiles.ts` will now confirm the conformed rig carries the bone
*groups* the clip needs, which is how the finger-bone failure from the same source run
`[03:27]` gets caught before a prop is socketed to an open palm.

## Reconsider trigger

Build the applier when PoF next needs a **non-humanoid** clip retargeted — that is the case
with no alternative. For humanoids there is a cheaper route that should be tried first:
Tripo's auto-rig `spec` parameter accepts `mixamo`, which returns Mixamo-compatible naming
directly, and `rig-presets.ts` already maps Mixamo→UE5. Ask the rigger for the right
vocabulary before renaming its output.
