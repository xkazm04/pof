import unreal as u
def L(m): u.log("MOT: %s"%m)
def hand_range(path, bone):
    a = u.load_asset(path)
    if not a: L("%s MISSING"%path); return
    nf = u.AnimationLibrary.get_num_frames(a)
    xs=[];ys=[];zs=[]
    for f in range(0, nf, max(1,nf//12)):
        t = u.AnimationLibrary.get_bone_pose_for_frame(a, bone, f, True)
        p = t.translation
        xs.append(p.x);ys.append(p.y);zs.append(p.z)
    rng = lambda v:(max(v)-min(v))
    L("%s [%s] frames=%d  travel X=%.1f Y=%.1f Z=%.1f  (sample0=%.0f,%.0f,%.0f)" % (
        path.split('/')[-1], bone, nf, rng(xs),rng(ys),rng(zs), xs[0],ys[0],zs[0]))
# source (metahuman skel) and retargeted (manny)
hand_range("/Game/MHA/AS_VeoStrike", "hand_r")
hand_range("/Game/MHA/AS_VeoStrike_Manny", "hand_r")
hand_range("/Game/MHA/AS_VeoStrike_Manny", "pelvis")
