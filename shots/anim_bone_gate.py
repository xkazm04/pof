"""Ground-truth numeric gate for a retargeted Manny AnimSequence.

Measures each bone's ROTATION range (quaternion angular distance from the rest
frame, wraparound-safe) across the clip. Local-space TRANSLATION is ~0 for limbs
(bones don't stretch) so it gives false 'static' readings — rotation is the real
signal (see project memory: a good capture shows upperarm_r ~55-75 deg).

Env: MHA_NAME selects /Game/MHA/AS_<NAME>_Manny (default = VeoStrike).
Gate: PASS if at least one upper-body bone rotates >= 35 deg (motion transferred).
"""
import os
import math
import unreal as u

NAME = os.environ.get("MHA_NAME", "VeoStrike")
PATH = "/Game/MHA/AS_%s_Manny" % NAME
BONES = ["pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r",
         "upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "hand_l", "hand_r",
         "thigh_l", "thigh_r", "calf_l", "calf_r", "neck_01", "head"]
UPPER = ["spine_01", "spine_02", "spine_03", "upperarm_l", "upperarm_r",
         "lowerarm_l", "lowerarm_r", "clavicle_l", "clavicle_r"]


def L(m):
    u.log("GATE: %s" % m)


def qdist_deg(q0, q1):
    d = abs(q0.x * q1.x + q0.y * q1.y + q0.z * q1.z + q0.w * q1.w)
    d = min(1.0, max(-1.0, d))
    return math.degrees(2.0 * math.acos(d))


a = u.load_asset(PATH)
if not a:
    L("[gate] RESULT=FAIL anim %s MISSING" % PATH)
    raise SystemExit
nf = u.AnimationLibrary.get_num_frames(a)
L("anim=%s frames=%d length=%.3f" % (PATH, nf, a.get_play_length()))

ranges = {}
step = max(1, nf // 40)
for b in BONES:
    try:
        q0 = u.AnimationLibrary.get_bone_pose_for_frame(a, b, 0, False).rotation
    except Exception:
        continue
    mx = 0.0
    for f in range(0, nf, step):
        try:
            qf = u.AnimationLibrary.get_bone_pose_for_frame(a, b, f, False).rotation
        except Exception:
            continue
        d = qdist_deg(q0, qf)
        if d > mx:
            mx = d
    ranges[b] = mx

for b in BONES:
    if b in ranges:
        L("  %-12s rot_range=%.1f deg" % (b, ranges[b]))

best = 0.0
peak_bone = "?"
for b in UPPER:
    if ranges.get(b, 0.0) > best:
        best = ranges[b]
        peak_bone = b
L("upper-body peak: %s = %.1f deg (threshold 35)" % (peak_bone, best))
L("[gate] RESULT=%s peak=%.1f" % ("PASS" if best >= 35.0 else "FAIL", best))
