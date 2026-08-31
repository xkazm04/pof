# Kit render gate — multi-view critique + kit colour coherence

> **Status: BUILT 2026-08-31.** Specced and built in the same day; this document is now
> the reference for what exists, not a proposal.
> Source: Stefan 3D AI, youtube `wknRD5g-vvk` — [07:59] *"the other side of the coin is
> completely broken"* and [11:19] *"they are not consistent by colour"*.

## Why one gate

Finding 4 (a generated mesh's unseen side is broken) and finding 3 (kit members do not
match each other) were the same missing capability wearing two hats: **PoF never LOOKED
at a generated asset.** `mesh-critique.ts` measures verts, faces, watertightness,
components, euler and bbox through trimesh — all structural, none of it visual.

## What was built

| Piece | File | Tests |
|---|---|---|
| Multi-view renderer | `scripts/visual-gen/pof_mesh_views.py` | live-proven |
| Renderer seam (pure cores + spawn) | `src/lib/visual-gen/mesh-views.ts` | 16 |
| Unseen-side gate | `src/lib/visual-gen/view-critique.ts` | 26 |
| Kit colour coherence | `src/lib/visual-gen/kit-coherence.ts` | 17 |

### Part 1 — the shared harness

`pof_mesh_views.py` forks `pof_anim_filmstrip.py`'s framing block (bounds → centre →
camera distance) and replaces the frame loop with a camera orbit at N yaws.
`mesh-views.ts` mirrors `mesh-finish.ts`: `viewsPlan` / `buildMeshViewsArgs` /
`parseMeshViewsOutput` are pure, the spawn is injectable, and **a marker without a file
on disk is not a view** — `runMeshViews` re-checks every emitted path.

**The palette comes from a second, unlit pass, and that was not the first design.**
Measured on `props__crate.glb` under the three-point rig: the front yaws quantised to
`#c7b7b7` and the shadowed yaws to `#585858`. The same crate, the same texture, a palette
that swung with the lighting. That bias is only systematic across members while their
SHAPES match — a tall plank and a cube catch the key light differently — so a lit palette
would report two same-textured props as drifting. A Workbench flat/texture pass removed
the light from the measurement: after the change all four yaws agree
(`#c7b7b7,#c7b7a7,#c7c7b7,#d7d7d7`). The flat pass is deleted after measurement so no
caller can grade the wrong image.

### Part 2 — the unseen-side gate

One VLM call per view over the seam `style-dna.ts` already uses. Three rules carry it:

1. **The worst view decides — for severe damage.** A mean lets three clean views average
   away a broken back, which is the defect the gate exists for.
2. **Moderate damage needs corroboration.** A severe view condemns alone; one moderate
   view warns and names itself; two condemn. This rule exists because of the control run
   below — without it the gate failed a known-good mesh.
3. **A view that could not be judged is not a clean view.** An unparseable reply or a
   thrown call yields `unmeasured`, never `pass`. The one deliberate exception: a defect
   that WAS seen outranks a coverage gap, because the mesh is already condemned.

The prompt rules the RENDER out of scope — lighting, background, camera and the missing
ground plane are declared deliberate — so the model reports mesh defects, not our rig.

### Part 3 — kit colour coherence

CIELAB palettes, CIE76 ΔE, mean nearest-neighbour distance symmetrised in both
directions. Reports the worst PAIR and the single `outlier` member — the one to
re-generate — plus `meanDeltaE`.

**Calibrated on captured data, and honest about where the calibration stops.** Measured
over four meshes in `generated/`:

| | ΔE |
|---|---|
| the same asset, re-rendered | 0.0 – 1.8 |
| independently generated assets | 8.0 – 21.5 |
| ONE asset's own four colours, internal spread | up to 15.1 |

`DRIFT_DELTA_E = 6` sits in the measured gap between the first two bands. The third
number is the limit: a single prop's palette spans more than the gap between some asset
pairs, so *"these two props differ"* is not the same claim as *"this kit is
incoherent"* — a crate and a barrel are allowed to differ. Separating varied-but-coherent
from drifting needs a known-good kit, which PoF does not have. So every grade carries
`advisory: true` and `KIT_COHERENCE_CALIBRATION_CAVEAT`, following the
`CRITIQUE_CALIBRATION_CAVEAT` precedent: **show the number, do not gate a pipeline on the
verdict until it is calibrated on a real kit.**

