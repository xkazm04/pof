import unreal as u
fac=u.PhysicsAssetFactory()
props=[p for p in dir(fac) if not p.startswith('_')]
u.log("API: factory mesh/param props: %s"%[p for p in props if any(k in p.lower() for k in ('mesh','param','create','asset','skel'))])
for lib in ['PhysicsAssetEditorLibrary','SkeletalMeshEditorSubsystem','EditorSkeletalMeshLibrary','PhysicsAssetUtils']:
    has=hasattr(u,lib)
    u.log("API: has %s = %s"%(lib,has))
    if has:
        obj=getattr(u,lib)
        meth=[m for m in dir(obj) if not m.startswith('_') and ('phys' in m.lower() or 'create' in m.lower() or 'body' in m.lower())]
        u.log("API:   %s methods: %s"%(lib,meth))
