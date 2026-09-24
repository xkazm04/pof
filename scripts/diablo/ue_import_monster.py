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


# 1. Skeletal mesh + skeleton + animation + materials.
#
# A .glb goes through Interchange in ONE task (mesh, skeleton, animation, PBR textures) — the FBX
# hop mangled units twice (W06: an animation-only import ignores `import_uniform_scale` and a
# pre-scaled FBX still posed the skeleton at 1/100, so the figure rendered 1.8 cm tall while the
# actor fought correctly). SIZE is then applied as a component scale on the Blueprint, which scales
# the mesh AND its posed animation together, instead of trying to bake a scale into the assets.
is_glb = spec["fbx"].lower().endswith(".glb")
if is_glb:
    mesh_paths = run_task(spec["fbx"], f"SK_{NAME}")
else:
    ui = unreal.FbxImportUI()
    ui.import_mesh = True
    ui.import_as_skeletal = True
    ui.import_animations = True
    ui.import_materials = True
    ui.import_textures = True
    ui.mesh_type_to_import = unreal.FBXImportType.FBXIT_SKELETAL_MESH
    ui.skeletal_mesh_import_data.set_editor_property("import_morph_targets", False)
    ui.skeletal_mesh_import_data.set_editor_property("import_meshes_in_bone_hierarchy", True)
    mesh_paths = run_task(spec["fbx"], f"SK_{NAME}", ui)
unreal.log(f"POF_DIABLO_UE_IMPORT_MESH={mesh_paths}")

sk = None
for p in list(mesh_paths) + list(lib.list_assets(DEST, recursive=True)):
    a = lib.load_asset(p)
    if isinstance(a, unreal.SkeletalMesh):
        sk = a
        break

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
    # SIZE: a component scale from the entity's declared height — scales the mesh and its posed
    # animation together (generators deliver unit-normalised meshes; the Zombie imports at 100 cm).
    native = sk.get_bounds().box_extent.z * 2.0
    factor = (spec["heightCm"] / native) if spec.get("heightCm") and native > 0 else 1.0
    mesh_comp.set_editor_property("relative_scale3d", unreal.Vector(factor, factor, factor))
    unreal.log(f"POF_DIABLO_UE_SCALE=native {native:.1f}cm -> component x{factor:.3f} = {native * factor:.1f}cm")
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
for m in [lib.load_asset(p) for p in lib.list_assets(DEST, recursive=True)]:
    if isinstance(m, unreal.Material):
        mel = unreal.MaterialEditingLibrary
        met = mel.get_material_property_input_node(m, unreal.MaterialProperty.MP_METALLIC)
        base = mel.get_material_property_input_node(m, unreal.MaterialProperty.MP_BASE_COLOR)
        unreal.log(f"POF_DIABLO_UE_MATERIAL={m.get_name()} metallic={met.get_class().get_name() if met else None} basecolor={base.get_class().get_name() if base else None}")
# Locomotion: a Diablo zombie only shambles — loop its walk as a single-node animation (no AnimBP yet).
walks = [lib.load_asset(p) for p in lib.list_assets(DEST, recursive=True)]
walks = [w for w in walks if isinstance(w, unreal.AnimSequence)]
if walks and mesh_comp is not None:
    mesh_comp.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    data = mesh_comp.get_editor_property("animation_data")
    data.set_editor_property("anim_to_play", walks[0])
    data.set_editor_property("saved_looping", True)
    data.set_editor_property("saved_playing", True)
    mesh_comp.set_editor_property("animation_data", data)
unreal.log(f"POF_DIABLO_UE_ANIM={[w.get_name() for w in walks]}")
granted = [c for c in (unreal.load_class(None, "/Script/PoF.GA_Death"), unreal.load_class(None, "/Script/PoF.GA_HitReact")) if c]
# Its attack: the AI fires Ability.Enemy.Melee — without an ability carrying that tag a monster chases and
# never hits (W06 r1: 10 s in melee range, player at 100 HP). A per-entity Blueprint subclass of
# UGA_EnemyMeleeAttack carries THIS entity's damage (from its Stat Block, passed in — never in a repo).
# The attack (melee or ranged, from the monster's AI routine) — one shared builder (scripts/diablo/ue_attack.py).
import sys as _sys
_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ue_attack import build_attack  # noqa: E402
_attack = build_attack(DEST, NAME, spec.get("attack", "melee"), spec.get("meleeDamage"))
if _attack is not None:
    granted.append(_attack)
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
sk_back = next((a for a in (lib.load_asset(p) for p in lib.list_assets(DEST, recursive=True)) if isinstance(a, unreal.SkeletalMesh)), None)
bones = len(sk_back.get_editor_property("skeleton").get_editor_property("bone_tree")) if sk_back and sk_back.get_editor_property("skeleton") else 0
cdo_back = unreal.get_default_object(lib.load_asset(bp_path).generated_class())
mesh_back = cdo_back.get_editor_property("mesh").get_editor_property("skeletal_mesh_asset")
unreal.log(f"POF_DIABLO_UE_VERIFY=" + json.dumps({
    "skeletalMesh": sk_back.get_path_name() if sk_back else None,
    "bones": bones,
    "bpMesh": mesh_back.get_path_name() if mesh_back else None,
    "bpIsEnemyCharacter": isinstance(cdo_back, unreal.ARPGEnemyCharacter),
    "grantedAbilities": [c.get_name() for c in cdo_back.get_editor_property("GrantedAbilities")],
    "skeletonOnDisk": any(f.endswith("_Skeleton.uasset") for f in on_disk),
    "nativeHeightCm": round(sk_back.get_bounds().box_extent.z * 2.0, 1) if sk_back else None,
    "meshScale": str(cdo_back.get_editor_property("mesh").get_editor_property("relative_scale3d")),
    "animations": [a for a in assets if isinstance(lib.load_asset(a), unreal.AnimSequence)],
    "materials": [a for a in assets if isinstance(lib.load_asset(a), unreal.MaterialInterface)],
    "textures": [a for a in assets if isinstance(lib.load_asset(a), unreal.Texture)],
}))