## Verification — run over the real library, with a control

**Structural triage of all 52 `.glb` under `generated/`: 6 pass or warn, 46 fail.** Five
of the six score a perfect **100/100** (TripoSR: watertight, one component, zero
degenerate faces). Those five are the population the view gate has to justify itself on.

`generated/triposr/chair.glb` scores 100/100 and renders as a **featureless melted blob
from one yaw** while showing a well-formed chair with a detailed backrest from another —
one mesh, one side reconstructed, the other invented. Structural perfection is
uncorrelated with visual usability, which is the whole case for this gate.

### The first live run failed everything, including a known-good control

Three structurally-clean meshes went through the gate and all three failed at severity 3
on every view. That looks like success and is not: a gate that condemns everything is as
useless as one that passes everything. The control settles it — a clean, subdivided,
smooth-shaded Blender Suzanne, exported to glb, also failed **3/3 at severity 3**.

Both causes were in our prompt, not in the model or the meshes:

- it listed **"flat untextured or blank areas"** as a defect, and most generator output
  (all TripoSR output here) legitimately arrives untextured;
- it asked whether the shape **"reads as the subject from this angle"** — which the back
  of a chair, or the underside of a head, never does.

The model was answering the question it was asked. With those removed and an explicit
"if unsure, score lower", the same control scored **[2, 0, 0]**.

### Final measured discrimination

| mesh | structural | view severities | verdict |
|---|---|---|---|
| Suzanne control (known good) | 5 components, not watertight | `[2, 0, 0]` | **warn** |
| `chair.glb` | **100/100 pass** | `[2, 3, 0]` | **fail** |
| `saber_hilt.glb` | 85/100 warn | `[2, 2, 2]` | **fail** |

The remaining false positive is a single moderate view on the control — one orbit angle
foreshortened Suzanne into what reads as fused parts. That is why moderate damage now
requires **corroboration**: a severe view condemns alone, one moderate view *warns and
names itself*, two condemn. Note the inversion in that table — the control is
structurally the WORST of the three and visually the best.

**Calibrated on three meshes (one good, two bad).** Enough to fix the observed
false-positive mode; not enough to call the thresholds settled. Widen the control set
before letting this gate a pipeline unattended.

### Kit coherence was not meaningfully exercised live

Run over the same three meshes it returned `coherent, mean dE 0.0` — correct but vacuous:
the structurally-clean meshes are all untextured TripoSR output, so every palette is the
same near-white. The real evidence for that grader is the four-asset capture in its test
fixtures (dE 8.0–21.5 across textured assets), not this run.

## A defect found while verifying, NOT fixed here

**Every TripoSR asset checked is authored lying on its side.** `bestof_fg070.glb` has
bbox `0.95 × 0.50 × 0.52` — the longest axis is X, not the vertical. The renders show it
plainly. Nothing catches this: the structural gate only rejects a *degenerate* bbox, and
`world-scale.ts` grades the **longest extent** against a target, so for a mis-oriented
chair it compares the sideways length as though it were the height. An orientation gate
(dominant axis vs expected up-axis, per asset class) is a small pure addition to
`world-scale.ts` and is the obvious next build. Recorded, not built — it is not this
spec's scope.

## Cost note

Part 1 is local and free. Part 2 costs one VLM call per view; `qwen3.7-flash` averages
~43 s per call (the benchmark in `qwen.ts`), so a 6-view gate is ~4 minutes of wall clock.
Run it only on meshes that already passed the structural gate, so the free gate keeps
filtering first, and keep `MAX_VIEWS` (16) in mind as the cost ceiling.

## Anchors

- Renderer: `scripts/visual-gen/pof_mesh_views.py`; seam `src/lib/visual-gen/mesh-views.ts`
- Gate: `src/lib/visual-gen/view-critique.ts` (`scoreViewGate`, `critiqueMeshViews`)
- Coherence: `src/lib/visual-gen/kit-coherence.ts` (`gradeKitCoherence`, `paletteDistance`)
- Vision seam: `src/lib/anim-critique/qwen.ts` (`makeQwenVision`)
- Structural tier it stacks on: `src/lib/visual-gen/mesh-critique.ts`
