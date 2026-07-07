import unreal as u
def L(m): u.log("ANIM: %s"%m)
a = u.load_asset("/Game/MHA/AS_VeoStrike")
if not a:
    L("not found"); raise SystemExit
sk = a.get_editor_property("skeleton") if hasattr(a,'get_editor_property') else None
L("skeleton=%s" % (sk.get_path_name() if sk else None))
L("num_frames=%s  length=%.3f  fps=%s" % (
    a.get_editor_property("number_of_sampled_keys") if hasattr(a,'get_editor_property') else '?',
    a.get_play_length(),
    a.get_editor_property("target_frame_rate") if hasattr(a,'get_editor_property') else '?'))
# bone names on the skeleton (is it MetaHuman/Manny-compatible?)
if sk:
    bones = sk.get_editor_property("bone_tree") if False else None
    try:
        ra = u.SkeletalMeshLibrary  # not it
    except Exception: pass
    # use the anim's reference skeleton bone names via the skeleton
    try:
        names = [str(b) for b in u.AnimationLibrary.get_animation_track_names(a)][:30]
        L("anim track bones (%d): %s" % (len(names), names))
    except Exception as e:
        L("track names err: %s" % e)
