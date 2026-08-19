# PoF: measure loop closure on a generated motion .npz and emit POF_LOOP_* markers.
#
# Tier-1 numeric gate (see src/lib/motion-gate/loopClosure.ts, which parses these markers).
# A locomotion clip is only usable in a Blend Space if it loops; the VLM anim-critique tier
# judges six aesthetic dimensions and none of them is a loop check, so a clip that hitches
# every cycle can score `pass` today.
#
# Everything is measured ROOT-RELATIVE: a walk cycle that travels 8 m loops perfectly well,
# and grading absolute joint positions would fail every travelling clip. Root travel is
# reported for context only and is never graded.
#
# Usage:
#   python pof_loop_closure.py <motion.npz> [--joints-key posed_joints] [--root-key root_positions]
import argparse
import sys

import numpy as np

MM = 1000.0  # ARDY/Kimodo npz exports are in metres; the gate speaks millimetres.


def rms(vecs: np.ndarray) -> float:
    """Root-mean-square of per-joint vector magnitudes. vecs: [J, 3]."""
    return float(np.sqrt(np.mean(np.sum(vecs * vecs, axis=-1))))


def root_relative(joints: np.ndarray, root: np.ndarray) -> np.ndarray:
    """joints: [T, J, 3], root: [T, 3] -> [T, J, 3] with the root translation removed."""
    return joints - root[:, None, :]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("npz")
    ap.add_argument("--joints-key", default="posed_joints")
    ap.add_argument("--root-key", default="root_positions")
    a = ap.parse_args()

    data = np.load(a.npz, allow_pickle=False)

    if a.joints_key not in data:
        print(f"POF_LOOP_ERROR=missing key '{a.joints_key}' (have: {','.join(data.files)})")
        return 2

    joints = np.asarray(data[a.joints_key], dtype=np.float64)  # [T, J, 3]
    if joints.ndim != 3 or joints.shape[-1] != 3:
        print(f"POF_LOOP_ERROR=expected [T,J,3] joints, got {joints.shape}")
        return 2

    frames = int(joints.shape[0])
    if frames < 3:
        # Need frame 0, 1, last-1 and last to measure a seam velocity at all.
        print(f"POF_LOOP_ERROR=need >=3 frames to measure a seam, got {frames}")
        return 2

    # Prefer the exported root track; fall back to joint 0 (the root joint in both the
    # ARDY Core-27 and Kimodo SOMA skeletons) so the gate still runs on a bare export.
    if a.root_key in data:
        root = np.asarray(data[a.root_key], dtype=np.float64)
    else:
        root = joints[:, 0, :]
    if root.shape[0] != frames:
        print(f"POF_LOOP_ERROR=root track has {root.shape[0]} frames, joints have {frames}")
        return 2

    rel = root_relative(joints, root)

    first, last = rel[0], rel[-1]
    delta = last - first                       # [J, 3]
    pose_gap_mm = rms(delta) * MM
    worst_joint_mm = float(np.max(np.linalg.norm(delta, axis=-1))) * MM

    # Seam velocity: what the motion is doing as it leaves frame 0 vs as it arrives at the
    # last frame. Poses can match exactly while the clip still stutters through the wrap.
    vel_out = rel[1] - rel[0]
    vel_in = rel[-1] - rel[-2]
    vel_jump_mm = rms(vel_out - vel_in) * MM

    root_travel_mm = float(np.linalg.norm(root[-1] - root[0])) * MM

    print(f"POF_LOOP_POSE_GAP_MM={pose_gap_mm:.4f}")
    print(f"POF_LOOP_WORST_JOINT_MM={worst_joint_mm:.4f}")
    print(f"POF_LOOP_VEL_JUMP_MM={vel_jump_mm:.4f}")
    print(f"POF_LOOP_ROOT_TRAVEL_MM={root_travel_mm:.4f}")
    print(f"POF_LOOP_FRAMES={frames}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
