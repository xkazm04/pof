"""Create AM_JediRollDodge from the trimmed root-motion roll (fresh name, no redirector
conflict), then INSPECT BP_VSPlayer's CDO dodge-montage properties to learn how the dodge
is wired (so we can re-source AM_Roll or set the BP property)."""
import unreal as u


def L(m):
    u.log("WIRE: %s" % m)


at = u.AssetToolsHelpers.get_asset_tools()

# 1. create AM_JediRollDodge from the trimmed root-motion clip (fresh name)
SEQ = "/Game/Anims/Jedi/AS_JediRoll_Dodge"
MONT_DIR = "/Game/Anims/Jedi"
MONT = MONT_DIR + "/AM_JediRollDodge"
seq = u.load_asset(SEQ)
if seq:
    if u.EditorAssetLibrary.does_asset_exist(MONT):
        u.EditorAssetLibrary.delete_asset(MONT)
    f = u.AnimMontageFactory()
    f.set_editor_property("target_skeleton", seq.get_skeleton())
    f.set_editor_property("source_animation", seq)
    m = at.create_asset("AM_JediRollDodge", MONT_DIR, u.AnimMontage, f)
    if m:
        for prop in ("enable_root_motion_translation", "enable_root_motion_rotation"):
            try:
                m.set_editor_property(prop, True)
            except Exception as e:
                L("montage %s n/a: %s" % (prop, e))
        u.EditorAssetLibrary.save_asset(MONT)
        L("AM_JediRollDodge len=%.2f created" % m.get_play_length())
    else:
        L("AM_JediRollDodge create FAILED (path occupied)")
else:
    L("missing %s" % SEQ)

# 2. inspect BP_VSPlayer CDO dodge props (always run)
try:
    bp = u.load_asset("/Game/VerticalSlice/BP_VSPlayer")
    gc = bp.get_editor_property("generated_class") if bp else None
    cdo = None
    for getter in (lambda: gc.get_default_object(), lambda: u.get_default_object(gc)):
        try:
            cdo = getter()
            if cdo:
                break
        except Exception:
            pass
    L("bp=%s gc=%s cdo=%s" % (bool(bp), bool(gc), bool(cdo)))
    if cdo:
        for p in ("dodge_montage_forward", "dodge_montage_backward", "dodge_montage_left",
                  "dodge_montage_right", "dodge_montage_default", "dodge_montage_play_rate"):
            try:
                v = cdo.get_editor_property(p)
                L("  %s = %s" % (p, v.get_path_name() if hasattr(v, "get_path_name") else v))
            except Exception as e:
                L("  %s ERR %s" % (p, e))
except Exception as e:
    L("BP inspect failed: %s" % e)
