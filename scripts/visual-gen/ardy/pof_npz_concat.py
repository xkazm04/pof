# PoF: concatenate ARDY .npz clips into one motion (for a single-segment sectioned montage).
# Root positions are re-anchored per clip so each starts where the previous ended (XZ);
# prints the cumulative section start times for the montage builder.
import sys

import numpy as np

out = sys.argv[1]
ins = sys.argv[2:]

parts = [dict(np.load(p, allow_pickle=False)) for p in ins]
keys = ["local_rot_mats", "global_rot_mats", "posed_joints", "root_positions", "smooth_root_pos", "foot_contacts", "global_root_heading"]

# Archive contract (task 2026-09-02-motion-archive-contract, step 1): every part must agree on the
# frame rate and the joint count before anything is concatenated. A mixed-fps montage used to be
# accepted silently, with the first clip's fps stamped over all of them.
fps = float(parts[0]["fps"])
joints = int(parts[0]["posed_joints"].shape[1])
for p, d in zip(ins, parts):
    if float(d["fps"]) != fps:
        sys.exit(f"refusing to concatenate {p}: fps {float(d['fps'])} != {fps} (first clip)")
    if int(d["posed_joints"].shape[1]) != joints:
        sys.exit(f"refusing to concatenate {p}: {int(d['posed_joints'].shape[1])} joints != {joints} (first clip)")
    missing = [k for k in keys if k not in d]
    if missing:
        sys.exit(f"refusing to concatenate {p}: missing members {missing}")

merged = {k: [] for k in keys}
offset = np.zeros(3, dtype=np.float32)
starts = []
t = 0.0
for d in parts:
    starts.append(t)
    rp = d["root_positions"].astype(np.float32)
    shift = offset - np.array([rp[0, 0], 0.0, rp[0, 2]], dtype=np.float32)
    merged["root_positions"].append(rp + shift)
    merged["smooth_root_pos"].append(d["smooth_root_pos"].astype(np.float32) + shift)
    merged["posed_joints"].append(d["posed_joints"].astype(np.float32) + shift)
    for k in ["local_rot_mats", "global_rot_mats", "foot_contacts", "global_root_heading"]:
        merged[k].append(d[k])
    last = merged["root_positions"][-1][-1]
    offset = np.array([last[0], 0.0, last[2]], dtype=np.float32)
    t += d["local_rot_mats"].shape[0] / fps

arrays = {k: np.concatenate(v, axis=0) for k, v in merged.items()}
arrays["fps"] = np.asarray(int(fps))
arrays["text"] = np.asarray(" + ".join(str(d["text"]) for d in parts))
# Provenance members: which clips were joined, what was done to them, and the skeleton they share.
# Readers that know these members can verify them; readers that do not are unaffected (extra members).
arrays["skeleton"] = np.asarray(f"core-{joints}")
arrays["sources"] = np.asarray([str(p) for p in ins])
arrays["applied_ops"] = np.asarray(["concat:reanchor-root-xz"])
np.savez(out, **arrays)
total = arrays["local_rot_mats"].shape[0] / fps
print(f"wrote {out}: {arrays['local_rot_mats'].shape[0]} frames, {total:.2f}s")
print("POF_SECTION_STARTS", " ".join(f"{s:.3f}" for s in starts))
