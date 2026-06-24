import unreal as u
def L(m): u.log("RT: %s"%m)
at = u.AssetToolsHelpers.get_asset_tools()
SK_SRC   = u.load_asset("/Game/MHA/SK_VeoStrike")
SKM_MANNY= u.load_asset("/MoverTests/Characters/Mannequins/Meshes/SKM_Manny")
IK_MANNY = u.load_asset("/Game/Characters/Player/IK/IK_Manny")
AS_SRC   = u.load_asset("/Game/MHA/AS_VeoStrike")
L("src=%s manny=%s ikmanny=%s anim=%s" % (bool(SK_SRC),bool(SKM_MANNY),bool(IK_MANNY),bool(AS_SRC)))

# 1. clone IK_Manny chains onto a new IK rig bound to the MetaHuman body mesh (identical bone names)
mc = u.IKRigController.get_controller(IK_MANNY)
defs=[]
for ch in mc.get_retarget_chains():
    n = ch.get_editor_property('chain_name')
    defs.append((n, mc.get_retarget_chain_start_bone(n), mc.get_retarget_chain_end_bone(n), mc.get_retarget_chain_goal(n)))
L("read %d chains from IK_Manny" % len(defs))
IKP="/Game/MHA/IK_MHBody"
ik_src = u.load_asset(IKP) if u.EditorAssetLibrary.does_asset_exist(IKP) else at.create_asset("IK_MHBody","/Game/MHA",u.IKRigDefinition,u.IKRigDefinitionFactory())
sc = u.IKRigController.get_controller(ik_src)
sc.set_skeletal_mesh(SK_SRC)
try: sc.set_retarget_root("pelvis")
except Exception as e: L("root err %s"%e)
existing = set(str(ch.get_editor_property('chain_name')) for ch in sc.get_retarget_chains())
added=0
for (n,s,e,g) in defs:
    if str(n) in existing: continue
    try: sc.add_retarget_chain(n,s,e,g); added+=1
    except Exception as ex: L("chain %s err: %s"%(n,ex))
L("IK_MHBody chains added=%d (had %d)" % (added, len(existing)))
u.EditorAssetLibrary.save_loaded_asset(ik_src)

# 2. retargeter src=IK_MHBody tgt=IK_Manny
RTGP="/Game/MHA/RTG_MHToManny"
rtg = u.load_asset(RTGP) if u.EditorAssetLibrary.does_asset_exist(RTGP) else at.create_asset("RTG_MHToManny","/Game/MHA",u.IKRetargeter,u.IKRetargetFactory())
rc = u.IKRetargeterController.get_controller(rtg)
rc.set_ik_rig(u.RetargetSourceOrTarget.SOURCE, ik_src)
rc.set_ik_rig(u.RetargetSourceOrTarget.TARGET, IK_MANNY)
# UE5.8 retargeter ships an EMPTY op stack -> 0 ops = no motion transfer (static output).
# Add Pelvis Motion (root) + FK Chains (limb rotation transfer).
while rc.get_num_retarget_ops() > 0:
    rc.remove_retarget_op(0)
i1 = rc.add_retarget_op("/Script/IKRig.IKRetargetPelvisMotionOp")
i2 = rc.add_retarget_op("/Script/IKRig.IKRetargetFKChainsOp")
L("added ops pelvis=%s fk=%s" % (i1, i2))
rc.assign_ik_rig_to_all_ops(u.RetargetSourceOrTarget.SOURCE, ik_src)
rc.assign_ik_rig_to_all_ops(u.RetargetSourceOrTarget.TARGET, IK_MANNY)
try:
    rc.auto_map_chains(u.AutoMapChainType.EXACT, True); L("auto_map EXACT ok ops=%d" % rc.get_num_retarget_ops())
except Exception as e:
    L("automap err: %s" % e)
u.EditorAssetLibrary.save_loaded_asset(rtg)

# 3. batch retarget (assets_to_retarget wants AssetData)
ar = u.AssetRegistryHelpers.get_asset_registry()
ad = ar.get_asset_by_object_path("/Game/MHA/AS_VeoStrike.AS_VeoStrike")
L("assetdata valid=%s" % ad.is_valid())
try:
    res = u.IKRetargetBatchOperation.duplicate_and_retarget(
        [ad], SK_SRC, SKM_MANNY, rtg,
        search="", replace="", prefix="", suffix="_Manny",
        target_path="/Game/MHA", overwrite_existing_files=True)
    L("duplicate_and_retarget result=%s" % [str(r.package_name) for r in res])
    for r in res:
        u.EditorAssetLibrary.save_asset(str(r.package_name), only_if_is_dirty=False)
except Exception as e:
    L("dup_retarget err: %s" % e)
# verify + length
mp="/Game/MHA/AS_VeoStrike_Manny"
ok = u.EditorAssetLibrary.does_asset_exist(mp)
if ok:
    a = u.load_asset(mp)
    L("manny anim length=%.3f  skel=%s" % (a.get_play_length(), a.get_editor_property("skeleton").get_path_name()))
L("RESULT manny_anim_exists=%s" % ok)
