"""
build_vertical_slice.py
=======================
Authors a playable gray-box "vertical slice" for the PoF UE5 project:
an Input Mapping Context, five Blueprints, a level, and project config.

UE Python authors *assets and CDO properties* - not Blueprint event graphs.

Run headless:
    "C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe" ^
        "C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject" ^
        -run=pythonscript -script="<abs path to this file>" -unattended -nopause

The script is idempotent: re-running overwrites/reuses already-created assets.
Each section is wrapped in try/except that logs unreal.log_error and re-raises
so a failure is visible in the headless run.
"""

import unreal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Existing assets (ground-truthed)
IA_MOVE_PATH = "/Game/Input/Actions/IA_Move"
IA_ATTACK_PATH = "/Game/Input/Actions/IA_Attack"
AM_MELEE_COMBO_PATH = "/Game/Characters/Player/Animations/Montages/AM_MeleeCombo"

# Engine basic shapes
CYLINDER_MESH = "/Engine/BasicShapes/Cylinder"
CUBE_MESH = "/Engine/BasicShapes/Cube"

# Assets we author
IMC_PATH = "/Game/Input/IMC_VerticalSlice"
BP_GA_MELEE_PATH = "/Game/Abilities/BP_GA_MeleeAttack"
BP_VSPLAYER_PATH = "/Game/VerticalSlice/BP_VSPlayer"
BP_VSPLAYERCTRL_PATH = "/Game/VerticalSlice/BP_VSPlayerController"
BP_VSENEMY_PATH = "/Game/VerticalSlice/BP_VSEnemy"
BP_VSGAMEMODE_PATH = "/Game/VerticalSlice/BP_VSGameMode"
LEVEL_PATH = "/Game/Maps/VerticalSlice"

# C++ parent classes (loaded by /Script path)
CLS_GA_MELEE = "/Script/PoF.GA_MeleeAttack"
CLS_PLAYER = "/Script/PoF.ARPGPlayerCharacter"
CLS_PLAYERCTRL = "/Script/PoF.ARPGPlayerController"
CLS_ENEMY = "/Script/PoF.ARPGEnemyCharacter"
CLS_GAMEMODE = "/Script/PoF.ARPGGameMode"
CLS_GE_DAMAGE = "/Script/PoF.GE_Damage"
CLS_GA_DEATH = "/Script/PoF.GA_Death"
CLS_GA_HITREACT = "/Script/PoF.GA_HitReact"
CLS_VS_FUNC_TEST = "/Script/PoF.VSFunctionalTest"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_lib = unreal.EditorAssetLibrary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(msg):
    unreal.log("[build_vertical_slice] " + msg)


def load_class(class_path):
    """Load a UClass by /Script or /Game path. Returns None if unavailable."""
    cls = unreal.load_class(None, class_path)
    if cls is None:
        # Blueprint generated classes: append _C
        cls = unreal.load_class(None, class_path + "_C")
    return cls


def load_object(object_path):
    """Load a UObject asset. Returns None if it does not exist."""
    if not asset_lib.does_asset_exist(object_path):
        return None
    return asset_lib.load_asset(object_path)


def split_path(package_path):
    """'/Game/Foo/Bar' -> ('/Game/Foo', 'Bar')"""
    idx = package_path.rfind("/")
    return package_path[:idx], package_path[idx + 1:]


def create_blueprint(package_path, parent_class):
    """Create (or load existing) a Blueprint asset with the given parent class."""
    if asset_lib.does_asset_exist(package_path):
        _log("Blueprint already exists, reusing: " + package_path)
        return asset_lib.load_asset(package_path)

    folder, name = split_path(package_path)
    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", parent_class)
    bp = asset_tools.create_asset(name, folder, unreal.Blueprint, factory)
    if bp is None:
        raise RuntimeError("Failed to create Blueprint: " + package_path)
    _log("Created Blueprint: " + package_path)
    return bp


def get_cdo(bp):
    """Return the class-default-object for a Blueprint's generated class."""
    gen_cls = bp.generated_class()
    if gen_cls is None:
        raise RuntimeError("Blueprint has no generated class (compile failed?)")
    return unreal.get_default_object(gen_cls)


def save(package_path):
    asset_lib.save_asset(package_path)
    _log("Saved: " + package_path)


