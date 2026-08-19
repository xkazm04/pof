# Constraint-conditioned motion fix path (spec)

**Status:** the loop-closure half of the mechanism is **PROVEN LIVE 2026-08-19** against a
reinstalled ARDY (see [`ardy-text-to-motion-spec.md`](./ardy-text-to-motion-spec.md)). The
critique→constraint mapping for the *aesthetic* dimensions is still unbuilt.
**Source run:** `/research` 2026-08-19, "Text to Animation in UE 5.8 | DDS Motion + NVIDIA
Kimodo" (Dark Dojo Studios).
**Effort:** L.

## The gap

PoF's animation loop is **scored but never closed**. `src/lib/anim-critique/` renders a
filmstrip, asks a VLM for six dimensions (anticipation, weight, timing, followThrough,
silhouette, believability) and returns a verdict. There is no fix path:

```
$ grep -riE "fix|regenerat|corrective|constraint" src/lib/anim-critique/
1 hit
```

Every other generative modality in PoF closes its loop. Meshes have best-of-N
(`visual-gen/best-of-n.ts`) plus `mesh-finish`. 2D has the input gate and re-rolls. Steps
have "⚡ Produce fix" via `genericFixCopy.ts`. Motion has none of that — when session 5
(2026-07-16) got Qwen feedback on the dodge roll ("hand-plant vault entry, stiff tuck, snap
recovery") a human hand-copied it into the *next prompt's wording*.

Rewording a prompt is the weakest possible correction. It re-rolls the whole clip and
discards the parts that were already good — the diffusion model has no way to know that the
tuck was the problem and the entry was fine.

## The mechanism the source demonstrates

The DDS Motion plugin's workflow is: generate a base clip, then **layer corrective
keyframes** on specific bones (auto-pose + IK), each with a fade-in/fade-out influence
envelope (8 frames by default, draggable to the whole clip), then export. The human is doing
exactly what the fix path should do automatically: *keep the clip, correct the part that is
wrong.*

The important part is that this does not have to be a post-hoc edit. **Both NVIDIA motion
models accept kinematic constraints as first-class generation inputs**, so the correction can
be fed back into generation rather than applied on top of it:

- ARDY — `scripts/generate.py --constraints <path to a saved kinematic-constraint list>`;
  documented support for "root paths/waypoints, full-body keyframes, and sparse joint
  positions/rotations".
- Kimodo — the HF model card lists inputs as "Text, Duration (Num Frames), **Pose
  Constraints**"; full-body pose keyframes, end-effector positions/rotations, 2D paths,
  2D waypoints.

So a failing critique dimension can become a *constraint on the next generation*, and the
clip is regenerated conditioned on what was right about the last one.

## Proposed loop

```
prompt ──> generate ──> Tier-1 numeric gate ──> Tier-2 VLM critique ──> verdict
             ^                (motion-gate/)         (anim-critique/)      │
             │                                                            │
             └──────── constraints + same seed  <─── corrective mapping ◄──┘
```

1. **Tier-1 first** (`src/lib/motion-gate/` — loop closure shipped 2026-08-19; foot-contact
   and root-continuity checks still to add). Numeric, ~free. A clip that fails here never
   costs a filmstrip render plus a vision call.
2. **Tier-2** `anim-critique` as today.
3. **Corrective mapping** — the new pure core. Takes the failing dimensions plus the Tier-1
   metrics and produces a *corrective intent*: which joints, over which frame interval, in
   which direction.
4. **Regenerate** with the original prompt, the same seed, and the constraint list. Same
   seed matters: it is what makes the result a correction of *this* clip rather than a fresh
   roll.
5. Re-gate. Bounded retries (propose 2), then surface the best-scoring attempt with its
   score — never silently ship attempt N.

## The constraint schema (read from ARDY source 2026-08-19 — NOT invented)

`scripts/generate.py --constraints <path>` → `ardy.constraints.load_constraints_lst(path,
skeleton)`. The file is **plain JSON**: a list of objects, each with a `"type"` key dispatched
through `TYPE_TO_CLASS`:

| `type` | Class | Use |
|---|---|---|
| `fullbody` | `FullBodyConstraintSet` | pin the whole pose at given frames |
| `root2d` | `Root2DConstraintSet` | ground-plane path / waypoints |
| `end-effector` | `EndEffectorConstraintSet` | arbitrary named joints |
| `left-hand` / `right-hand` / `left-foot` / `right-foot` | subclasses of the above | the common IK targets |

**The serialized shape is NOT the constructor's shape — this is the trap.** The
`FullBodyConstraintSet.__init__` signature takes `global_joints_positions`, but
`from_dict` (constraints.py:204) reads:

```json
{ "type": "fullbody",
  "frame_indices":    [ ... ],           // int frame indices
  "local_joints_rot": [ [ [x,y,z], ... ] ],  // AXIS-ANGLE, per frame per joint
  "root_positions":   [ [x,y,z], ... ],
  "root_2d":          [ [x,z], ... ]     // optional; "smooth_root_2d" also accepted
}
```

and derives the globals itself via `skeleton.fk(axis_angle_to_matrix(local_joints_rot),
root_positions)`. Emitting global positions — the obvious reading of the constructor — would
be silently wrong. `root2d` is the simpler `{frame_indices, root_2d, global_root_heading?}`.
Round-trip helper: `save_constraints_lst(path, lst)` (tensors → lists).

**This lines up with what PoF already stores.** The generated npz carries `local_rot_mats`
and `root_positions`, so a loop-closure repair constraint is a direct transform of data the
pipeline already has: take frame 0's `local_rot_mats`, convert to axis-angle, emit at
`frame_indices: [last]`.

Enforcement strength is a first-class knob: `--cfg_weight <text_weight> <constraint_weight>`
(default `2.0 2.0`), so the fix path can push constraint adherence without re-weighting the
prompt.

### PROVEN 2026-08-19 — the loop-closure repair, measured end to end

Model `ARDY-Core-RP-20FPS-Horizon40`, prompt "a person walks forward at a steady pace",
seed 1, 80 frames @ 20 fps, graded by `scripts/visual-gen/ardy/pof_loop_closure.py`:

| run | poseGap | worstJoint | velJump | rootTravel |
|---|---|---|---|---|
| raw generation | 141.80 mm | 381.01 mm | 25.94 mm | 5645.6 mm |
| pin LAST frame only → **worse** | 153.46 | 436.04 | 39.64 | 5641.7 |
| pin BOTH endpoints → **pose solved** | **0.0001** | **0.0002** | 29.28 | 5645.6 |
| + velocity-matched 3rd frame → **best** | **0.0001** | **0.0002** | **15.73** | 5645.6 |

**Raw text→motion output does not loop.** The model generates a *take*, not a cycle — it has
no notion of returning to its start pose. Every raw locomotion clip measured (walk 141.8, run
197.1) fails; only a near-static idle (10.1) comes close. Any Blend Space built on raw output
is sliding, and nothing in PoF detected that before this gate.

**Constraints are honoured EXACTLY.** The constrained frame matched its target to **0.0 mm**.
The mechanism is not approximate — it is a hard pin.

**Three findings that a spec written blind would have gotten wrong:**

1. **Pinning only the last frame makes the loop WORSE** (141.8 → 153.5). The pin lands
   perfectly, but regeneration moves the *new* clip's first frame (153.5 mm off the target),
   so the seam opens at the other end. **Always pin both endpoints to one shared pose.**
2. **Pose closure does not imply a usable loop.** At 0.0001 mm the poses are identical and a
   first-frame-equals-last-frame check — the criterion the source video states — reports a
   flawless loop. `velJump` stayed at 29.28 mm: the clip still hitches. Adding a third
   velocity-matched frame (step backward from the seam pose by the same per-joint rotation
   delta as frame 0→1) roughly halves it, to 15.73 mm.
3. **`--cfg_weight`'s constraint component is NOT the enforcement lever.** Sweeping it
   2.0 → 4.0 → 8.0 left pose closure identical (the pin is already exact) and made the seam
   *worse* (15.73 → 15.85 → 18.39): the extra weight only bends the surrounding motion.
   Leave it at the default and change the constraint instead.

Net: a walk cycle moves from **fail** (141.8 mm) to **warn** (velocity-only, 15.73 mm vs a
15 mm pass threshold) while still travelling its full 5.6 m. Closing that last gap is the
open question — likely a wider velocity ramp at each end rather than a single frame.

### Still to verify

- Whether a 2–3 frame ramp at each end (rather than one frame) reaches a full `pass`.
- Whether `frame_indices` are clamped or wrapped at the clip boundary.
- Whether the same two-endpoint recipe holds for run/sprint, whose seam velocity is larger.

Everything downstream of the mapping is engine-specific; everything upstream of it
(gates, verdicts) already exists.

## Mapping sketch (to be validated, not to be implemented as written)

The mapping is where the design risk lives, and it should be built *after* one manual
correction has been proven to work by hand. Indicative shape only:

| Failing signal | Plausible corrective constraint |
|---|---|
| Tier-1 `poseGap` / `worstJoint` | full-body pose keyframe at the last frame pinned to frame 0's pose |
| Tier-1 `velJump` | keyframes on the two frames either side of the seam |
| `silhouette` low | sparse joint positions at the peak frame, widening the pose |
| `followThrough` low | end-effector keyframe past the peak, then a settle keyframe |
| `weight` / `timing` low | likely NOT constraint-addressable — these are dynamics, and a reworded prompt or a different seed is the honest response |

That last row matters: **not every critique failure has a constraint that fixes it**, and a
mapping that pretends otherwise would generate confident nonsense. The mapping must be
allowed to return "no corrective constraint available — re-roll or re-prompt", and the loop
must handle that as a normal outcome.

## Acceptance

- A clip that fails Tier-1 loop closure is regenerated with seam keyframes and passes on
  retry, with both scores recorded.
- The retry budget is bounded and the best attempt is surfaced with its real score.
- A dimension with no constraint mapping reports that fact rather than emitting a
  constraint that does not address it.
- No fabricated pass: a clip that never reaches `pass` is reported at its true verdict.
