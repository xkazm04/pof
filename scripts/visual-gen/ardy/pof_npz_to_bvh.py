# PoF: convert an ARDY .npz motion export to BVH (Core-27 skeleton, Mixamo-style bone names).
#
# Faithful re-parameterization of ARDY's own FK convention (ardy/skeleton/kinematics.py):
#   global_child = global_parent @ [R_local | rest_offset]
# which is exactly BVH semantics — so we verify with an FK round-trip against posed_joints
# and refuse to write a file that doesn't reproduce them (the anti-bind-pose-scramble gate).
import sys

import numpy as np
import torch
from scipy.spatial.transform import Rotation

from ardy.skeleton.kinematics import fk
from ardy.skeleton.registry import build_skeleton

NAMES_PARENTS = None  # filled from the skeleton


def load_skeleton():
    skel = build_skeleton(27)
    names = [n for n, _ in skel.bone_order_names_with_parents]
    parents = {n: p for n, p in skel.bone_order_names_with_parents}
    neutral = skel.neutral_joints.numpy()  # [27, 3]
    # fk() recenters neutral joints on the root for global root positions
    neutral = neutral - neutral[skel.root_idx]
    return skel, names, parents, neutral


def fk_check(d, skel) -> float:
    """Reproduce posed_joints from local rotations via ardy's own fk(); return max error (m)."""
    _, posed, _ = fk(
        torch.from_numpy(d["local_rot_mats"]).float(),
        torch.from_numpy(d["root_positions"]).float(),
        skel,
        root_positions_is_global=True,
    )
    return float(np.abs(posed.numpy() - d["posed_joints"]).max())


def write_bvh(npz_path: str, out_path: str) -> None:
    d = dict(np.load(npz_path, allow_pickle=True))
    skel, names, parents, neutral = load_skeleton()

    err = fk_check(d, skel)
    if err > 1e-3:
        raise SystemExit(f"FK round-trip failed ({err:.4f} m) — local_rot_mats do not reproduce posed_joints")
    print(f"FK round-trip ok (max err {err * 1000:.3f} mm)")

    idx = {n: i for i, n in enumerate(names)}
    children = {n: [c for c, p in parents.items() if p == n] for n in names}
    T = d["local_rot_mats"].shape[0]
    fps = float(d["fps"])

    # ARDY local_rot_mats are parent-relative with world-aligned rest axes -> BVH euler ZXY
    eul = np.zeros((T, len(names), 3))
    for j in range(len(names)):
        eul[:, j] = Rotation.from_matrix(d["local_rot_mats"][:, j]).as_euler("ZXY", degrees=True)

    lines = ["HIERARCHY"]

    def emit(name: str, depth: int) -> None:
        pad = "  " * depth
        off = neutral[idx[name]] - (neutral[idx[parents[name]]] if parents[name] else 0.0)
        if parents[name] is None:
            lines.append(f"{pad}ROOT {name}")
            chan = "CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation"
        else:
            lines.append(f"{pad}JOINT {name}")
            chan = "CHANNELS 3 Zrotation Xrotation Yrotation"
        lines.append(f"{pad}{{")
        lines.append(f"{pad}  OFFSET {off[0]:.6f} {off[1]:.6f} {off[2]:.6f}")
        lines.append(f"{pad}  {chan}")
        kids = children[name]
        if not kids:
            lines.append(f"{pad}  End Site")
            lines.append(f"{pad}  {{")
            lines.append(f"{pad}    OFFSET 0.0 0.08 0.0")
            lines.append(f"{pad}  }}")
        for k in kids:
            emit(k, depth + 1)
        lines.append(f"{pad}}}")

    emit(names[0], 0)
    lines.append("MOTION")
    lines.append(f"Frames: {T}")
    lines.append(f"Frame Time: {1.0 / fps:.6f}")
    for t in range(T):
        row = list(d["root_positions"][t]) + list(eul[t, 0])
        for j in range(1, len(names)):
            row += list(eul[t, j])
        lines.append(" ".join(f"{v:.6f}" for v in row))

    with open(out_path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", out_path, f"({T} frames @ {fps:g} fps)")


if __name__ == "__main__":
    write_bvh(sys.argv[1], sys.argv[2])
