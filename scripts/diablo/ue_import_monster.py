"""
Import one Diablo-replication monster into the UE project (/diablo W05) — UE editor, headless.

  UnrealEditor-Cmd.exe <PoF.uproject> -run=pythonscript -script=<abs path to this file> -nullrhi
  with env POF_DIABLO_MONSTER = JSON {"name": "Zombie", "fbx": "...", "concept": "...jpg", "heightCm": 180}

Lives in the PoF APP repo, not the UE repo, and writes under /Game/Diablo/ — which the UE repo
ignores: reference-game content stays local (the /diablo law "values never enter the repo").
Creates, idempotently:
  /Game/Diablo/Bestiary/<Name>/SK_<Name> (+ Skeleton, AnimSequence) from the rigged FBX
  /Game/Diablo/Bestiary/<Name>/T_<Name>_Concept                      from the accepted concept image
  /Game/Diablo/Bestiary/<Name>/BP_<Name>   child of AARPGEnemyCharacter, mesh set, death/hit-react granted
Then VERIFIES by reading back what exists (asset registry + the BP's CDO) and prints POF_DIABLO_UE_*
markers — the caller grades from those, never from this script's intent.
"""
import json
import os

import unreal

spec = json.loads(os.environ["POF_DIABLO_MONSTER"])
NAME = spec["name"]
DEST = f"/Game/Diablo/Bestiary/{NAME}"
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.EditorAssetLibrary

unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX 0")


def run_task(filename, name, options=None):
    task = unreal.AssetImportTask()
    task.filename = filename
    task.destination_path = DEST
    task.destination_name = name  # named at import: a rename after the fact collides on re-import
    task.automated = True
    task.replace_existing = True
    task.save = True
    if options is not None:
        task.options = options
    asset_tools.import_asset_tasks([task])
    return list(task.imported_object_paths)


# 1. Skeletal mesh (+ skeleton + animation) from the rigged, budgeted FBX.
ui = unreal.FbxImportUI()
ui.import_mesh = True
ui.import_as_skeletal = True
ui.import_animations = True
ui.import_materials = True
ui.import_textures = True
ui.mesh_type_to_import = unreal.FBXImportType.FBX_IT_SKELETAL_MESH if hasattr(unreal.FBXImportType, "FBX_IT_SKELETAL_MESH") else unreal.FBXImportType.FBXIT_SKELETAL_MESH
ui.skeletal_mesh_import_data.set_editor_property("import_morph_targets", False)
ui.skeletal_mesh_import_data.set_editor_property("import_meshes_in_bone_hierarchy", True)
mesh_paths = run_task(spec["fbx"], f"SK_{NAME}", ui)
unreal.log(f"POF_DIABLO_UE_IMPORT_MESH={mesh_paths}")

# WORLD SCALE from the entity's declared size (registry: generated-asset-world-scale). Generators
# deliver unit-normalised meshes; the Zombie arrived 100 cm tall (W05) — a "human-sized" monster at
# knee height. Measure the imported height, then re-import once at heightCm / measured.
if spec.get("heightCm"):
    sk_now = lib.load_asset(f"{DEST}/SK_{NAME}")
    measured = sk_now.get_bounds().box_extent.z * 2.0 if sk_now else 0.0
    if measured > 0 and abs(measured - spec["heightCm"]) / spec["heightCm"] > 0.05:
        scale = spec["heightCm"] / measured
        ui.skeletal_mesh_import_data.set_editor_property("import_uniform_scale", scale)
        run_task(spec["fbx"], f"SK_{NAME}", ui)
        after = lib.load_asset(f"{DEST}/SK_{NAME}").get_bounds().box_extent.z * 2.0
        unreal.log(f"POF_DIABLO_UE_SCALE=measured {measured:.1f}cm -> x{scale:.3f} -> {after:.1f}cm (declared {spec['heightCm']}cm)")
    else:
        unreal.log(f"POF_DIABLO_UE_SCALE=measured {measured:.1f}cm matches declared {spec['heightCm']}cm")

sk = None
for p in mesh_paths:
    a = lib.load_asset(p)
    if isinstance(a, unreal.SkeletalMesh):
        sk = a
if sk is None:
    # A re-import may report nothing new; find the mesh on disk.
    for p in lib.list_assets(DEST, recursive=False):
        a = lib.load_asset(p)
        if isinstance(a, unreal.SkeletalMesh):
            sk = a

# 2. Concept texture.
if spec.get("concept"):
    tex_paths = run_task(spec["concept"], f"T_{NAME}_Concept")
    unreal.log(f"POF_DIABLO_UE_IMPORT_TEXTURE={tex_paths}")

# 3. BP_<Name>: child of AARPGEnemyCharacter with the mesh on the inherited Mesh component.
bp_path = f"{DEST}/BP_{NAME}"
if lib.does_asset_exist(bp_path):
    bp = lib.load_asset(bp_path)
