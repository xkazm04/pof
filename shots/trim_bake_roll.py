"""Trim AS_JediRoll_Manny to its active dive->roll->stand window and bake a clean,
straight forward ROOT-MOTION curve so the dodge displaces (capsule follows the roll).

The capture is fully in-place (root stays at origin); the body rolls but never travels.
We copy the body bones for the trim window verbatim and overwrite the `root` track with a
smootherstep forward curve (like bake_clean_roll_root_motion.py / Forward_Roll_RT).

Env knobs (defaults = the active window measured by inspect_roll):
  ROLL_F0 / ROLL_F1  trim window in SOURCE frames (30fps)
  ROLL_DIST          forward travel (cm)
  ROLL_AXIS          x | -x | y | -y  (UE actor forward = +x)
  ROLL_LIFT          mid-roll vertical arc (cm) for floor clearance
Output: /Game/Anims/Jedi/AS_JediRoll_Dodge (root motion enabled).
"""
import os
import math
import unreal as u

SRC = os.environ.get("ROLL_SRC", "/Game/MHA/AS_JediRoll_Manny")
DST_DIR = "/Game/Anims/Jedi"
DST_NAME = "AS_JediRoll_Dodge"
F0 = int(os.environ.get("ROLL_F0", "58"))
F1 = int(os.environ.get("ROLL_F1", "134"))
DIST = float(os.environ.get("ROLL_DIST", "400"))
AXIS = os.environ.get("ROLL_AXIS", "x")
LIFT = float(os.environ.get("ROLL_LIFT", "0"))
FPS = 30


def L(m):
    u.log("TRIM: %s" % m)


def smoother(x):
    x = 0.0 if x < 0 else (1.0 if x > 1 else x)
    return x * x * x * (x * (x * 6 - 15) + 10)


src = u.load_asset(SRC)
if not src:
    L("[gate] RESULT=FAIL missing %s" % SRC)
    raise SystemExit
skel = src.get_skeleton()

model = None
for acc in ("data_model", "data_model_interface"):
    try:
        m = getattr(src, acc)
        if m and hasattr(m, "get_bone_track_names"):
            model = m
            break
    except Exception:
        pass
if not model:
    L("[gate] RESULT=FAIL no data model")
    raise SystemExit
bones = [str(n) for n in model.get_bone_track_names()]
if "root" not in bones:
    bones.append("root")
L("source bones=%d window f%d..f%d (%d frames)" % (len(bones), F0, F1, F1 - F0))

nframes = F1 - F0
nkeys = nframes + 1

# read body poses for the window (root is overwritten below)
posekeys = {}
for bn in bones:
    if bn == "root":
        continue
    pl, rl, sl = [], [], []
    bname = u.Name(bn)
    for k in range(nkeys):
        t = u.AnimationLibrary.get_bone_pose_for_frame(src, bname, F0 + k, False)
        pl.append(u.Vector(t.translation.x, t.translation.y, t.translation.z))
        rl.append(t.rotation)
        sl.append(u.Vector(t.scale3d.x, t.scale3d.y, t.scale3d.z))
    posekeys[bn] = (pl, rl, sl)

# forward root-motion curve
fwd = {"x": u.Vector(1, 0, 0), "-x": u.Vector(-1, 0, 0),
       "y": u.Vector(0, 1, 0), "-y": u.Vector(0, -1, 0)}.get(AXIS, u.Vector(1, 0, 0))
ident = u.Quat(0, 0, 0, 1)
one = u.Vector(1, 1, 1)
root_pos = []
for k in range(nkeys):
    p = k / max(1, nkeys - 1)
    a = smoother(p)
    z = LIFT * math.sin(math.pi * p)
    root_pos.append(u.Vector(fwd.x * DIST * a, fwd.y * DIST * a, z))

full = DST_DIR + "/" + DST_NAME
if u.EditorAssetLibrary.does_asset_exist(full):
    u.EditorAssetLibrary.delete_asset(full)
factory = u.AnimSequenceFactory()
factory.set_editor_property("target_skeleton", skel)
anim = u.AssetToolsHelpers.get_asset_tools().create_asset(DST_NAME, DST_DIR, u.AnimSequence, factory)
ctrl = anim.controller
ctrl.open_bracket("trim+rootmotion roll", True)
try:
    ctrl.set_frame_rate(u.FrameRate(FPS, 1))
    ctrl.set_number_of_frames(u.FrameNumber(nframes))
    for bn in bones:
        ctrl.add_bone_track(bn)
        if bn == "root":
            ctrl.set_bone_track_keys(bn, root_pos, [ident] * nkeys, [one] * nkeys, True)
        else:
            pl, rl, sl = posekeys[bn]
            ctrl.set_bone_track_keys(bn, pl, rl, sl, True)
finally:
    ctrl.close_bracket(True)
anim.set_editor_property("enable_root_motion", True)
anim.set_editor_property("force_root_lock", False)
u.EditorAssetLibrary.save_asset(full)
L("[gate] %s frames=%d len=%.2f dist=%.0f axis=%s rootmotion=%s RESULT=PASS" % (
    DST_NAME, nframes, anim.get_play_length(), DIST, AXIS,
    anim.get_editor_property("enable_root_motion")))
