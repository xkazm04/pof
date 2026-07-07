"""Inspect the roll anims + existing dodge montage to plan the root-motion bake."""
import os
import unreal as u


def L(m):
    u.log("INSP: %s" % m)


def report(path):
    a = u.load_asset(path)
    if not a:
        L("%s MISSING" % path)
        return
    if not isinstance(a, u.AnimSequence):
        L("%s is %s len=%.3f" % (path.split('/')[-1], type(a).__name__, a.get_play_length()))
        return
    nf = u.AnimationLibrary.get_num_frames(a)
    L("ANIM %s len=%.3f frames=%d rootmotion=%s forcelock=%s" % (
        path.split('/')[-1], a.get_play_length(), nf,
        a.get_editor_property("enable_root_motion"), a.get_editor_property("force_root_lock")))
    step = max(1, nf // 14)
    for f in range(0, nf + 1, step):
        try:
            pe = u.AnimationLibrary.get_bone_pose_for_frame(a, "pelvis", f, False).translation
            ro = u.AnimationLibrary.get_bone_pose_for_frame(a, "root", f, False).translation
            L("  f%3d t=%.2f pelvisZ=%6.1f rootXYZ=(%.1f,%.1f,%.1f)" % (f, f / 30.0, pe.z, ro.x, ro.y, ro.z))
        except Exception as e:
            L("  f%d err %s" % (f, e))


report(os.environ.get("ROLL_SRC", "/Game/MHA/AS_JediRoll_Manny"))
for mp in ("/Game/Characters/Player/Animations/AM_Roll", "/Game/Anims/Jedi/AM_JediRoll"):
    m = u.load_asset(mp)
    if not m:
        L("MONT %s MISSING" % mp)
        continue
    L("MONT %s len=%.3f" % (mp.split('/')[-1], m.get_play_length()))
