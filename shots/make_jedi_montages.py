"""Create AnimMontages from the 4 retargeted Jedi action anims, and wire two of them
onto their abilities by re-sourcing the paths the abilities auto-load.

- Clean Stream-3 artifacts in /Game/Anims/Jedi/ : AM_JediSaber / _ForcePush / _Parry / _Roll
- Auto-wire (no C++ change): GA_MeleeAttack unconditionally loads /Game/Weapons/AM_SwordSlashC;
  GA_Parry loads /Game/Weapons/AM_Parry when ParryMontage is null. Re-source both to the mocap.
"""
import unreal as u


def L(m):
    u.log("MKM: %s" % m)


at = u.AssetToolsHelpers.get_asset_tools()
u.EditorAssetLibrary.make_directory("/Game/Anims/Jedi")

ARTIFACTS = [
    ("/Game/MHA/AS_JediSaber_Manny",     "AM_JediSaber",     "/Game/Anims/Jedi"),
    ("/Game/MHA/AS_JediForcePush_Manny", "AM_JediForcePush", "/Game/Anims/Jedi"),
    ("/Game/MHA/AS_JediParry_Manny",     "AM_JediParry",     "/Game/Anims/Jedi"),
    ("/Game/MHA/AS_JediRoll_Manny",      "AM_JediRoll",      "/Game/Anims/Jedi"),
]
# Re-source the ability-loaded paths to the mocap (saber -> GA_MeleeAttack, parry -> GA_Parry).
RESOURCE = [
    ("/Game/MHA/AS_JediSaber_Manny", "AM_SwordSlashC", "/Game/Weapons"),
    ("/Game/MHA/AS_JediParry_Manny", "AM_Parry",       "/Game/Weapons"),
]


def make(seqp, name, d, replace):
    seq = u.load_asset(seqp)
    if not seq:
        L("FAIL missing %s" % seqp)
        return False
    skel = seq.get_skeleton()
    path = d + "/" + name
    if u.EditorAssetLibrary.does_asset_exist(path):
        if replace:
            ok = u.EditorAssetLibrary.delete_asset(path)
            L("delete %s -> %s" % (path, ok))
            if u.EditorAssetLibrary.does_asset_exist(path):
                L("could not replace %s (referenced?) — leaving as-is" % path)
                return False
        else:
            L("%s exists, skip" % path)
            return True
    f = u.AnimMontageFactory()
    f.set_editor_property("target_skeleton", skel)
    f.set_editor_property("source_animation", seq)
    m = at.create_asset(name, d, u.AnimMontage, f)
    if not m:
        L("FAIL create %s" % name)
        return False
    u.EditorAssetLibrary.save_asset(path)
    L("%s <- %s len=%.2f OK" % (name, seqp.split('/')[-1], m.get_play_length()))
    return True


for a in ARTIFACTS:
    make(a[0], a[1], a[2], True)
for r in RESOURCE:
    make(r[0], r[1], r[2], True)
L("[gate] MONTAGES DONE")
