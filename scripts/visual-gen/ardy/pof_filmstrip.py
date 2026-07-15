# PoF: render a stick-figure filmstrip from an ARDY .npz export (visual gate, no Blender needed).
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from ardy.skeleton.definitions import CoreSkeleton27

BONES = [(c, p) for c, p in CoreSkeleton27.bone_order_names_with_parents if p is not None]
NAMES = [n for n, _ in CoreSkeleton27.bone_order_names_with_parents]
IDX = {n: i for i, n in enumerate(NAMES)}


def render(npz_path: str, out_path: str, n_frames: int = 8) -> None:
    d = np.load(npz_path, allow_pickle=True)
    joints = d["posed_joints"]  # [T, 27, 3]
    contacts = d["foot_contacts"]  # [T, 4]
    T = joints.shape[0]
    picks = np.linspace(0, T - 1, n_frames).astype(int)

    fig, axes = plt.subplots(1, n_frames, figsize=(3 * n_frames, 4.5), subplot_kw={"projection": "3d"})
    span = 1.1  # meters around the root — human-scale framing

    for ax, t in zip(axes, picks):
        # ARDY joints are Y-up world-space; matplotlib 3D is Z-up → plot (x, z, y).
        # Center each frame on the root so traversal doesn't shrink the figure.
        j = joints[t][:, [0, 2, 1]]
        root = j[IDX["Hips"]].copy()
        j = j - root
        center = np.zeros(3)
        for child, parent in BONES:
            a, b = j[IDX[child]], j[IDX[parent]]
            ax.plot(*zip(a, b), c="steelblue", lw=2)
        ax.scatter(j[:, 0], j[:, 1], j[:, 2], c="crimson", s=8)
        # foot contacts: mark grounded feet
        feet = [IDX["RightFoot"], IDX["RightToeBase"], IDX["LeftFoot"], IDX["LeftToeBase"]]
        for fi, ji in enumerate(feet):
            if contacts[t, fi]:
                ax.scatter(*j[ji], c="limegreen", s=60, marker="s")
        ax.set_title(f"f{t} ({t / float(d['fps']):.2f}s)")
        for axis, c, s in (("x", 0, span), ("y", 1, span), ("z", 2, span)):
            getattr(ax, f"set_{axis}lim")(center[c] - s, center[c] + s)
        ax.view_init(elev=10, azim=-70)
        ax.set_axis_off()

    fig.suptitle(f"{npz_path} — \"{d['text']}\"", fontsize=10)
    fig.tight_layout()
    fig.savefig(out_path, dpi=80)
    print("wrote", out_path)


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2])