# ---------------------------------------------------------------------------
# Step 1: Input Mapping Context
# ---------------------------------------------------------------------------

def build_imc():
    try:
        ia_move = load_object(IA_MOVE_PATH)
        ia_attack = load_object(IA_ATTACK_PATH)
        if ia_move is None or ia_attack is None:
            raise RuntimeError("Required Input Action assets missing")

        if asset_lib.does_asset_exist(IMC_PATH):
            imc = asset_lib.load_asset(IMC_PATH)
        else:
            folder, name = split_path(IMC_PATH)
            factory = unreal.InputMappingContext_Factory()
            imc = asset_tools.create_asset(name, folder, unreal.InputMappingContext, factory)
            if imc is None:
                raise RuntimeError("Failed to create IMC asset")
            _log("Created IMC: " + IMC_PATH)

        # NOTE: In the UE 5.7 Python binding, InputMappingContext.map_key()
        # returns a *by-value copy* of the mapping struct and does not append
        # it to the asset, so editing that return value is lost. The reliable
        # path is to build EnhancedActionKeyMapping structs ourselves and
        # assign them through the `default_key_mappings` struct (the modern,
        # non-deprecated replacement for the flat `mappings` array).

        # FKey values are constructed by name (the same names used by the
        # editor / ini: "W", "A", "S", "D", "LeftMouseButton"). unreal.Key is
        # a struct; the key name lives in the 'key_name' property.
        def make_key(name):
            k = unreal.Key()
            k.set_editor_property("key_name", unreal.Name(name))
            return k

        def make_mapping(action, key, swizzle_order=None, negate=False):
            mods = []
            if swizzle_order is not None:
                sw = unreal.InputModifierSwizzleAxis()
                sw.set_editor_property("order", swizzle_order)
                mods.append(sw)
            if negate:
                mods.append(unreal.InputModifierNegate())
            m = unreal.EnhancedActionKeyMapping()
            m.set_editor_property("action", action)
            m.set_editor_property("key", key)
            if mods:
                m.set_editor_property("modifiers", mods)
            return m

        # --- IA_Move: WASD on a 2D axis ---
        # IA_Move is Axis2D. A 1D key produces its value on X by default.
        #   W = +Y  -> swizzle YXZ (X->Y)
        #   S = -Y  -> swizzle YXZ + negate
        #   D = +X  -> no modifier
        #   A = -X  -> negate
        mappings = [
            make_mapping(ia_move, make_key("W"), unreal.InputAxisSwizzle.YXZ),
            make_mapping(ia_move, make_key("S"), unreal.InputAxisSwizzle.YXZ, negate=True),
            make_mapping(ia_move, make_key("D")),
            make_mapping(ia_move, make_key("A"), negate=True),
            # --- IA_Attack: left mouse button ---
            make_mapping(ia_attack, make_key("LeftMouseButton")),
        ]
        dkm = imc.get_editor_property("default_key_mappings")
        dkm.set_editor_property("mappings", mappings)
        imc.set_editor_property("default_key_mappings", dkm)

        save(IMC_PATH)
        return imc
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] build_imc FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Step 2: BP_GA_MeleeAttack
# ---------------------------------------------------------------------------

def build_ga_melee():
    try:
        parent = load_class(CLS_GA_MELEE)
        if parent is None:
            raise RuntimeError("Could not load parent class " + CLS_GA_MELEE)

        bp = create_blueprint(BP_GA_MELEE_PATH, parent)
        cdo = get_cdo(bp)

        montage = load_object(AM_MELEE_COMBO_PATH)
        if montage is None:
            raise RuntimeError("Melee combo montage missing: " + AM_MELEE_COMBO_PATH)
        cdo.set_editor_property("AttackMontage", montage)
        cdo.set_editor_property("ComboSectionNames", [unreal.Name("Combo1")])

        ge_damage = load_class(CLS_GE_DAMAGE)
        if ge_damage is None:
            raise RuntimeError("Could not load damage GE class " + CLS_GE_DAMAGE)
        cdo.set_editor_property("DamageEffect", ge_damage)

        save(BP_GA_MELEE_PATH)
        return bp
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] build_ga_melee FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Component helper: add a visible static-mesh body to a character CDO
# ---------------------------------------------------------------------------

