import unreal
MEL = unreal.MaterialEditingLibrary
for path in ["/Game/ArenaBuild/M_Arena_Floor", "/Game/ArenaBuild/M_Arena_Pillar", "/Game/ArenaBuild/M_Arena_Wall"]:
    mat = unreal.load_asset(path)
    exprs = MEL.get_material_expressions(mat) or []
    print(f"[probe] {path}: " + ", ".join(sorted(e.get_class().get_name() for e in exprs)))
print("[gate] RESULT=DONE")
