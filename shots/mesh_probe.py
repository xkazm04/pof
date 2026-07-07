import unreal as u
def L(m): u.log("MESH: %s"%m)
ar = u.AssetRegistryHelpers.get_asset_registry()
metas = ar.get_assets_by_class(u.TopLevelAssetPath("/Script/Engine","SkeletalMesh"), True)
L("total skeletal meshes: %d"%len(metas))
for m in metas:
    pn = str(m.package_name)
    # show its skeleton tag
    skel = ""
    try:
        skel = str(m.get_tag_value("Skeleton"))
    except Exception: pass
    if any(k in pn for k in ("MetaHuman","metahuman","SMPL","Body","Manny","manny")) or "metahuman_base_skel" in skel:
        L("  %s   skel=%s" % (pn, skel))
# does the plugin content list?
L("--- /MetaHumanBodyTracker assets ---")
try:
    for a in u.EditorAssetLibrary.list_assets("/MetaHumanBodyTracker", recursive=True)[:40]:
        L("  %s" % a)
except Exception as e:
    L("list err: %s" % e)
