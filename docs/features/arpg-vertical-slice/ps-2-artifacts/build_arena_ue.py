"""
build_arena_ue.py
=================
Imports the Blender-authored combat arena into the PoF UE5 project and rebuilds
the vertical-slice level around its existing gameplay actors.

What it does (each section is idempotent and wrapped in try/except):
  1. Import Content/ArenaBuild/Arena.fbx -> /Game/ArenaBuild/SM_Arena
     (x100 uniform scale: Blender metres -> UE centimetres, combine meshes,
     generate collision; force complex-as-simple so the player can stand on it).
  2. Import the 9 JPG textures -> /Game/ArenaBuild/Textures/ (*_normal as
     TC_NORMALMAP).
  3. Build /Game/ArenaBuild/M_Arena_{Floor,Wall,Pillar} materials wiring
     albedo -> Base Color, normal -> Normal, rough -> Roughness.
  4. Assign those materials to SM_Arena's slots by slot name
     (M_Floor / M_Wall / M_Pillar).
  5. Rebuild /Game/Maps/VerticalSlice: delete the gray-box cube floor, spawn an
     SM_Arena StaticMeshActor at the origin, keep PlayerStart / BP_VSEnemy /
     AVSFunctionalTest / DirectionalLight / SkyLight, reposition PlayerStart and
     the enemy onto the arena floor.
  6. Force the DirectionalLight + SkyLight to Movable mobility so the STATIC
     arena mesh is lit dynamically -- no Lightmass bake is run in this headless
     pipeline, and STATIONARY lights leave un-baked static geometry pitch black.

Run headless:
    "C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe" ^
        "C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject" ^
        -run=pythonscript -script="<abs path to this file>" -unattended -nopause
"""

import os
import unreal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_DIR = unreal.Paths.project_dir()
ARENA_BUILD_DIR = os.path.normpath(os.path.join(PROJECT_DIR, "Content", "ArenaBuild"))
FBX_PATH = os.path.join(ARENA_BUILD_DIR, "Arena.fbx")
TEXTURES_DIR = os.path.join(ARENA_BUILD_DIR, "textures")

# UE content paths
SM_ARENA_PATH = "/Game/ArenaBuild/SM_Arena"
TEXTURES_FOLDER = "/Game/ArenaBuild/Textures"
ARENA_BUILD_FOLDER = "/Game/ArenaBuild"
LEVEL_PATH = "/Game/Maps/VerticalSlice"

# Material slot name (from Blender) -> material asset path
MATERIAL_FOR_SLOT = {
    "M_Floor": "/Game/ArenaBuild/M_Arena_Floor",
    "M_Wall": "/Game/ArenaBuild/M_Arena_Wall",
    "M_Pillar": "/Game/ArenaBuild/M_Arena_Pillar",
}

# Texture surface key (file prefix) -> material asset path
SURFACE_TO_MATERIAL = {
    "floor": "/Game/ArenaBuild/M_Arena_Floor",
    "wall": "/Game/ArenaBuild/M_Arena_Wall",
    "pillar": "/Game/ArenaBuild/M_Arena_Pillar",
}

CUBE_MESH_PATH = "/Engine/BasicShapes/Cube"

# FBX import uniform scale. Blender's FBX exporter already converts the
# metres-authored geometry to centimetres (FBX native unit), so UE imports it
# 1:1 -- the 20 m arena lands at 2000 uu. Setting this to 100 produces a mesh
# 100x too large (verified by box-extent diagnostics on an earlier run).
ARENA_IMPORT_SCALE = 1.0

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_lib = unreal.EditorAssetLibrary
mat_lib = unreal.MaterialEditingLibrary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(msg):
    unreal.log("[build_arena_ue] " + msg)


def split_path(package_path):
    """'/Game/Foo/Bar' -> ('/Game/Foo', 'Bar')"""
    idx = package_path.rfind("/")
    return package_path[:idx], package_path[idx + 1:]


def load_object(object_path):
    if not asset_lib.does_asset_exist(object_path):
        return None
    return asset_lib.load_asset(object_path)


