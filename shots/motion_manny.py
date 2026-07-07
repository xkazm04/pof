import unreal as u
def L(m): u.log("ROTM: %s"%m)
a = u.load_asset("/Game/MHA/AS_VeoStrike_Manny")
nf = u.AnimationLibrary.get_num_frames(a)
rng=lambda v:max(v)-min(v)
for bone in ("upperarm_r","lowerarm_r","upperarm_l","spine_03","thigh_r","calf_r"):
    R=[];P=[];Y=[]
    for f in range(0, nf, max(1,nf//20)):
        t=u.AnimationLibrary.get_bone_pose_for_frame(a,bone,f,False)
        r=t.rotation.rotator(); R.append(r.roll);P.append(r.pitch);Y.append(r.yaw)
    L("%-11s R=%5.0f P=%5.0f Y=%5.0f" % (bone, rng(R),rng(P),rng(Y)))
