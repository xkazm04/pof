"""
A FAMILY VARIANT of an already-imported monster (/diablo W06) — UE editor, headless.

  UnrealEditor-Cmd.exe <PoF.uproject> -run=pythonscript -script=<abs path> -nullrhi
  with env POF_DIABLO_VARIANT = JSON {"name": "Ghoul", "sourceName": "Zombie",
      "tint": [0.75, 0.80, 0.95], "heightCm": 180, "meleeDamage": 4.5}

Diablo builds monster art per FAMILY: Zombie, Ghoul and Rotting Carcass share ONE model and differ by
a palette swap (monstdat.assetsSuffix is the same set; trnFile recolours it). This reuses the source
entity's SkeletalMesh + animation and gives the variant its own tinted material instance, its own
size and its own melee damage — no second generation, no second rig.

The tint rides on M_DiabloTinted, a small master material created once: BaseColorTex * Tint -> Base
Color, NormalTex -> Normal. The source material's own textures are reused (no new texture work).
Prints POF_DIABLO_VARIANT_* markers; verifies by reading back what exists.
"""
import json
import os

import unreal

spec = json.loads(os.environ["POF_DIABLO_VARIANT"])
NAME, SOURCE = spec["name"], spec["sourceName"]
ROOT = "/Game/Diablo/Bestiary"
SRC_DIR, DEST = f"{ROOT}/{SOURCE}", f"{ROOT}/{NAME}"
lib = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
mel = unreal.MaterialEditingLibrary


def find(kind, folder):
    return [a for a in (lib.load_asset(p) for p in lib.list_assets(folder, recursive=True)) if isinstance(a, kind)]


src_mesh = next(iter(find(unreal.SkeletalMesh, SRC_DIR)), None)
if src_mesh is None:
    unreal.log_error(f"POF_DIABLO_VARIANT_ERROR=no SkeletalMesh under {SRC_DIR} — import the family's source entity first")
    raise SystemExit(1)
src_anims = find(unreal.AnimSequence, SRC_DIR)
src_textures = find(unreal.Texture, SRC_DIR)
base_tex = next((t for t in src_textures if "color" in t.get_name().lower()), None)
normal_tex = next((t for t in src_textures if "normal" in t.get_name().lower()), None)

# 1. The tintable master material (once for every variant).
master_path = f"{ROOT}/M_DiabloTinted"
if lib.does_asset_exist(master_path):
    master = lib.load_asset(master_path)
else:
    master = asset_tools.create_asset("M_DiabloTinted", ROOT, unreal.Material, unreal.MaterialFactoryNew())
    tex = mel.create_material_expression(master, unreal.MaterialExpressionTextureSampleParameter2D, -700, 0)
    tex.set_editor_property("parameter_name", "BaseColorTex")
    if base_tex:
        tex.set_editor_property("texture", base_tex)
    tint = mel.create_material_expression(master, unreal.MaterialExpressionVectorParameter, -700, 250)
    tint.set_editor_property("parameter_name", "Tint")
    tint.set_editor_property("default_value", unreal.LinearColor(1, 1, 1, 1))
    mul = mel.create_material_expression(master, unreal.MaterialExpressionMultiply, -400, 100)
    mel.connect_material_expressions(tex, "RGB", mul, "A")
    mel.connect_material_expressions(tint, "", mul, "B")
    mel.connect_material_property(mul, "", unreal.MaterialProperty.MP_BASE_COLOR)
    ntex = mel.create_material_expression(master, unreal.MaterialExpressionTextureSampleParameter2D, -700, 500)
    ntex.set_editor_property("parameter_name", "NormalTex")
    if normal_tex:
        normal_tex.set_editor_property("srgb", False)
        ntex.set_editor_property("texture", normal_tex)
        ntex.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        mel.connect_material_property(ntex, "RGB", unreal.MaterialProperty.MP_NORMAL)
    mel.recompile_material(master)
    lib.save_asset(master_path)