# ---------------------------------------------------------------------------
# Section 1: Import Arena.fbx as a Static Mesh
# ---------------------------------------------------------------------------

def import_arena_mesh():
    try:
        if not os.path.isfile(FBX_PATH):
            raise RuntimeError("Arena.fbx not found at " + FBX_PATH)

        folder, name = split_path(SM_ARENA_PATH)

        # FBX import options: static mesh, x100 scale, combine, gen collision.
        fbx_ui = unreal.FbxImportUI()
        fbx_ui.set_editor_property("import_mesh", True)
        fbx_ui.set_editor_property("import_as_skeletal", False)
        fbx_ui.set_editor_property("import_animations", False)
        fbx_ui.set_editor_property("import_materials", False)
        fbx_ui.set_editor_property("import_textures", False)
        fbx_ui.set_editor_property("create_physics_asset", False)
        fbx_ui.set_editor_property("mesh_type_to_import",
                                   unreal.FBXImportType.FBXIT_STATIC_MESH)

        sm_data = fbx_ui.get_editor_property("static_mesh_import_data")
        # Scale: Blender's FBX exporter (apply_unit_scale=True, global_scale=1)
        # bakes the metres-authored geometry into the FBX in centimetres -- the
        # FBX native unit. UE then imports it 1:1, so a 20 m arena lands as
        # 2000 uu with import_uniform_scale = 1.0. (An earlier run used 100.0
        # and produced a 100x-oversized mesh -- see ARENA_IMPORT_SCALE below.)
        sm_data.set_editor_property("import_uniform_scale", ARENA_IMPORT_SCALE)
        sm_data.set_editor_property("combine_meshes", True)
        sm_data.set_editor_property("auto_generate_collision", True)
        sm_data.set_editor_property("generate_lightmap_u_vs", True)
        sm_data.set_editor_property("convert_scene", True)

        task = unreal.AssetImportTask()
        task.set_editor_property("filename", FBX_PATH)
        task.set_editor_property("destination_path", folder)
        task.set_editor_property("destination_name", name)
        task.set_editor_property("replace_existing", True)
        task.set_editor_property("automated", True)
        task.set_editor_property("save", True)
        task.set_editor_property("options", fbx_ui)

        asset_tools.import_asset_tasks([task])

        mesh = load_object(SM_ARENA_PATH)
        if mesh is None:
            # The importer may have used the FBX-internal mesh name.
            imported = list(task.get_editor_property("imported_object_paths") or [])
            raise RuntimeError("SM_Arena not found after import; imported=%s"
                               % imported)
        if not isinstance(mesh, unreal.StaticMesh):
            raise RuntimeError("Imported asset is not a StaticMesh: "
                               + type(mesh).__name__)

        # Collision: a static, non-moving floor can safely use the rendering
        # geometry as collision. This guarantees the player can stand on the
        # floor / be blocked by walls even if auto simple-collision is empty
        # for the combined mesh.
        body_setup = mesh.get_editor_property("body_setup")
        if body_setup is not None:
            body_setup.set_editor_property(
                "collision_trace_flag",
                unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
            _log("Set collision_trace_flag = CTF_USE_COMPLEX_AS_SIMPLE")
        else:
            unreal.log_warning("[build_arena_ue] SM_Arena has no body_setup")

        asset_lib.save_asset(SM_ARENA_PATH)

        # Diagnostics: bounds confirm the x100 scale landed (expect a ~2000uu
        # / 20m square footprint), and the slot names drive section 4.
        bounds = mesh.get_bounds()
        box_extent = bounds.box_extent
        _log("SM_Arena box extent (uu): %.1f, %.1f, %.1f"
             % (box_extent.x, box_extent.y, box_extent.z))
        static_materials = mesh.get_editor_property("static_materials")
        slot_names = [str(static_materials[i].get_editor_property(
            "material_slot_name")) for i in range(len(static_materials))]
        _log("SM_Arena material slots: " + ", ".join(slot_names))
        _log("Imported static mesh: " + SM_ARENA_PATH)
        return mesh
    except Exception as exc:
        unreal.log_error("[build_arena_ue] import_arena_mesh FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Section 2: Import the textures
# ---------------------------------------------------------------------------

def import_textures():
    try:
        if not os.path.isdir(TEXTURES_DIR):
            raise RuntimeError("textures dir not found: " + TEXTURES_DIR)

        files = sorted(f for f in os.listdir(TEXTURES_DIR)
                       if f.lower().endswith(".jpg"))
        if not files:
            raise RuntimeError("no JPG textures found in " + TEXTURES_DIR)

        # texture key (e.g. 'floor_albedo') -> imported Texture2D asset
        imported = {}
        tasks = []
        keys = []
        for fname in files:
            key = os.path.splitext(fname)[0]  # 'floor_albedo'
            keys.append(key)
            task = unreal.AssetImportTask()
            task.set_editor_property("filename", os.path.join(TEXTURES_DIR, fname))
            task.set_editor_property("destination_path", TEXTURES_FOLDER)
            task.set_editor_property("destination_name", "T_" + key)
            task.set_editor_property("replace_existing", True)
            task.set_editor_property("automated", True)
            task.set_editor_property("save", True)
            tasks.append(task)

        asset_tools.import_asset_tasks(tasks)

        for key in keys:
            asset_path = "%s/T_%s" % (TEXTURES_FOLDER, key)
            tex = load_object(asset_path)
            if tex is None:
                raise RuntimeError("texture not found after import: " + asset_path)
            # Mark normal maps so UE decompresses them correctly.
            if key.endswith("_normal"):
                tex.set_editor_property("compression_settings",
                                        unreal.TextureCompressionSettings.TC_NORMALMAP)
                tex.set_editor_property("srgb", False)
            elif key.endswith("_rough"):
                # Roughness is linear (non-color) data.
                tex.set_editor_property("srgb", False)
            asset_lib.save_asset(asset_path)
            imported[key] = tex
            _log("Imported texture: " + asset_path)

        return imported
    except Exception as exc:
        unreal.log_error("[build_arena_ue] import_textures FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Section 3: Build the three materials
# ---------------------------------------------------------------------------

def build_material(material_path, surface, textures):
    """Build/overwrite one material from the given surface's textures."""
    folder, name = split_path(material_path)

    if asset_lib.does_asset_exist(material_path):
        # Idempotent re-run: delete and rebuild so the graph is clean.
        asset_lib.delete_asset(material_path)

    factory = unreal.MaterialFactoryNew()
    material = asset_tools.create_asset(name, folder, unreal.Material, factory)
    if material is None:
        raise RuntimeError("failed to create material " + material_path)

    albedo = textures.get(surface + "_albedo")
    normal = textures.get(surface + "_normal")
    rough = textures.get(surface + "_rough")

    if albedo is not None:
        node = mat_lib.create_material_expression(
            material, unreal.MaterialExpressionTextureSample, -400, -200)
        node.set_editor_property("texture", albedo)
        mat_lib.connect_material_property(
            node, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)

    if normal is not None:
        node = mat_lib.create_material_expression(
            material, unreal.MaterialExpressionTextureSample, -400, 50)
        node.set_editor_property("texture", normal)
        # TextureSample sampler type must match a normal-map texture.
        node.set_editor_property("sampler_type",
                                 unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        mat_lib.connect_material_property(
            node, "RGB", unreal.MaterialProperty.MP_NORMAL)

    if rough is not None:
        node = mat_lib.create_material_expression(
            material, unreal.MaterialExpressionTextureSample, -400, 300)
        node.set_editor_property("texture", rough)
        node.set_editor_property("sampler_type",
                                 unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_GRAYSCALE)
        mat_lib.connect_material_property(
            node, "R", unreal.MaterialProperty.MP_ROUGHNESS)

    mat_lib.recompile_material(material)
    asset_lib.save_asset(material_path)
    _log("Built material: " + material_path)
    return material


def build_materials(textures):
    try:
        materials = {}
        for surface, mat_path in SURFACE_TO_MATERIAL.items():
            materials[mat_path] = build_material(mat_path, surface, textures)
        return materials
    except Exception as exc:
        unreal.log_error("[build_arena_ue] build_materials FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Section 4: Assign materials to SM_Arena slots by slot name
# ---------------------------------------------------------------------------

def assign_materials(mesh):
    try:
        static_materials = mesh.get_editor_property("static_materials")
        slot_names = []
        for idx in range(len(static_materials)):
            entry = static_materials[idx]
            slot_name = str(entry.get_editor_property("material_slot_name"))
            slot_names.append(slot_name)
            mat_path = MATERIAL_FOR_SLOT.get(slot_name)
            if mat_path is None:
                unreal.log_warning(
                    "[build_arena_ue] no material mapped for slot '%s'" % slot_name)
                continue
            material = load_object(mat_path)
            if material is None:
                raise RuntimeError("material asset missing: " + mat_path)
            mesh.set_material(idx, material)
            _log("Assigned %s -> slot[%d] '%s'" % (mat_path, idx, slot_name))

        asset_lib.save_asset(SM_ARENA_PATH)
        _log("SM_Arena slot names: " + ", ".join(slot_names))
    except Exception as exc:
        unreal.log_error("[build_arena_ue] assign_materials FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Section 5: Rebuild the VerticalSlice level
# ---------------------------------------------------------------------------

def rebuild_level():
    try:
        if not asset_lib.does_asset_exist(LEVEL_PATH):
            raise RuntimeError("level does not exist: " + LEVEL_PATH)

        level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
        actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

        if not level_subsystem.load_level(LEVEL_PATH):
            raise RuntimeError("failed to load level " + LEVEL_PATH)
        _log("Loaded level: " + LEVEL_PATH)

        cube_mesh = load_object(CUBE_MESH_PATH)
        if cube_mesh is None:
            raise RuntimeError("could not load " + CUBE_MESH_PATH)
        arena_mesh = load_object(SM_ARENA_PATH)
        if arena_mesh is None:
            raise RuntimeError("SM_Arena missing; cannot rebuild level")

        initial_actors = actor_subsystem.get_all_level_actors()

        # --- Identify and delete the gray-box cube floor ---------------------
        # It is an AStaticMeshActor whose mesh is /Engine/BasicShapes/Cube and
        # whose scale is large (the PS-1 floor was scaled ~40x40x1). The arena
        # SM_Arena actor we spawn this run is NOT a basic cube so it is safe.
        deleted_floor = 0
        for actor in initial_actors:
            if not isinstance(actor, unreal.StaticMeshActor):
                continue
            smc = actor.static_mesh_component
            if smc is None:
                continue
            sm = smc.get_editor_property("static_mesh")
            if sm is None:
                continue
            if sm.get_path_name() != cube_mesh.get_path_name():
                continue
            scale = actor.get_actor_scale3d()
            is_large = max(scale.x, scale.y) >= 5.0
            if is_large:
                _log("Deleting gray-box floor actor '%s' (scale %.1f,%.1f,%.1f)"
                     % (actor.get_actor_label(), scale.x, scale.y, scale.z))
                actor_subsystem.destroy_actor(actor)
                deleted_floor += 1
        if deleted_floor == 0:
            unreal.log_warning(
                "[build_arena_ue] no gray-box cube floor found to delete")

        # --- Remove any previously-spawned arena actor (idempotent) ----------
        for actor in actor_subsystem.get_all_level_actors():
            if not isinstance(actor, unreal.StaticMeshActor):
                continue
            smc = actor.static_mesh_component
            if smc is None:
                continue
            sm = smc.get_editor_property("static_mesh")
            if sm is not None and sm.get_path_name() == arena_mesh.get_path_name():
                _log("Removing prior arena actor for clean re-spawn")
                actor_subsystem.destroy_actor(actor)

        # --- Spawn the arena at the origin -----------------------------------
        arena_actor = actor_subsystem.spawn_actor_from_object(
            arena_mesh, unreal.Vector(0.0, 0.0, 0.0))
        arena_actor.set_actor_label("Arena")
        arena_actor.set_actor_scale3d(unreal.Vector(1.0, 1.0, 1.0))
        arena_smc = arena_actor.static_mesh_component
        if arena_smc is not None:
            arena_smc.set_collision_enabled(
                unreal.CollisionEnabled.QUERY_AND_PHYSICS)
            arena_smc.set_mobility(unreal.ComponentMobility.STATIC)
        _log("Spawned Arena actor at origin")

        # --- Reposition the kept gameplay actors -----------------------------
        # Floor top is at z~0 after the x100 import scale. Lift the capsule
        # actors so they sit on (not in) the floor.
        kept = {"PlayerStart": False, "Enemy": False, "FunctionalTest": False,
                "DirectionalLight": False, "SkyLight": False}
        for actor in actor_subsystem.get_all_level_actors():
            cls_name = actor.get_class().get_name()
            if isinstance(actor, unreal.PlayerStart):
                actor.set_actor_location(
                    unreal.Vector(-300.0, 0.0, 120.0), False, False)
                kept["PlayerStart"] = True
                _log("Moved PlayerStart to (-300, 0, 120)")
            elif isinstance(actor, unreal.DirectionalLight):
                kept["DirectionalLight"] = True
            elif isinstance(actor, unreal.SkyLight):
                kept["SkyLight"] = True
            elif "VSEnemy" in cls_name or "VSEnemy" in actor.get_actor_label():
                actor.set_actor_location(
                    unreal.Vector(300.0, 0.0, 120.0), False, False)
                kept["Enemy"] = True
                _log("Moved BP_VSEnemy to (300, 0, 120)")
            elif "FunctionalTest" in cls_name or "VSFunctionalTest" in cls_name:
                kept["FunctionalTest"] = True

        for label, found in kept.items():
            if not found:
                unreal.log_warning(
                    "[build_arena_ue] expected actor not found: " + label)

        # --- Force lights Movable so the STATIC arena is lit without a bake --
        # The arena StaticMesh is STATIC mobility and this pipeline never runs
        # Lightmass. With STATIONARY/STATIC lights the un-baked arena renders
        # pitch black (UE shows "LIGHTING NEEDS TO BE REBUILT"). Movable lights
        # light it fully dynamically -- no build step required.
        #
        # The DirectionalLight is also angled down (pitch -50 deg) and given a
        # healthy intensity: at its default rotation (0,0,0) it points straight
        # along +X, grazing the floor at ~0 deg so the floor reads near-black.
        # The SkyLight intensity is raised so walls/floor in shadow still read.
        for actor in actor_subsystem.get_all_level_actors():
            if isinstance(actor, unreal.DirectionalLight):
                actor.set_actor_rotation(
                    unreal.Rotator(0.0, -50.0, -35.0), False)
                for comp in actor.get_components_by_class(
                        unreal.DirectionalLightComponent):
                    comp.set_mobility(unreal.ComponentMobility.MOVABLE)
                    comp.set_editor_property("intensity", 6.0)
                _log("DirectionalLight -> Movable, pitch -50, intensity 6.0")
            elif isinstance(actor, unreal.SkyLight):
                for comp in actor.get_components_by_class(
                        unreal.SkyLightComponent):
                    comp.set_mobility(unreal.ComponentMobility.MOVABLE)
                    comp.set_editor_property("intensity", 3.0)
                    try:
                        comp.set_editor_property("real_time_capture", True)
                    except Exception:
                        pass
                _log("SkyLight -> Movable, intensity 3.0, real-time capture")

        level_subsystem.save_current_level()
        _log("Saved level: " + LEVEL_PATH)
    except Exception as exc:
        unreal.log_error("[build_arena_ue] rebuild_level FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    _log("=== Arena import + level rebuild START ===")
    mesh = import_arena_mesh()
    textures = import_textures()
    build_materials(textures)
    assign_materials(mesh)
    rebuild_level()
    _log("=== Arena import + level rebuild COMPLETE ===")


if __name__ == "__main__":
    main()
