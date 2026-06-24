"""Headless MetaHuman Animator Markerless body capture: Veo mp4 -> AnimSequence.
Reference: Engine/Plugins/MetaHuman/MetaHumanAnimator/Content/Python/process_monocular_performance.py
"""
import unreal as u

VIDEO = "C:/Users/kazda/kiro/pof/shots/veo/strike_clean.mp4"
SLATE = "VeoStrikeC"
STORAGE = "/Game/MHA"

def L(m):
    u.log("CAP: %s" % m)

u.EditorAssetLibrary.make_directory(STORAGE)

# ---- 1. INGEST mono video -> FootageCaptureData (reuse if already ingested) ----
CD_PATH = "/Game/CaptureManager/Imports/%s_1/CD_%s_1" % (SLATE, SLATE)
cd = None
if u.EditorAssetLibrary.does_asset_exist(CD_PATH):
    cd = u.load_asset(CD_PATH)
    L("reusing existing capture data %s" % CD_PATH)
else:
    params = u.CaptureManagerConversionParams()
    ret = u.CaptureManagerIngestBlueprintLibrary.ingest_mono_video_sync(VIDEO, "", SLATE, 1, params)
    cd = ret[0] if isinstance(ret, (tuple, list)) else ret
    err = ret[1] if isinstance(ret, (tuple, list)) and len(ret) > 1 else None
    L("ingested capture_data=%s err=%s" % (cd.get_path_name() if cd else None, err))
if not cd:
    L("[gate] RESULT=FAIL (ingest)"); raise SystemExit
try:
    imgs = cd.get_editor_property("image_sequences")
    md = cd.get_editor_property("metadata")
    L("cd image_sequences=%d  frame_rate=%s  device=%s" % (len(imgs), md.get_editor_property("frame_rate"), md.get_editor_property("device_class")))
    # The mono extractor can't read fps from the Veo mp4 -> frame_rate=0 blocks processing. Force 30.
    if md.get_editor_property("frame_rate") <= 0.0:
        md.set_editor_property("frame_rate", 30.0)
        cd.set_editor_property("metadata", md)
        # also stamp fps onto the image sequence assets themselves
        for seq in imgs:
            try:
                seq.set_editor_property("frame_rate_override", u.FrameRate(30, 1))
            except Exception:
                pass
            u.EditorAssetLibrary.save_loaded_asset(seq)
        u.EditorAssetLibrary.save_loaded_asset(cd)
        L("forced frame_rate=30 (cd.metadata now %s)" % cd.get_editor_property("metadata").get_editor_property("frame_rate"))
except Exception as e:
    L("cd inspect err: %s" % e)

# ---- 2. PERFORMANCE (MONO_FOOTAGE + body tracking) ----
at = u.AssetToolsHelpers.get_asset_tools()
# fresh solve every run: clear prior perf + outputs
for old in ("/Game/MHA/Perf_VeoStrike", "/Game/MHA/AS_VeoStrike", "/Game/MHA/SK_VeoStrike"):
    if u.EditorAssetLibrary.does_asset_exist(old):
        u.EditorAssetLibrary.delete_asset(old)
perf = at.create_asset("Perf_VeoStrike", STORAGE, u.MetaHumanPerformance, u.MetaHumanPerformanceFactoryNew())
perf.set_editor_property("input_type", u.DataInputType.MONO_FOOTAGE)
perf.set_editor_property("footage_capture_data", cd)
# Body-ONLY solve: enable body, DISABLE face. Face is on by default and on a combat clip
# the face detector fails (face small/turned) and gates the whole solve to the few
# face-detected frames -> a static result. Body-only runs the SMPL solve on all frames.
perf.set_editor_property("body_tracking", True)
perf.set_editor_property("face_tracking", False)
L("tracking: body=%s face=%s" % (perf.get_editor_property("body_tracking"), perf.get_editor_property("face_tracking")))

# ---- 3. SOLVE (blocking) ----
perf.set_blocking_processing(True)
try:
    L("diagnostics_issue=%s" % perf.diagnostics_indicates_processing_issue())
except Exception as e:
    L("diag err: %s" % e)
L("can_process=%s" % perf.can_process())
try:
    L("cannot_process_reason: %s" % perf.get_cannot_process_tooltip_text())
except Exception as e:
    L("reason err: %s" % e)
# frame range diagnostics
for p in ("start_frame_to_process", "end_frame_to_process"):
    try: L("perf.%s=%s" % (p, perf.get_editor_property(p)))
    except Exception: pass
if not perf.can_process():
    L("[gate] RESULT=FAIL (can_process False). stopping.")
    raise SystemExit
errt = perf.start_pipeline()
L("start_pipeline -> %s  processed_frames=%s" % (errt, perf.get_number_of_processed_frames()))
try:
    L("contains_animation_data=%s" % perf.contains_animation_data())
except Exception as e:
    L("contains check err: %s" % e)

# ---- 4. EXPORT AnimSequence ----
s = u.MetaHumanPerformanceExportAnimationSettings()
s.show_export_dialog = False
s.export_body = True
s.export_face = False
s.enable_head_movement = False
s.export_range = u.PerformanceExportRange.PROCESSING_RANGE
s.package_path = STORAGE
s.asset_name = "AS_VeoStrike"
L("export settings ready (export_body=True). attempting export...")
anim = u.MetaHumanPerformanceExportUtils.export_animation_sequence(perf, s)
L("exported anim=%s" % (anim.get_path_name() if anim else None))
if anim:
    u.EditorAssetLibrary.save_asset(anim.get_path_name())
    L("[gate] RESULT=PASS anim=%s" % anim.get_path_name())
else:
    L("[gate] RESULT=FAIL (export)")
