"""
The monster's attack ability, built per entity (/diablo W06 melee, W09 ranged) — shared by ue_import_monster.py and
ue_family_variant.py so the two can never grant different attacks.

`kind` comes from the monster's AI routine (behaviourScale.attackKindOf): 'melee' → a Blueprint subclass of
UGA_EnemyMeleeAttack (Ability.Enemy.Melee); 'ranged' → a subclass of UGA_EnemyRangedAttack (Ability.Enemy.Ranged) that
fires a bare AARPGProjectile carrying GE_Damage (the C++ ranged ability leaves both unset). Damage is set later by the
monster's stat row (stats.ts --apply); only an explicit value passed here is written.
"""
import unreal


def build_attack(dest, name, kind="melee", damage=None):
    lib = unreal.EditorAssetLibrary
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    parent_path = "/Script/PoF.GA_EnemyRangedAttack" if kind == "ranged" else "/Script/PoF.GA_EnemyMeleeAttack"
    suffix = "Ranged" if kind == "ranged" else "Melee"
    parent = unreal.load_class(None, parent_path)
    if parent is None:
        unreal.log_error(f"POF_DIABLO_UE_ATTACK_ERROR=no {parent_path}")
        return None
    ga_path = f"{dest}/GA_{name}_{suffix}"
    if lib.does_asset_exist(ga_path):
        ga_bp = lib.load_asset(ga_path)
    else:
        gf = unreal.BlueprintFactory()
        gf.set_editor_property("parent_class", parent)
        ga_bp = asset_tools.create_asset(f"GA_{name}_{suffix}", dest, unreal.Blueprint, gf)
    unreal.BlueprintEditorLibrary.compile_blueprint(ga_bp)
    ga_cdo = unreal.get_default_object(ga_bp.generated_class())
    if kind == "ranged":
        ga_cdo.set_editor_property("ProjectileClass", unreal.load_class(None, "/Script/PoF.ARPGProjectile"))
        ga_cdo.set_editor_property("DamageEffect", unreal.load_class(None, "/Script/PoF.GE_Damage"))
    if damage is not None:
        ga_cdo.set_editor_property("BaseDamage", float(damage))
    unreal.BlueprintEditorLibrary.compile_blueprint(ga_bp)
    lib.save_asset(ga_path)
    unreal.log(f"POF_DIABLO_UE_ATTACK={ga_path} kind={kind} BaseDamage={ga_cdo.get_editor_property('BaseDamage')}")
    return ga_bp.generated_class()
