"""Verify AS_JediRoll_Dodge holds the new RollC data (root travel), then recreate AM_Roll
with a fresh reference to it (the trim_bake delete+recreate left AM_Roll's ref stale).
Preserves AM_Roll_mixamo; the prior Jedi montage goes to AM_Roll_prevjedi."""
import unreal as u


def L(m):
    u.log("VR: %s" % m)


seq = u.load_asset("/Game/Anims/Jedi/AS_JediRoll_Dodge")
nf = u.AnimationLibrary.get_num_frames(seq)
r0 = u.AnimationLibrary.get_bone_pose_for_frame(seq, "root", 0, False).translation
rN = u.AnimationLibrary.get_bone_pose_for_frame(seq, "root", nf, False).translation
L("AS_JediRoll_Dodge len=%.2f frames=%d rootmotion=%s rootEnd=(%.0f,%.0f,%.0f)" % (
    seq.get_play_length(), nf, seq.get_editor_property("enable_root_motion"), rN.x, rN.y, rN.z))

at = u.AssetToolsHelpers.get_asset_tools()
DEST = "/Game/Characters/Player/Animations/AM_Roll"
prev = "/Game/Characters/Player/Animations/AM_Roll_prevjedi"
if u.EditorAssetLibrary.does_asset_exist(DEST):
    if u.EditorAssetLibrary.does_asset_exist(prev):
        u.EditorAssetLibrary.delete_asset(prev)
    u.EditorAssetLibrary.rename_asset(DEST, prev)
    if u.EditorAssetLibrary.does_asset_exist(DEST):
        u.EditorAssetLibrary.delete_asset(DEST)
f = u.AnimMontageFactory()
f.set_editor_property("target_skeleton", seq.get_skeleton())
f.set_editor_property("source_animation", seq)
m = at.create_asset("AM_Roll", "/Game/Characters/Player/Animations", u.AnimMontage, f)
u.EditorAssetLibrary.save_asset(DEST)
chk = u.load_asset(DEST)
L("[gate] AM_Roll recreated len=%.2f (expect 2.27) RESULT=%s" % (
    chk.get_play_length(), "PASS" if abs(chk.get_play_length() - 2.27) < 0.2 else "FAIL"))
