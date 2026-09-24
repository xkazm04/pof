"""
Base items → UARPGItemDefinition data assets (/diablo W10, D2) — UE editor, headless.

  env POF_DIABLO_ITEMS = path to generated/diablo/items.json (written by scripts/diablo/items.ts)

Creates or updates one data asset per base item under /Game/Diablo/Items (gitignored: reference values stay local) with the
fields UE gained in W10 — damage / armour range, durability, attribute requirements — plus type, slot and value, then
VERIFIES by reading every asset back. Prints POF_DIABLO_ITEMS_* markers; the caller grades from those.
"""
import json
import os

import unreal

spec = json.load(open(os.environ["POF_DIABLO_ITEMS"], encoding="utf-8"))
lib = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
SLOTS = {
    "Weapon": [unreal.EquipmentSlot.WEAPON], "OffHand": [unreal.EquipmentSlot.OFF_HAND], "Helm": [unreal.EquipmentSlot.HELM],
    "Chest": [unreal.EquipmentSlot.CHEST], "Ring": [unreal.EquipmentSlot.RING1, unreal.EquipmentSlot.RING2],
    "Amulet": [unreal.EquipmentSlot.AMULET],
}
FIELDS = ["MinDamage", "MaxDamage", "MinArmor", "MaxArmor"]
INTS = {"MaxDurability": "maxDurability", "RequiredStrength": "requiredStrength", "RequiredDexterity": "requiredDexterity",
        "RequiredIntelligence": "requiredIntelligence", "BaseValue": "baseValue"}

written = []
for it in spec["items"]:
    path = it["asset"]
    folder, name = path.rsplit("/", 1)
    if lib.does_asset_exist(path):
        da = lib.load_asset(path)
    else:
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", unreal.ARPGItemDefinition)
        da = asset_tools.create_asset(name, folder, unreal.ARPGItemDefinition, factory)
    da.set_editor_property("DisplayName", unreal.Text(it["displayName"]))
    da.set_editor_property("Type", unreal.ARPGItemType.WEAPON if it["slot"] == "Weapon" else unreal.ARPGItemType.ARMOR)
    da.set_editor_property("AllowedSlots", SLOTS.get(it["slot"], []))
    da.set_editor_property("MaxStackSize", 1)
    for f in FIELDS:
        key = f[0].lower() + f[1:]
        da.set_editor_property(f, float(it[key]))
    for f, key in INTS.items():
        da.set_editor_property(f, int(it[key]))
    lib.save_asset(path)
    written.append(path)

verify = {}
for it in spec["items"]:
    da = lib.load_asset(it["asset"])
    verify[it["entityId"]] = {
        "name": str(da.get_editor_property("DisplayName")),
        "slots": [str(s) for s in da.get_editor_property("AllowedSlots")],
        "damage": [da.get_editor_property("MinDamage"), da.get_editor_property("MaxDamage")],
        "durability": da.get_editor_property("MaxDurability"),
        "req": [da.get_editor_property("RequiredStrength"), da.get_editor_property("RequiredDexterity"), da.get_editor_property("RequiredIntelligence")],
    }
unreal.log(f"POF_DIABLO_ITEMS_WRITTEN={len(written)}")
unreal.log(f"POF_DIABLO_ITEMS_VERIFY={json.dumps(verify)}")
