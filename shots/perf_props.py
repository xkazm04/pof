import unreal as u
def L(m): u.log("PROP: %s"%m)
at = u.AssetToolsHelpers.get_asset_tools()
perf = at.create_asset("Perf_Probe","/Game/MHA",u.MetaHumanPerformance,u.MetaHumanPerformanceFactoryNew())
for p in sorted([x for x in dir(perf) if not x.startswith('_') and 'editor' not in x]):
    if any(k in p.lower() for k in ('face','body','track','head','identity','skeletal','mesh','solve','process_range','range')):
        try: L("%s = %s" % (p, perf.get_editor_property(p)))
        except Exception: L("%s (method/unreadable)" % p)
u.EditorAssetLibrary.delete_asset("/Game/MHA/Perf_Probe")