# 2. The variant's tinted instance.
mi_path = f"{DEST}/MI_{NAME}"
mi = lib.load_asset(mi_path) if lib.does_asset_exist(mi_path) else asset_tools.create_asset(f"MI_{NAME}", DEST, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
mel.set_material_instance_parent(mi, master)
t = spec.get("tint") or [1, 1, 1]
mel.set_material_instance_vector_parameter_value(mi, "Tint", unreal.LinearColor(t[0], t[1], t[2], 1.0))
if base_tex:
    mel.set_material_instance_texture_parameter_value(mi, "BaseColorTex", base_tex)
if normal_tex:
    mel.set_material_instance_texture_parameter_value(mi, "NormalTex", normal_tex)
lib.save_asset(mi_path)

# 2b. The variant's own concept texture (its Concept 2D Art declares it).
if spec.get("concept"):
    # `ct`, not `t`: `t` is the tint, and reusing the name put an import task into the VERIFY json (W07 crash).
    ct = unreal.AssetImportTask()
    ct.filename = spec["concept"]
    ct.destination_path = DEST
    ct.destination_name = f"T_{NAME}_Concept"
    ct.automated = True
    ct.replace_existing = True
    ct.save = True
    asset_tools.import_asset_tasks([ct])
    unreal.log(f"POF_DIABLO_VARIANT_CONCEPT={DEST}/T_{NAME}_Concept")

# 3. The variant Blueprint: the family's SHARED mesh + animation, its own material, size and damage.
bp_path = f"{DEST}/BP_{NAME}"
if lib.does_asset_exist(bp_path):
    bp = lib.load_asset(bp_path)
else:
    f = unreal.BlueprintFactory()
    f.set_editor_property("parent_class", unreal.load_class(None, "/Script/PoF.ARPGEnemyCharacter"))
    bp = asset_tools.create_asset(f"BP_{NAME}", DEST, unreal.Blueprint, f)
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
cdo = unreal.get_default_object(bp.generated_class())
mesh_comp = cdo.get_editor_property("mesh")
mesh_comp.set_editor_property("skeletal_mesh_asset", src_mesh)
native = src_mesh.get_bounds().box_extent.z * 2.0
factor = (spec["heightCm"] / native) if spec.get("heightCm") and native > 0 else 1.0
mesh_comp.set_editor_property("relative_scale3d", unreal.Vector(factor, factor, factor))
half = cdo.get_editor_property("capsule_component").get_editor_property("capsule_half_height")
mesh_comp.set_editor_property("relative_location", unreal.Vector(0.0, 0.0, -half))
mesh_comp.set_editor_property("relative_rotation", unreal.Rotator(roll=0.0, pitch=0.0, yaw=-90.0))
for i in range(len(mesh_comp.get_editor_property("override_materials")) or 1):
    mesh_comp.set_material(i, mi)
if src_anims:
    mesh_comp.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    data = mesh_comp.get_editor_property("animation_data")
    data.set_editor_property("anim_to_play", src_anims[0])
    data.set_editor_property("saved_looping", True)
    data.set_editor_property("saved_playing", True)
    mesh_comp.set_editor_property("animation_data", data)
cdo.set_editor_property("bEquipSithLightsaber", False)

granted = [c for c in (unreal.load_class(None, "/Script/PoF.GA_Death"), unreal.load_class(None, "/Script/PoF.GA_HitReact")) if c]
melee_parent = unreal.load_class(None, "/Script/PoF.GA_EnemyMeleeAttack")
if melee_parent is not None:
    ga_path = f"{DEST}/GA_{NAME}_Melee"
    if lib.does_asset_exist(ga_path):
        ga_bp = lib.load_asset(ga_path)
    else:
        gf = unreal.BlueprintFactory()
        gf.set_editor_property("parent_class", melee_parent)
        ga_bp = asset_tools.create_asset(f"GA_{NAME}_Melee", DEST, unreal.Blueprint, gf)
    unreal.BlueprintEditorLibrary.compile_blueprint(ga_bp)
    ga_cdo = unreal.get_default_object(ga_bp.generated_class())
    if spec.get("meleeDamage") is not None:
        ga_cdo.set_editor_property("BaseDamage", float(spec["meleeDamage"]))
    lib.save_asset(ga_path)
    granted.append(ga_bp.generated_class())
cdo.set_editor_property("GrantedAbilities", granted)
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
lib.save_asset(bp_path)
lib.save_directory(DEST, only_if_is_dirty=False, recursive=True)

cdo_back = unreal.get_default_object(lib.load_asset(bp_path).generated_class())
mc = cdo_back.get_editor_property("mesh")
unreal.log("POF_DIABLO_VARIANT_VERIFY=" + json.dumps({
    "bp": bp_path,
    "sharedMesh": mc.get_editor_property("skeletal_mesh_asset").get_path_name(),
    "sharesWith": SOURCE,
    "material": mc.get_material(0).get_path_name() if mc.get_material(0) else None,
    "tint": t,
    "heightCm": round(native * factor, 1),
    "animation": src_anims[0].get_name() if src_anims else None,
    "abilities": [c.get_name() for c in cdo_back.get_editor_property("GrantedAbilities")],
}))
