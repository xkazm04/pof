import unreal as u
def L(m): u.log("MOT: %s"%m)
a = u.load_asset("/Game/MHA/AS_VeoStrike")
nf = u.AnimationLibrary.get_num_frames(a)
L("AS_VeoStrike frames=%d length=%.2f" % (nf, a.get_play_length()))
for bone in ("hand_r","hand_l","foot_r","spine_03","pelvis"):
    xs=[];ys=[];zs=[]
    for f in range(0, nf, max(1,nf//16)):
        t = u.AnimationLibrary.get_bone_pose_for_frame(a, bone, f, True)
        p=t.translation; xs.append(p.x);ys.append(p.y);zs.append(p.z)
    rng=lambda v:max(v)-min(v)
    L("  %-9s travel X=%.1f Y=%.1f Z=%.1f" % (bone, rng(xs),rng(ys),rng(zs)))
