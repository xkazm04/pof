import unreal as u
def L(m): u.log("OP: %s"%m)
rtg = u.load_asset("/Game/MHA/RTG_MHToManny")
rc = u.IKRetargeterController.get_controller(rtg)
L("num_retarget_ops = %s" % rc.get_num_retarget_ops())
L("add_retarget_op doc: %s" % rc.add_retarget_op.__doc__)
L("assign_ik_rig_to_all_ops doc: %s" % rc.assign_ik_rig_to_all_ops.__doc__)
L("FK/Pelvis op classes: %s" % ", ".join([n for n in dir(u) if ('FKChains' in n or 'PelvisMotion' in n or 'IKChainsOp' in n or 'RootMotionOp' in n) and 'Settings' not in n and 'Controller' not in n]))
