"""Re-source the dodge montage AM_Roll to our trimmed root-motion roll, so GA_Dodge
(which plays DodgeMontage_* = AM_Roll) drives the Jedi roll with displacement. Old Mixamo
roll preserved as AM_Roll_mixamo. Rename-then-create (referenced-asset safe)."""
import unreal as u


def L(m):
    u.log("RSRC: %s" % m)


at = u.AssetToolsHelpers.get_asset_tools()
SEQ = "/Game/Anims/Jedi/AS_JediRoll_Dodge"
DEST = "/Game/Characters/Player/Animations/AM_Roll"

seq = u.load_asset(SEQ)
if not seq:
    L("[gate] RESULT=FAIL missing %s" % SEQ)
    raise SystemExit
d, name = DEST.rsplit("/", 1)
if u.EditorAssetLibrary.does_asset_exist(DEST):
    prev = DEST + "_mixamo"
    if u.EditorAssetLibrary.does_asset_exist(prev):
        u.EditorAssetLibrary.delete_asset(prev)
    ok = u.EditorAssetLibrary.rename_asset(DEST, prev)
    L("rename AM_Roll -> _mixamo : %s" % ok)
    if u.EditorAssetLibrary.does_asset_exist(DEST):
        u.EditorAssetLibrary.delete_asset(DEST)
if u.EditorAssetLibrary.does_asset_exist(DEST):
    L("[gate] RESULT=FAIL path still occupied")
    raise SystemExit
f = u.AnimMontageFactory()
f.set_editor_property("target_skeleton", seq.get_skeleton())
f.set_editor_property("source_animation", seq)
m = at.create_asset(name, d, u.AnimMontage, f)
if not m:
    L("[gate] RESULT=FAIL create")
    raise SystemExit
u.EditorAssetLibrary.save_asset(DEST)
chk = u.load_asset(DEST)
L("[gate] AM_Roll len=%.2f (expect ~2.53 = our roll) RESULT=%s" % (
    chk.get_play_length(), "PASS" if chk.get_play_length() > 2.0 else "FAIL"))