def add_static_mesh_body(bp, mesh_path, component_name):
    """
    Add a StaticMeshComponent (with the given mesh) to a Blueprint's CDO via
    the SubobjectDataSubsystem, attached under the root. Idempotent: skips if
    a component with that name already exists.
    Returns True on success, False if the body could not be added.
    """
    try:
        mesh = load_object(mesh_path)
        if mesh is None:
            unreal.log_warning("[build_vertical_slice] mesh missing: " + mesh_path)
            return False

        subsystem = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
        if subsystem is None:
            unreal.log_warning("[build_vertical_slice] SubobjectDataSubsystem unavailable")
            return False

        handles = subsystem.k2_gather_subobject_data_for_blueprint(bp)
        if not handles:
            unreal.log_warning("[build_vertical_slice] no subobject data for " + bp.get_name())
            return False

        # Already present?
        for h in handles:
            data = subsystem.k2_find_subobject_data_from_handle(h)
            obj = unreal.SubobjectDataBlueprintFunctionLibrary.get_associated_object(data)
            if obj is not None and obj.get_name().startswith(component_name):
                _log("Body component already present on " + bp.get_name())
                return True

        root_handle = handles[0]  # first handle is the root

        sub_params = unreal.AddNewSubobjectParams()
        sub_params.set_editor_property("parent_handle", root_handle)
        sub_params.set_editor_property("new_class", unreal.StaticMeshComponent)
        sub_params.set_editor_property("blueprint_context", bp)

        new_handle, fail_reason = subsystem.add_new_subobject(sub_params)
        if not fail_reason.is_empty():
            unreal.log_warning("[build_vertical_slice] add_new_subobject failed: "
                               + str(fail_reason))
            return False

        subsystem.rename_subobject(new_handle, unreal.Text(component_name))

        new_data = subsystem.k2_find_subobject_data_from_handle(new_handle)
        smc = unreal.SubobjectDataBlueprintFunctionLibrary.get_associated_object(new_data)
        if smc is None:
            unreal.log_warning("[build_vertical_slice] could not resolve new component object")
            return False

        smc.set_editor_property("static_mesh", mesh)
        # Cylinder/Cube basic shapes are 100uu; a character capsule is ~88uu
        # tall radius 34. Drop the mesh so it visually wraps the capsule.
        smc.set_editor_property("relative_location", unreal.Vector(0.0, 0.0, -90.0))
        _log("Added body component '" + component_name + "' to " + bp.get_name())
        return True
    except Exception as exc:
        unreal.log_warning("[build_vertical_slice] add_static_mesh_body failed: " + str(exc))
        return False


# ---------------------------------------------------------------------------
# Step 3: BP_VSPlayer
# ---------------------------------------------------------------------------

def build_vsplayer(bp_ga_melee):
    try:
        parent = load_class(CLS_PLAYER)
        if parent is None:
            raise RuntimeError("Could not load parent class " + CLS_PLAYER)

        bp = create_blueprint(BP_VSPLAYER_PATH, parent)

        body_ok = add_static_mesh_body(bp, CYLINDER_MESH, "VSBody")

        # Compile so the generated class reflects the new component before
        # we touch the CDO.
        unreal.BlueprintEditorLibrary.compile_blueprint(bp)

        cdo = get_cdo(bp)
        melee_cls = bp_ga_melee.generated_class()
        if melee_cls is None:
            raise RuntimeError("BP_GA_MeleeAttack has no generated class")
        cdo.set_editor_property("DefaultAbilities", [melee_cls])

        save(BP_VSPLAYER_PATH)
        return bp, body_ok
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] build_vsplayer FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Step 4: BP_VSPlayerController
# ---------------------------------------------------------------------------

def build_vsplayercontroller(imc):
    try:
        parent = load_class(CLS_PLAYERCTRL)
        if parent is None:
            raise RuntimeError("Could not load parent class " + CLS_PLAYERCTRL)

        bp = create_blueprint(BP_VSPLAYERCTRL_PATH, parent)
        cdo = get_cdo(bp)

        ia_move = load_object(IA_MOVE_PATH)
        ia_attack = load_object(IA_ATTACK_PATH)

        cdo.set_editor_property("DefaultMappingContext", imc)
        cdo.set_editor_property("IA_Move", ia_move)
        cdo.set_editor_property("IA_PrimaryAttack", ia_attack)

        save(BP_VSPLAYERCTRL_PATH)
        return bp
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] build_vsplayercontroller FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Step 5: BP_VSEnemy
# ---------------------------------------------------------------------------

