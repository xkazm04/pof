import unreal as u
def L(m): u.log("DIAG: %s"%m)
cd = u.load_asset("/Game/CaptureManager/Imports/VeoStrikeC_1/CD_VeoStrikeC_1")
imgs = cd.get_editor_property("image_sequences")
L("cd metadata fps=%s" % cd.get_editor_property("metadata").get_editor_property("frame_rate"))
L("n image_sequences=%d  camera_calibrations=%s" % (len(imgs), cd.get_editor_property("camera_calibrations")))
seq = imgs[0]
L("image_seq[0] type=%s path=%s" % (type(seq).__name__, seq.get_path_name()))
for p in [x for x in dir(seq) if not x.startswith('_') and 'editor' not in x and any(k in x.lower() for k in ['rate','fps','frame','time','length','start','end','path','sequence'])]:
    try: L("  seq.%s = %s" % (p, seq.get_editor_property(p)))
    except Exception: pass
# also what does can_process need? check FootageCaptureData props
L("--- CD props ---")
for p in [x for x in dir(cd) if not x.startswith('_') and 'editor' not in x and any(k in x.lower() for k in ['rate','calib','valid','frame','range','excluded'])]:
    try: L("  cd.%s = %s" % (p, cd.get_editor_property(p)))
    except Exception: pass
