"""
Diablo affix tiers → a UE affix DataTable (/diablo W14, D32) — UE editor, headless.

  env POF_DIABLO_AFFIXES = path to generated/diablo/affixes.json (written by scripts/diablo/affixes.ts)

Writes the FAffixTableRow table (gitignored: reference values stay local), sets it as the AffixPool of every Diablo weapon
asset, reads both back, then ROLLS the table through the real UARPGAffixRoller at several item levels and checks what every
roll must obey: the value sits inside its tier's range (no second item-level scaling), the tier's level gate holds, one
affix per family, at most one prefix and one suffix (Uncommon = Diablo's magic item). Prints POF_DIABLO_AFFIXES_* markers.
"""
import json
import os

import unreal

spec = json.load(open(os.environ["POF_DIABLO_AFFIXES"], encoding="utf-8"))
lib = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
path = spec["table"]
folder, name = path.rsplit("/", 1)

rows = [{
    "Name": r["Name"], "DisplayName": r["DisplayName"], "bIsPrefix": r["bIsPrefix"], "MinValue": r["MinValue"], "MaxValue": r["MaxValue"],
    "Weight": r["Weight"], "MinRarity": r["MinRarity"], "AffixGroup": r["AffixGroup"], "MinItemLevel": r["MinItemLevel"],
    "Effect": r["Effect"], "bScaleWithItemLevel": r["bScaleWithItemLevel"],
} for r in spec["rows"]]

if lib.does_asset_exist(path):
    dt = lib.load_asset(path)
else:
    f = unreal.DataTableFactory()
    f.set_editor_property("struct", unreal.AffixTableRow.static_struct())
    dt = asset_tools.create_asset(name, folder, unreal.DataTable, f)
ok = unreal.DataTableFunctionLibrary.fill_data_table_from_json_string(dt, json.dumps(rows))
lib.save_asset(path)
dt = lib.load_asset(path)
names = [str(n) for n in unreal.DataTableFunctionLibrary.get_data_table_row_names(dt)]
eff = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(dt, "Effect")
scale = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(dt, "bScaleWithItemLevel")
unreal.log(f"POF_DIABLO_AFFIXES_TABLE={path} filled={ok} rows={len(names)}/{len(rows)} effectsSet={sum(1 for e in eff if e and e != 'None')} scaleFalse={sum(1 for s in scale if str(s).lower() == 'false')}")

set_count = 0
for a in spec["weaponAssets"]:
    if not lib.does_asset_exist(a):
        continue
    da = lib.load_asset(a)
    da.set_editor_property("AffixPool", dt)
    lib.save_asset(a)
    if lib.load_asset(a).get_editor_property("AffixPool") == dt:
        set_count += 1
unreal.log(f"POF_DIABLO_AFFIXES_POOLS={set_count}/{len(spec['weaponAssets'])}")

# A tier's name is not unique in the reference (two FIRERES tiers are both "Crimson"), so a name maps to its candidates and
# a roll is legal if ANY candidate admits it.
by_name = {}
for r in spec["rows"]:
    by_name.setdefault(r["DisplayName"], []).append(r)
for rarity_name in ["UNCOMMON", "RARE"]:
    rarity = getattr(unreal.ARPGItemRarity, rarity_name)
    for ilvl in [1, 5, 10, 20, 30]:
        n = out_range = gated = dupes = over_side = unknown = empty = 0
        eligible = sum(1 for r in spec["rows"] if r["MinItemLevel"] <= max(1, ilvl))
        for _ in range(200):
            res = unreal.ARPGAffixRoller.roll_affixes(dt, rarity, ilvl)
            affixes = res if isinstance(res, (list, tuple, unreal.Array)) else []
            if len(affixes) == 0:
                empty += 1
            fams, pre, suf = [], 0, 0
            for af in affixes:
                n += 1
                cands = by_name.get(str(af.get_editor_property("DisplayName")))
                if not cands:
                    unknown += 1
                    continue
                m = af.get_editor_property("Magnitude")
                in_range = [c for c in cands if c["MinValue"] - 1e-4 <= m <= c["MaxValue"] + 1e-4]
                if not in_range:
                    out_range += 1
                    r = cands[0]
                else:
                    r = in_range[0]
                if not any(c["MinItemLevel"] <= max(1, ilvl) for c in in_range or cands):
                    gated += 1
                fams.append(r["family"])
                if r["bIsPrefix"]:
                    pre += 1
                else:
                    suf += 1
            dupes += len(fams) - len(set(fams))
            cap = 1 if rarity_name == "UNCOMMON" else 3
            if pre > cap or suf > cap:
                over_side += 1
        unreal.log(f"POF_DIABLO_AFFIXES_ROLL={rarity_name} ilvl={ilvl} eligibleTiers={eligible} items=200 affixes={n} empty={empty} outOfRange={out_range} levelGateBroken={gated} dupFamilies={dupes} overSideCap={over_side} unknown={unknown}")
unreal.log("POF_DIABLO_AFFIXES_DONE=1")
