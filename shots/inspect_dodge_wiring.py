"""Ground-truth: what montage does the dodge actually play? Print AM_Roll's referenced
sequence + the character's DodgeMontage_* targets (robust CDO access)."""
import unreal as u


def L(m):
    u.log("DW: %s" % m)


def seg_ref(mont_path):
    m = u.load_asset(mont_path)
    if not m:
        return "MISSING"
    try:
        tracks = m.get_editor_property("slot_anim_tracks")
        seg = tracks[0].get_editor_property("anim_track").get_editor_property("anim_segments")[0]
        ref = seg.get_editor_property("anim_reference")
        return "%s -> %s (len=%.2f)" % (mont_path.split('/')[-1], ref.get_path_name() if ref else None, m.get_play_length())
    except Exception as e:
        return "%s len=%.2f (seg read err: %s)" % (mont_path.split('/')[-1], m.get_play_length(), e)


L(seg_ref("/Game/Characters/Player/Animations/AM_Roll"))
L(seg_ref("/Game/Characters/Player/Animations/AM_Roll_mixamo"))

# BP CDO dodge montage targets — try several accessors
bp = u.load_asset("/Game/VerticalSlice/BP_VSPlayer")
gc = None
for attempt in (
    lambda: bp.generated_class(),
    lambda: u.load_object(None, "/Game/VerticalSlice/BP_VSPlayer.BP_VSPlayer_C"),
):
    try:
        gc = attempt()
        if gc:
            break
    except Exception as e:
        L("gc attempt err: %s" % e)
cdo = None
if gc:
    for g in (lambda: u.get_default_object(gc), lambda: gc.get_default_object()):
        try:
            cdo = g()
            if cdo:
                break
        except Exception as e:
            L("cdo err: %s" % e)
L("gc=%s cdo=%s" % (bool(gc), bool(cdo)))
if cdo:
    for p in ("dodge_montage_forward", "dodge_montage_backward", "dodge_montage_left",
              "dodge_montage_right", "dodge_montage_default", "dodge_montage_play_rate"):
        try:
            v = cdo.get_editor_property(p)
            L("  %s = %s" % (p, v.get_path_name() if hasattr(v, "get_path_name") else v))
        except Exception as e:
            L("  %s ERR %s" % (p, e))
