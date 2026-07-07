# Parameterize the three ArenaBuild master materials so the catalog's claim
# (tunable tint/roughness on instances) is true in the asset, not just prose.
# Gate-driven fix 2026-07-07: PoF.Materials.ArenaMasters found scalar 0 + vector 0 +
# texture 0 on all three masters (baked constant graphs).
#
# Strategy: ADOPT the existing constants — read the material's current
# Constant3Vector/Constant expression values, create Tint (vector) and Roughness
# (scalar) parameters DEFAULTED to those exact values, and wire them to the
# BaseColor/Roughness properties. Visually identical, now instance-tunable.
# Idempotent: skips materials that already expose parameters.
#
# Run headless:
#   UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<this file>" -unattended -nopause -nullrhi
import unreal

MEL = unreal.MaterialEditingLibrary
PATHS = [
    "/Game/ArenaBuild/M_Arena_Floor",
    "/Game/ArenaBuild/M_Arena_Pillar",
    "/Game/ArenaBuild/M_Arena_Wall",
]
# Fallbacks if a constant is not found (courtyard stone family).
FALLBACK_TINT = unreal.LinearColor(0.52, 0.49, 0.45, 1.0)
FALLBACK_ROUGH = 0.8

for path in PATHS:
    mat = unreal.load_asset(path)
    if not mat:
        print(f"[gate] MISSING {path}")
        continue
    if MEL.get_scalar_parameter_names(mat) or MEL.get_vector_parameter_names(mat):
        print(f"[skip] {path} already parameterized")
        continue

    # Adopt existing constants as the parameter defaults.
    tint_default = FALLBACK_TINT
    rough_default = FALLBACK_ROUGH
    for expr in (MEL.get_material_expressions(mat) or []):
        cls = expr.get_class().get_name()
        if cls == "MaterialExpressionConstant3Vector":
            c = expr.get_editor_property("constant")
            tint_default = unreal.LinearColor(c.r, c.g, c.b, 1.0)
        elif cls == "MaterialExpressionConstant":
            v = float(expr.get_editor_property("r"))
            if 0.0 <= v <= 1.0:
                rough_default = v

    tint = MEL.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, -600, -200)
    tint.set_editor_property("parameter_name", "Tint")
    tint.set_editor_property("default_value", tint_default)
    MEL.connect_material_property(tint, "", unreal.MaterialProperty.MP_BASE_COLOR)

    rough = MEL.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -600, 100)
    rough.set_editor_property("parameter_name", "Roughness")
    rough.set_editor_property("default_value", rough_default)
    MEL.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)

    MEL.recompile_material(mat)
    saved = unreal.EditorAssetLibrary.save_asset(path, only_if_is_dirty=False)
    print(f"[gate] PARAMETERIZED {path} saved={saved} tint={tint_default} rough={rough_default} "
          f"scalars={list(MEL.get_scalar_parameter_names(mat))} vectors={list(MEL.get_vector_parameter_names(mat))}")

print("[gate] RESULT=DONE")
