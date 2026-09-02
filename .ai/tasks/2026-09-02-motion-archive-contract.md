# Task: the motion archive carries its own contract

Origin: registry intake 2026-09-02 (MONAI, v2 design read), design decisions D1 (metadata travels with the data) and D2 (applied operations are recorded so outputs can be traced back). Branch: `intake-monai-0902-v2`. Status: step 1 done, steps 2-4 open.

## The mechanism being adopted

A data object that leaves one script and enters another carries its own frame of reference and its own history: the frame rate, the skeleton it is posed on, the clips it was assembled from, and the operations applied since generation. Every reader verifies the contract before using the data. Every writer appends to it. Metadata does not ride beside the data in a naming convention or in the operator's memory.

## The seam as it was

Four archive readers and one producer under `scripts/visual-gen/ardy/`:

- `pof_npz_concat.py` read `fps` from the first clip only and stamped it over every clip; a 30-fps and a 24-fps clip concatenated without complaint into a montage with the wrong duration. It wrote `fps` and `text` and nothing about what it had done.
- `pof_npz_to_bvh.py` and `pof_filmstrip.py` hardcode the 27-joint skeleton (`build_skeleton(27)`) and trust `fps`; neither can tell a foreign archive from a native one.
- `pof_loop_closure.py` reads `fps` for context only.

Measurable: **readers that verify the archive contract before use: 0 of 4. Mixed-fps concatenations accepted: all.**

## Steps

1. **Done (this commit).** Concat refuses mixed `fps`, mixed joint counts and missing members; writes `skeleton`, `sources`, `applied_ops` members. Extra members are ignored by the existing readers, so nothing downstream changes until step 2. Proof: two synthetic 30-fps clips concatenate identically under old and new code (12 frames, 0.40 s, same seven arrays); a 30-fps plus a 24-fps pair is accepted by the old code (12 frames stamped at 30 fps) and refused by the new one.
2. `pof_npz_to_bvh.py`, `pof_filmstrip.py`, `pof_loop_closure.py`: read `skeleton` when present and refuse a mismatch against `build_skeleton`'s joint count; read `applied_ops` and print it in the filmstrip title. ~30 lines across three files.
3. The upstream text-to-motion export (outside this repo, see `docs/research/ardy-text-to-motion-spec.md`) writes `skeleton` and `applied_ops: ["generate"]` at source, so a native archive is distinguishable from a converted one. ~10 lines, in the external pipeline's export step.
4. A contract check script `pof_npz_contract_check.py` that prints the contract of any archive and exits non-zero on a missing member, wired into the montage builder before concat. ~40 lines.

Size: ~100 lines across five files plus one external edit. Gate that will see it: the montage builder's dry run (it prints `POF_SECTION_STARTS`) run against the fixture pair above; after step 4 the contract check is the gate.

## What would falsify the plan

A montage that legitimately mixes frame rates (resampling on the fly) — then the refusal in step 1 is wrong and the contract needs a `resample` op instead of a rejection. No such montage exists in the tree or its docs as of this task.