def build_vsenemy():
    try:
        parent = load_class(CLS_ENEMY)
        if parent is None:
            raise RuntimeError("Could not load parent class " + CLS_ENEMY)

        bp = create_blueprint(BP_VSENEMY_PATH, parent)

        body_ok = add_static_mesh_body(bp, CUBE_MESH, "VSBody")

        unreal.BlueprintEditorLibrary.compile_blueprint(bp)

        cdo = get_cdo(bp)

        # Enemy death chain needs GA_Death granted. GrantedAbilities is
        # populated only from this property (GrantAbilitiesToASC iterates it).
        granted = []
        ga_death = load_class(CLS_GA_DEATH)
        if ga_death is not None:
            granted.append(ga_death)
        else:
            unreal.log_warning("[build_vertical_slice] GA_Death class not found")
        ga_hitreact = load_class(CLS_GA_HITREACT)
        if ga_hitreact is not None:
            granted.append(ga_hitreact)
        cdo.set_editor_property("GrantedAbilities", granted)

        save(BP_VSENEMY_PATH)
        return bp, body_ok
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] build_vsenemy FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Step 6: BP_VSGameMode
# ---------------------------------------------------------------------------

def build_vsgamemode(bp_player, bp_controller):
    try:
        parent = load_class(CLS_GAMEMODE)
        if parent is None:
            raise RuntimeError("Could not load parent class " + CLS_GAMEMODE)

        bp = create_blueprint(BP_VSGAMEMODE_PATH, parent)
        cdo = get_cdo(bp)

        cdo.set_editor_property("DefaultPawnClass", bp_player.generated_class())
        cdo.set_editor_property("PlayerControllerClass", bp_controller.generated_class())

        save(BP_VSGAMEMODE_PATH)
        return bp
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] build_vsgamemode FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Step 7: Level
# ---------------------------------------------------------------------------

def build_level(bp_enemy):
    try:
        level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
        actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

        # Create a fresh empty level. new_level() will not overwrite an
        # existing asset, so delete any prior level first (idempotent re-run).
        if asset_lib.does_asset_exist(LEVEL_PATH):
            _log("Existing level found, deleting for clean rebuild: " + LEVEL_PATH)
            # Load a blank level first so the level we want to delete is not
            # the current world (you cannot delete the open level).
            level_subsystem.new_level("/Temp/_vs_scratch")
            asset_lib.delete_asset(LEVEL_PATH)

        if not level_subsystem.new_level(LEVEL_PATH):
            raise RuntimeError("LevelEditorSubsystem.new_level failed for " + LEVEL_PATH)
        _log("Created level: " + LEVEL_PATH)

        cube_mesh = load_object(CUBE_MESH)
        if cube_mesh is None:
            raise RuntimeError("Cube mesh missing: " + CUBE_MESH)

        # --- Floor: wide flat cube StaticMeshActor with collision ---
        floor = actor_subsystem.spawn_actor_from_class(
            unreal.StaticMeshActor, unreal.Vector(0.0, 0.0, 0.0))
        floor.set_actor_label("Floor")
        floor.set_actor_scale3d(unreal.Vector(40.0, 40.0, 1.0))
        floor_smc = floor.static_mesh_component
        floor_smc.set_editor_property("static_mesh", cube_mesh)
        floor_smc.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
        floor_smc.set_mobility(unreal.ComponentMobility.STATIC)

        # --- Directional light ---
        dir_light = actor_subsystem.spawn_actor_from_class(
            unreal.DirectionalLight, unreal.Vector(0.0, 0.0, 1000.0),
            unreal.Rotator(-45.0, 0.0, 0.0))
        dir_light.set_actor_label("DirectionalLight")

        # --- Sky light ---
        sky_light = actor_subsystem.spawn_actor_from_class(
            unreal.SkyLight, unreal.Vector(0.0, 0.0, 1000.0))
        sky_light.set_actor_label("SkyLight")

        # --- Player start above the floor (floor top is at z=50) ---
        player_start = actor_subsystem.spawn_actor_from_class(
            unreal.PlayerStart, unreal.Vector(0.0, 0.0, 150.0))
        player_start.set_actor_label("PlayerStart")

        # --- Enemy a few metres from the start ---
        enemy_cls = bp_enemy.generated_class()
        if enemy_cls is None:
            raise RuntimeError("BP_VSEnemy has no generated class")
        enemy = actor_subsystem.spawn_actor_from_class(
            enemy_cls, unreal.Vector(400.0, 0.0, 150.0))
        enemy.set_actor_label("VSEnemy")

        # --- Functional test actor ---
        test_cls = load_class(CLS_VS_FUNC_TEST)
        if test_cls is None:
            raise RuntimeError("Could not load AVSFunctionalTest class")
        func_test = actor_subsystem.spawn_actor_from_class(
            test_cls, unreal.Vector(0.0, 0.0, 200.0))
        func_test.set_actor_label("VSFunctionalTest")

        level_subsystem.save_current_level()
        _log("Saved level: " + LEVEL_PATH)
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] build_level FAILED: " + str(exc))
        raise


