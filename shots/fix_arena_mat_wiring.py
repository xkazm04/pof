# Rewire the arena masters correctly: the first parameterization pass connected the new
# Tint parameter DIRECTLY to BaseColor, orphaning the albedo TextureSample (flat look).
# Correct graph: BaseColor = Tint(default WHITE) x AlbedoSample; Roughness =
# RoughnessScale(default 1.0) x RoughnessSample. Neutral defaults preserve the original
# render exactly; MI instances gain real tunables (the catalog's claim).
import unreal

MEL = unreal.MaterialEditingLibrary
PATHS = [
    "/Game/ArenaBuild/M_Arena_Floor",
    "/Game/ArenaBuild/M_Arena_Pillar",
    "/Game/ArenaBuild/M_Arena_Wall",
]

def classify_sample(expr):
    tex = expr.get_editor_property("texture")
    name = (tex.get_name() if tex else "").lower()
    if any(k in name for k in ("albedo", "basecolor", "base_color", "diff", "color")):
        return "albedo"
    if "normal" in name:
        return "normal"
    if any(k in name for k in ("rough", "orm", "arm")):
        return "rough"
    return "unknown"

for path in PATHS:
    mat = unreal.load_asset(path)
    if not mat:
        print(f"[gate] MISSING {path}")
        continue
    exprs = MEL.get_material_expressions(mat) or []
    tint = rough_param = None
    samples = {}
    for e in exprs:
        cls = e.get_class().get_name()
        if cls == "MaterialExpressionVectorParameter":
            tint = e
        elif cls == "MaterialExpressionScalarParameter":
            rough_param = e
        elif cls == "MaterialExpressionTextureSample":
            kind = classify_sample(e)
            samples.setdefault(kind, e)
    albedo = samples.get("albedo") or samples.get("unknown")
    rough_tex = samples.get("rough")
    def tex_name(s):
        t = s.get_editor_property("texture")
        return t.get_name() if t else "?"
    sample_desc = ", ".join(k + ":" + tex_name(v) for k, v in samples.items())
    print(f"[info] {path}: samples={sample_desc}")

    if not (tint and albedo):
        print(f"[gate] SKIP {path} — missing tint param or albedo sample")
        continue

    # Neutral defaults preserve the original look.
    tint.set_editor_property("default_value", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
    mul_bc = MEL.create_material_expression(mat, unreal.MaterialExpressionMultiply, -300, -250)
    MEL.connect_material_expressions(tint, "", mul_bc, "A")
    MEL.connect_material_expressions(albedo, "RGB", mul_bc, "B")
    MEL.connect_material_property(mul_bc, "", unreal.MaterialProperty.MP_BASE_COLOR)

    if rough_param:
        rough_param.set_editor_property("parameter_name", "RoughnessScale")
        rough_param.set_editor_property("default_value", 1.0)
        if rough_tex:
            mul_r = MEL.create_material_expression(mat, unreal.MaterialExpressionMultiply, -300, 150)
            MEL.connect_material_expressions(rough_param, "", mul_r, "A")
            MEL.connect_material_expressions(rough_tex, "R", mul_r, "B")
            MEL.connect_material_property(mul_r, "", unreal.MaterialProperty.MP_ROUGHNESS)
        # else: leave the param driving Roughness directly (previous wiring), default 1.0 is
        # wrong for a direct drive — adopt 0.8 stone-family default instead.
        if not rough_tex:
            rough_param.set_editor_property("default_value", 0.8)

    MEL.recompile_material(mat)
    saved = unreal.EditorAssetLibrary.save_asset(path, only_if_is_dirty=False)
    print(f"[gate] REWIRED {path} saved={saved} albedo={tex_name(albedo)} roughTex={bool(rough_tex)}")

print("[gate] RESULT=DONE")