else:
    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", unreal.load_class(None, "/Script/PoF.ARPGEnemyCharacter"))
    bp = asset_tools.create_asset(f"BP_{NAME}", DEST, unreal.Blueprint, factory)
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
cdo = unreal.get_default_object(bp.generated_class())
mesh_comp = cdo.get_editor_property("mesh")
if sk is not None and mesh_comp is not None:
    mesh_comp.set_editor_property("skeletal_mesh_asset", sk)
    # Capsule-centred character: feet to the capsule bottom, facing +X.
    half = cdo.get_editor_property("capsule_component").get_editor_property("capsule_half_height")
    mesh_comp.set_editor_property("relative_location", unreal.Vector(0.0, 0.0, -half))
    # unreal.Rotator is (roll, pitch, yaw): a positional (0, -90, 0) PITCHED the Zombie face-down (W05 r4).
    mesh_comp.set_editor_property("relative_rotation", unreal.Rotator(roll=0.0, pitch=0.0, yaw=-90.0))
# AARPGEnemyCharacter's C++ constructor hard-codes a red "Sith lightsaber" on WeaponMesh for EVERY enemy
# (the Star Wars duel build). A Diablo zombie carries no weapon — clear it on this Blueprint only.
try:
    weapon = cdo.get_editor_property("WeaponMesh")
except Exception:
    weapon = None
if weapon is not None:
    weapon.set_editor_property("static_mesh", None)
    weapon.set_editor_property("visible", False)
# ...but the base class RE-EQUIPS the saber at BeginPlay unless told not to (bEquipSithLightsaber, W05).
cdo.set_editor_property("bEquipSithLightsaber", False)
unreal.log(f"POF_DIABLO_UE_WEAPON={'cleared' if weapon is not None else 'NOT REACHABLE from Python'}; sith saber off")
# Material probe: what drives Metallic / BaseColor on the imported material (a metallic surface renders
# black in an isolated capture that has no sky reflections).
for m in [lib.load_asset(p) for p in lib.list_assets(DEST, recursive=False)]:
    if isinstance(m, unreal.Material):
        mel = unreal.MaterialEditingLibrary
        met = mel.get_material_property_input_node(m, unreal.MaterialProperty.MP_METALLIC)
        base = mel.get_material_property_input_node(m, unreal.MaterialProperty.MP_BASE_COLOR)
        unreal.log(f"POF_DIABLO_UE_MATERIAL={m.get_name()} metallic={met.get_class().get_name() if met else None} basecolor={base.get_class().get_name() if base else None}")
granted = [c for c in (unreal.load_class(None, "/Script/PoF.GA_Death"), unreal.load_class(None, "/Script/PoF.GA_HitReact")) if c]
cdo.set_editor_property("GrantedAbilities", granted)
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
lib.save_asset(bp_path)

# Save EVERYTHING the imports created — `task.save` saves only each task's primary object, so the
# Skeleton / materials / textures / animation were created in memory and lost (W05 first run).
lib.save_directory(DEST, only_if_is_dirty=False, recursive=True)

# 4. Verify by READING BACK — from DISK, not the in-memory registry (which listed a Skeleton that
# was never written).
content_dir = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir())
on_disk = []
for root, _dirs, files in os.walk(os.path.join(content_dir, DEST.replace("/Game/", "")) ):
    on_disk += sorted(f for f in files if f.endswith(".uasset"))
unreal.log(f"POF_DIABLO_UE_ON_DISK={json.dumps(on_disk)}")
assets = sorted(lib.list_assets(DEST, recursive=True))
unreal.log(f"POF_DIABLO_UE_ASSETS={json.dumps(assets)}")
sk_back = lib.load_asset(f"{DEST}/SK_{NAME}") if lib.does_asset_exist(f"{DEST}/SK_{NAME}") else None
bones = len(sk_back.get_editor_property("skeleton").get_editor_property("bone_tree")) if sk_back and sk_back.get_editor_property("skeleton") else 0
cdo_back = unreal.get_default_object(lib.load_asset(bp_path).generated_class())
mesh_back = cdo_back.get_editor_property("mesh").get_editor_property("skeletal_mesh_asset")
unreal.log(f"POF_DIABLO_UE_VERIFY=" + json.dumps({
    "skeletalMesh": sk_back.get_path_name() if sk_back else None,
    "bones": bones,
    "bpMesh": mesh_back.get_path_name() if mesh_back else None,
    "bpIsEnemyCharacter": isinstance(cdo_back, unreal.ARPGEnemyCharacter),
    "grantedAbilities": [c.get_name() for c in cdo_back.get_editor_property("GrantedAbilities")],
    "skeletonOnDisk": f"SK_{NAME}_Skeleton.uasset" in on_disk,
    "heightCm": round(sk_back.get_bounds().box_extent.z * 2.0, 1) if sk_back else None,
    "animations": [a for a in assets if isinstance(lib.load_asset(a), unreal.AnimSequence)],
    "materials": [a for a in assets if isinstance(lib.load_asset(a), unreal.MaterialInterface)],
    "textures": [a for a in assets if isinstance(lib.load_asset(a), unreal.Texture)],
}))
