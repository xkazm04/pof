import unreal as u
# 1) which relevant Python classes exist (the automation surface)
keys=['metahuman','bodytracker','footage','capture','performance','mocap','identity','ingest','animator','solver']
names=sorted(set(n for n in dir(u) if any(k in n.lower() for k in keys)))
u.log('MHA: %d candidate classes'%len(names))
for n in names: u.log('MHA:CLS %s'%n)
# 2) do the body-capture / performance classes exist?
for probe in ['MetaHumanPerformance','FootageCaptureData','MetaHumanCaptureSource','MetaHumanIdentity','MetaHumanPipeline','CaptureData']:
    u.log('MHA:HAS %s = %s'%(probe, hasattr(u,probe)))
# 3) any function libraries for body capture
libs=[n for n in dir(u) if 'MetaHuman' in n and ('Library' in n or 'Subsystem' in n or 'Pipeline' in n or 'Async' in n)]
for n in libs: u.log('MHA:LIB %s'%n)
