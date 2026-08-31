# Kit atlas bake — many props, one material (spec)

> **Status: PLANNER BUILT (2026-08-31), Blender side SPEC ONLY.**
> Source: Stefan 3D AI, youtube `wknRD5g-vvk` (titled "NVIDIA Kimodo Now Runs Without a
> GPU", but the video is a complete AI environment asset-kit → Blender → UE5 workflow)
> — [12:09] *"why not them to use one material? … you can bake five objects together,
> like 10 objects together"*, and [13:00] the UV-Packer repack that makes it possible.

## The gap this closes

PoF's `pof_mesh_finish.py` is **single-asset**. Its `join_meshes` merges the *parts of one
generated mesh* (generators return split shells), then decimates, unwraps and bakes that
one object. Every prop therefore leaves the pipeline with **its own material and its own
texture set** — N props in a scene are N materials and N draw calls, and for an
environment kit N is 20–60.

The pro workflow's answer is the atlas: join a set of props that belong together (old
boxes, rock chunks, planks), repack their UVs into one non-overlapping layout, and bake
them into **one** texture set. The decision that makes it honest is not "which props look
similar" — it is **how many pixels each prop earns**, which is a texel-density question.

## Built: the planner

`src/lib/visual-gen/texel-density.ts` → `planKitAtlas(members, targetPxPerM)`.

Pure, no Blender, no files. Given each member's real-world longest extent it returns:

| Field | Meaning |
|---|---|
| `members[].cellPx` | the square cell that member's real size earns at the target density |
| `atlasSize` | the square atlas that holds them all |
| `verdict` | `matches` when every member reaches the target, `starved` when the ceiling forced a cut |
| `achievedPxPerM` | the **worst** member's density — the honest headline |
| `materialsBefore` / `materialsAfter` | the draw-call saving, which is the point |
| `reason` | set whenever cells were reduced, naming the split-the-kit remedy |

**Why the atlas size needs no packer to be truthful.** Every cell is a power of two, and
a multiset of power-of-two squares tiles a power-of-two square exactly whenever the side
is at least the largest cell and the area is at least their total. The planner derives
`atlasSize` from those two bounds alone, so the number it reports is achievable by the
greedy quadtree packing a baker performs — it is not an estimate that a real packer might
fail to hit.

**Why it refuses.** An empty kit and a kit with any unmeasured extent both return
`ok: false`. A cell is sized from metres; an unknown extent has no honest cell, and
inventing one would silently starve that member.

## Not built: the Blender side

A `--kit` mode for `pof_mesh_finish.py`, consuming the planner's output:

1. **Accept N inputs**, not one. Today `--input` is a single path and `join_meshes`
   assumes one asset's shells; the kit mode keeps members as separate objects.
2. **Per-member decimate** to each one's own face budget (`face-budget.ts` already
   authors this per asset class) before any joining.
3. **Repack UVs into the shared layout** — the existing `unwrap()` already calls
   `bpy.ops.uv.pack_islands(margin=0.02)`; the kit mode must scale each member's islands
   to its planned `cellPx / atlasSize` fraction before packing, which is the step the
   video does with the UV-Packer add-on.
4. **Bake to one image set** at `atlasSize`, reusing `bake_high_to_low` per map kind —
   selected-to-active per member into the shared target image rather than a fresh image
   per member.
5. **Emit one material** and per-member UV offsets, so the UE import writes a single
   material instance (`ue5-material-instance.ts`) for the kit.

### The trap to check first

`bake_high_to_low` currently calls `ensure_bake_material(obj)` per object. A kit bake
shares ONE target image across members, so the existing per-object material handling must
be verified not to clear or replace slots mid-kit — the same class of defect as the
2026-08-14 finding where each bake cleared the low-poly's material slots and shipped
untextured meshes for weeks. **Bake two members and diff the resulting texture against a
single-member control before trusting a kit run.**

## Verification (do not skip)

A kit bake's value claim is "the output is better", so a passing unit test cannot prove
it. The decisive check is an A/B against a control:

- same two props, once through the single-asset path, once through `--kit`;
- assert the kit run produces **one** image set, not two;
- assert each member's baked pixels are non-empty in its own cell region (a member whose
  cell is blank is the failure mode this catches);
- compare texel density at the wall the player approaches, not the whole-image average.

## Anchors

- Planner: `src/lib/visual-gen/texel-density.ts` (`planKitAtlas`, `bakeSizeForExtent`)
- Blender: `scripts/visual-gen/pof_mesh_finish.py` (`unwrap`, `bake_high_to_low`, `join_meshes`)
- Node seam: `src/lib/visual-gen/mesh-finish.ts` (`MeshFinishSpec`, `buildMeshFinishArgs`)
- Budgets: `face-budget.ts` (triangles), `polycount-presets.ts` (per class)
- Knowledge it makes measurable: `ue-gotchas.ts` → `ai-generated-environment-assembly`
