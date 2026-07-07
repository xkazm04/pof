import unreal as u
def L(m): u.log("IK: %s"%m)
# plugin MetaHuman IK rig + retargeters
for p in ["/MetaHumanBodyTracker/IK_Metahuman","/MetaHumanBodyTracker/IK_SMPL",
          "/MetaHumanBodyTracker/RTG_MH_IKRig","/MetaHumanBodyTracker/RTG_SMPL_MH","/MetaHumanBodyTracker/metahuman_base_skel"]:
    L("exists %s = %s" % (p, u.EditorAssetLibrary.does_asset_exist(p)))
# find Manny IK rigs / retargeters anywhere in /Game
ar = u.AssetRegistryHelpers.get_asset_registry()
for cls in ["IKRigDefinition","IKRetargeter"]:
    metas = ar.get_assets_by_class(u.TopLevelAssetPath("/Script/IKRig", cls), True)
    L("%s found: %d" % (cls, len(metas)))
    for m in metas[:20]:
        L("  %s -> %s" % (cls, m.package_name))
