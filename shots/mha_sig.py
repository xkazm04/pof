import unreal as u
def doc(fn, tag):
    try: u.log('SIG: %s ::\n%s'%(tag, getattr(fn,'__doc__','?')))
    except Exception as e: u.log('SIG: %s ERR %s'%(tag,e))
doc(u.CaptureManagerIngestBlueprintLibrary.ingest_mono_video_sync, 'ingest_mono_video_sync')
u.log('SIG: DataInputType = %s'%[x for x in dir(u.DataInputType) if not x.startswith('_')])
mp=u.MetaHumanPerformance
for p in [m for m in dir(mp) if any(k in m.lower() for k in ['body','skeleton','target','input_type','frame_to_process','control_rig','device'])]:
    u.log('SIG:MP %s'%p)
# plugin mount + body assets (try a few mount roots)
import_roots=['/MetaHumanBodyTracker','/Game','/MetaHumanBodyTracker_5.8']
for r in import_roots:
    for a in ['metahuman_base_skel','SKEL_SMPL','RTG_SMPL_MH','IK_Metahuman']:
        p='%s/%s'%(r,a)
        if u.EditorAssetLibrary.does_asset_exist(p): u.log('SIG:ASSET %s'%p)
# MetaHumanExportAnimationSettings props (target skeleton field)
es=u.MetaHumanPerformanceExportAnimationSettings
for p in [m for m in dir(es) if any(k in m.lower() for k in ['target','skeleton','range','export','curve','head'])]:
    u.log('SIG:ES %s'%p)
