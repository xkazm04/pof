"""Point BP_VSPlayer's DodgeMontage_* at AM_Roll (our RollC roll). The dodge currently
points at AM_Roll_mixamo (Forward_Roll_RT) because a prior rename made the BP reference
follow. Set the CDO defaults directly + compile + save."""
import unreal as u


def L(m):
    u.log("SET: %s" % m)


am = u.load_asset("/Game/Characters/Player/Animations/AM_Roll")
bp = u.load_asset("/Game/VerticalSlice/BP_VSPlayer")
gc = u.load_object(None, "/Game/VerticalSlice/BP_VSPlayer.BP_VSPlayer_C")
cdo = u.get_default_object(gc)
if not (am and cdo):
    L("[gate] RESULT=FAIL am=%s cdo=%s" % (bool(am), bool(cdo)))
    raise SystemExit
for p in ("dodge_montage_forward", "dodge_montage_backward", "dodge_montage_left",
          "dodge_montage_right", "dodge_montage_default"):
    cdo.set_editor_property(p, am)
    L("set %s -> AM_Roll" % p)
try:
    u.BlueprintEditorLibrary.compile_blueprint(bp)
    L("compiled BP")
except Exception as e:
    L("compile err: %s" % e)
u.EditorAssetLibrary.save_asset("/Game/VerticalSlice/BP_VSPlayer")

# verify from a fresh CDO read
cdo2 = u.get_default_object(u.load_object(None, "/Game/VerticalSlice/BP_VSPlayer.BP_VSPlayer_C"))
v = cdo2.get_editor_property("dodge_montage_forward")
path = v.get_path_name() if v else "None"
L("[gate] dodge_montage_forward = %s RESULT=%s" % (path, "PASS" if path.endswith("AM_Roll.AM_Roll") else "FAIL"))