# ---------------------------------------------------------------------------
# Step 8: Project config
# ---------------------------------------------------------------------------

def configure_project(bp_gamemode):
    try:
        # The generated GameMode class path, e.g.
        # /Game/VerticalSlice/BP_VSGameMode.BP_VSGameMode_C
        gamemode_path = bp_gamemode.generated_class().get_path_name()
        _write_default_engine_ini(gamemode_path)
        _log("Updated DefaultEngine.ini GameMapsSettings")
    except Exception as exc:
        unreal.log_error("[build_vertical_slice] configure_project FAILED: " + str(exc))
        raise


def _write_default_engine_ini(gamemode_path):
    """Edit Config/DefaultEngine.ini's [GameMapsSettings] section in place."""
    import os
    project_dir = unreal.Paths.project_dir()
    ini_path = os.path.normpath(os.path.join(project_dir, "Config", "DefaultEngine.ini"))

    section = "[/Script/EngineSettings.GameMapsSettings]"
    desired = {
        "GameDefaultMap": LEVEL_PATH,
        "EditorStartupMap": LEVEL_PATH,
        "GlobalDefaultGameMode": gamemode_path,
    }

    with open(ini_path, "r", encoding="utf-8-sig") as fh:
        lines = fh.read().splitlines()

    out = []
    in_section = False
    seen = set()
    section_found = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            # Leaving a section: flush any unseen desired keys.
            if in_section:
                for k, v in desired.items():
                    if k not in seen:
                        out.append("%s=%s" % (k, v))
                        seen.add(k)
            in_section = (stripped == section)
            if in_section:
                section_found = True
            out.append(line)
            continue

        if in_section and "=" in stripped and not stripped.startswith(";"):
            key = stripped.split("=", 1)[0].strip()
            if key in desired:
                out.append("%s=%s" % (key, desired[key]))
                seen.add(key)
                continue

        out.append(line)

    # Section was the last in the file, or had missing keys at EOF.
    if in_section:
        for k, v in desired.items():
            if k not in seen:
                out.append("%s=%s" % (k, v))
                seen.add(k)

    # Section did not exist at all - append it.
    if not section_found:
        out.append("")
        out.append(section)
        for k, v in desired.items():
            out.append("%s=%s" % (k, v))

    with open(ini_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    _log("=== Vertical slice authoring START ===")

    imc = build_imc()
    bp_ga_melee = build_ga_melee()
    bp_player, player_body_ok = build_vsplayer(bp_ga_melee)
    bp_controller = build_vsplayercontroller(imc)
    bp_enemy, enemy_body_ok = build_vsenemy()
    bp_gamemode = build_vsgamemode(bp_player, bp_controller)
    build_level(bp_enemy)
    configure_project(bp_gamemode)

    _log("Player visible body added: %s" % player_body_ok)
    _log("Enemy visible body added:  %s" % enemy_body_ok)
    _log("=== Vertical slice authoring COMPLETE ===")


if __name__ == "__main__":
    main()
