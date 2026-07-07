import unreal as u
def L(m): u.log("RTG: %s"%m)
# IK_Manny chains
ik_manny = u.load_asset("/Game/Characters/Player/IK/IK_Manny")
c = u.IKRigController.get_controller(ik_manny)
L("IK_Manny controller=%s" % (c is not None))
try:
    chains = c.get_retarget_chains()
    L("retarget_root=%s  chains=%d" % (c.get_retarget_root(), len(chains)))
    for ch in chains:
        L("  chain %s : %s -> %s" % (ch.chain_name, ch.start_bone.bone_name, ch.end_bone.bone_name))
except Exception as e:
    L("chains err: %s" % e)
# API surfaces
L("--- IKRigController methods ---")
L(", ".join([m for m in dir(u.IKRigController) if not m.startswith('_') and any(k in m.lower() for k in ('chain','root','mesh','skeleton','goal'))]))
L("--- IKRetargeterController methods ---")
L(", ".join([m for m in dir(u.IKRetargeterController) if not m.startswith('_') and any(k in m.lower() for k in ('ik_rig','map','root','chain','retarget','pose'))]))
L("--- unreal.*Retarget* classes ---")
L(", ".join([n for n in dir(u) if 'Retarget' in n]))
