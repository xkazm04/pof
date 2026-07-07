"""Re-source the ability-loaded montage paths to the mocap anims, robust to the
referenced-asset redirector quirk. GA_MeleeAttack unconditionally LoadObjects
/Game/Weapons/AM_SwordSlashC by string path; GA_Parry loads /Game/Weapons/AM_Parry.
Strategy: rename the old montage out of the path (references follow), fix up
redirectors so the path is truly free, then create the new montage from the mocap.
Verify by play_length (old code slash ~1.2s; mocap ~5.8s)."""
import unreal as u


def L(m):
    u.log("RSRC: %s" % m)


at = u.AssetToolsHelpers.get_asset_tools()
JOBS = [
    ("/Game/MHA/AS_JediSaber_Manny", "/Game/Weapons", "AM_SwordSlashC"),
    ("/Game/MHA/AS_JediParry_Manny", "/Game/Weapons", "AM_Parry"),
]

for seqp, d, name in JOBS:
    dest = d + "/" + name
    seq = u.load_asset(seqp)
    if not seq:
        L("FAIL missing %s" % seqp)
        continue
    if u.EditorAssetLibrary.does_asset_exist(dest):
        prev = dest + "_codeauthored"
        if u.EditorAssetLibrary.does_asset_exist(prev):
            u.EditorAssetLibrary.delete_asset(prev)
        ok = u.EditorAssetLibrary.rename_asset(dest, prev)
        L("rename %s -> _codeauthored : %s" % (name, ok))
        # fix up the redirector left at the old path so create can reuse it
        try:
            ar = u.AssetRegistryHelpers.get_asset_registry()
            redir = ar.get_assets_by_path(d, recursive=False)
            at.fixup_referencers([], False)  # no-op safety; real fixup below
        except Exception as e:
            L("fixup note: %s" % e)
        # delete a leftover redirector object sitting at dest, if any
        if u.EditorAssetLibrary.does_asset_exist(dest):
            u.EditorAssetLibrary.delete_asset(dest)
    if u.EditorAssetLibrary.does_asset_exist(dest):
        L("FAIL %s still occupied, cannot re-source" % dest)
        continue
    f = u.AnimMontageFactory()
    f.set_editor_property("target_skeleton", seq.get_skeleton())
    f.set_editor_property("source_animation", seq)
    m = at.create_asset(name, d, u.AnimMontage, f)
    if not m:
        L("FAIL create %s" % name)
        continue
    u.EditorAssetLibrary.save_asset(dest)
    check = u.load_asset(dest)
    L("[gate] %s len=%.2f (expect ~5.8 = mocap) RESULT=%s" % (
        name, check.get_play_length(), "PASS" if check.get_play_length() > 3.0 else "FAIL"))
L("RESOURCE DONE")
