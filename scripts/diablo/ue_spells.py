"""
Diablo spells → UE abilities (/diablo W13) — UE editor, headless.

  env POF_DIABLO_SPELLS = path to generated/diablo/spells.json (written by scripts/diablo/spells.ts)

One Blueprint subclass of UGA_TimedProjectileSpell per spell under /Game/Diablo/Spells (gitignored: reference values stay
local): BaseDamage, AbilityManaCost, CastTime, ReleaseTime, DamageTypeTag — and NO cooldown effect (Diablo I has none; the
cast limits the rate). VERIFIES by reading every CDO back. Prints POF_DIABLO_SPELLS_* markers; the caller grades from those.
"""
import json
import os

import unreal

spec = json.load(open(os.environ["POF_DIABLO_SPELLS"], encoding="utf-8"))
lib = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
parent = unreal.load_class(None, "/Script/PoF.GA_TimedProjectileSpell")
if parent is None:
    unreal.log_error("POF_DIABLO_SPELLS_ERROR=no /Script/PoF.GA_TimedProjectileSpell (rebuild the editor)")
else:
    for s in spec["spells"]:
        path = s["asset"]
        folder, name = path.rsplit("/", 1)
        if lib.does_asset_exist(path):
            bp = lib.load_asset(path)
        else:
            f = unreal.BlueprintFactory()
            f.set_editor_property("parent_class", parent)
            bp = asset_tools.create_asset(name, folder, unreal.Blueprint, f)
        unreal.BlueprintEditorLibrary.compile_blueprint(bp)
        cdo = unreal.get_default_object(bp.generated_class())
        cdo.set_editor_property("BaseDamage", float(s["baseDamage"]))
        cdo.set_editor_property("AbilityManaCost", float(s["manaCost"]))
        cdo.set_editor_property("CastTime", float(s["castTime"]))
        cdo.set_editor_property("ReleaseTime", float(s["releaseTime"]))
        tag = unreal.GameplayTag()
        tag.import_text(f'(TagName="{s["damageTag"]}")')
        cdo.set_editor_property("DamageTypeTag", tag)
        unreal.BlueprintEditorLibrary.compile_blueprint(bp)
        lib.save_asset(path)
        back = unreal.get_default_object(lib.load_asset(path).generated_class())
        got = {k: round(float(back.get_editor_property(k)), 3) for k in ["BaseDamage", "AbilityManaCost", "CastTime", "ReleaseTime"]}
        cooldown = back.get_editor_property("CooldownGameplayEffectClass")
        tag = back.get_editor_property("DamageTypeTag")
        unreal.log(f"POF_DIABLO_SPELLS_ASSET={path} {json.dumps(got)} cooldown={cooldown} tag={tag.export_text()}")
    unreal.log("POF_DIABLO_SPELLS_DONE=1")
