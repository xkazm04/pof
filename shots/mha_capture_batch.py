"""Batch MetaHuman Animator markerless body capture: loop (name, video, slate)
-> AS_<name> + SK_<name> under /Game/MHA, in ONE editor session (warm GPU, fewer
startups). Same 5 fixes as mha_capture.py: -AllowCommandletRendering (real RHI),
face_tracking=False (body-only), forced 30fps. Run headless with
-run=pythonscript -script=this -AllowCommandletRendering.
"""
import unreal as u

JOBS = [
    ("JediForcePush", "C:/Users/kazda/kiro/pof/shots/jedi/forcepush_clean.mp4", "JediForcePush"),
    ("JediParry",     "C:/Users/kazda/kiro/pof/shots/jedi/parry_clean.mp4",     "JediParry"),
    ("JediRoll",      "C:/Users/kazda/kiro/pof/shots/jedi/roll_clean.mp4",      "JediRoll"),
]
STORAGE = "/Game/MHA"


def L(m):
    u.log("CAPB: %s" % m)


u.EditorAssetLibrary.make_directory(STORAGE)
at = u.AssetToolsHelpers.get_asset_tools()


def capture_one(NAME, VIDEO, SLATE):
    L("=== %s (%s) ===" % (NAME, VIDEO))
    CD_PATH = "/Game/CaptureManager/Imports/%s_1/CD_%s_1" % (SLATE, SLATE)
    if u.EditorAssetLibrary.does_asset_exist(CD_PATH):
        cd = u.load_asset(CD_PATH)
        L("reuse cd %s" % CD_PATH)
    else:
        ret = u.CaptureManagerIngestBlueprintLibrary.ingest_mono_video_sync(
            VIDEO, "", SLATE, 1, u.CaptureManagerConversionParams())
        cd = ret[0] if isinstance(ret, (tuple, list)) else ret
    if not cd:
        L("[gate] %s RESULT=FAIL (ingest)" % NAME)
        return
    md = cd.get_editor_property("metadata")
    if md.get_editor_property("frame_rate") <= 0.0:
        md.set_editor_property("frame_rate", 30.0)
        cd.set_editor_property("metadata", md)
        for seq in cd.get_editor_property("image_sequences"):
            try:
                seq.set_editor_property("frame_rate_override", u.FrameRate(30, 1))
            except Exception:
                pass
            u.EditorAssetLibrary.save_loaded_asset(seq)
        u.EditorAssetLibrary.save_loaded_asset(cd)
        L("%s forced frame_rate=30" % NAME)
    for old in ("/Game/MHA/Perf_%s" % NAME, "/Game/MHA/AS_%s" % NAME, "/Game/MHA/SK_%s" % NAME):
        if u.EditorAssetLibrary.does_asset_exist(old):
            u.EditorAssetLibrary.delete_asset(old)
    perf = at.create_asset("Perf_%s" % NAME, STORAGE, u.MetaHumanPerformance, u.MetaHumanPerformanceFactoryNew())
    perf.set_editor_property("input_type", u.DataInputType.MONO_FOOTAGE)
    perf.set_editor_property("footage_capture_data", cd)
    perf.set_editor_property("body_tracking", True)
    perf.set_editor_property("face_tracking", False)
    perf.set_blocking_processing(True)
    if not perf.can_process():
        L("[gate] %s RESULT=FAIL (can_process False)" % NAME)
        return
    errt = perf.start_pipeline()
    L("%s start_pipeline -> %s" % (NAME, errt))
    s = u.MetaHumanPerformanceExportAnimationSettings()
    s.show_export_dialog = False
    s.export_body = True
    s.export_face = False
    s.enable_head_movement = False
    s.export_range = u.PerformanceExportRange.PROCESSING_RANGE
    s.package_path = STORAGE
    s.asset_name = "AS_%s" % NAME
    anim = u.MetaHumanPerformanceExportUtils.export_animation_sequence(perf, s)
    if anim:
        u.EditorAssetLibrary.save_asset(anim.get_path_name())
        L("[gate] %s RESULT=PASS anim=%s" % (NAME, anim.get_path_name()))
    else:
        L("[gate] %s RESULT=FAIL (export)" % NAME)


for j in JOBS:
    try:
        capture_one(*j)
    except Exception as e:
        L("%s EXC %s" % (j[0], e))
L("BATCH DONE")
