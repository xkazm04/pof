import unreal as u
KW=['process','solve','export','footage','body','identity','anim','create','add','set_','ingest','target','config','start','run','take','performance','pipeline']
def dump(cls):
    if not hasattr(u, cls): u.log('API2: MISSING %s'%cls); return
    c=getattr(u,cls)
    meth=[m for m in dir(c) if not m.startswith('_') and any(k in m.lower() for k in KW)]
    u.log('API2: === %s (%d relevant) ==='%(cls,len(meth)))
    for m in meth: u.log('API2:  %s.%s'%(cls,m))
for cls in ['MetaHumanPerformance','MetaHumanCaptureSource','FootageCaptureData','CaptureManagerIngestBlueprintLibrary','MetaHumanExportAnimSequenceSettings','MetaHumanBodyDriverActor','MetaHumanIdentity']:
    dump(cls)
# function libraries for performance export / processing
fns=[n for n in dir(u) if any(k in n.lower() for k in ['performanceexport','metahumanperformance','exportutils','captureutils','performancelibrary','animatorpipeline'])]
u.log('API2:LIBS %s'%fns)
