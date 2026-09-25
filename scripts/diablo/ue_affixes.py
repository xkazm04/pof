"""
Diablo affix tiers → UE affix DataTables, one per item class (/diablo W14 D32, W15) — UE editor, headless.

  env POF_DIABLO_AFFIXES = path to generated/diablo/affixes.json (written by scripts/diablo/affixes.ts)

Per pool: writes the FAffixTableRow table (gitignored: reference values stay local), sets it as the AffixPool of every
Diablo item of that class, reads both back (AffixTag must resolve — the tags come from Config/Tags/DiabloAffixes.ini),
then ROLLS the table through the real UARPGAffixRoller at several item levels and checks what every roll must obey: the
value sits inside a candidate tier's range (no second item-level scaling), the tier's level gate holds, one affix per
family, the side caps. A tier's NAME is not unique in the reference (two FIRERES tiers are "Crimson"), so a roll is legal
if ANY candidate tier with that name admits it. Prints POF_DIABLO_AFFIXES_* markers.
"""
import json
import os

import unreal

spec = json.load(open(os.environ["POF_DIABLO_AFFIXES"], encoding="utf-8"))
lib = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
DTL = unreal.DataTableFunctionLibrary
FIELDS = ["DisplayName", "bIsPrefix", "MinValue", "MaxValue", "Weight", "MinRarity", "AffixGroup", "MinItemLevel", "Effect", "bScaleWithItemLevel"]

for pool in spec["pools"]:
    cls, path = pool["cls"], pool["table"]
    folder, name = path.rsplit("/", 1)
    rows = []
    for r in pool["rows"]:
        row = {"Name": r["Name"], "AffixTag": {"TagName": r["AffixTag"]}}
        row.update({k: r[k] for k in FIELDS})
        rows.append(row)
    if lib.does_asset_exist(path):
        dt = lib.load_asset(path)
    else:
        f = unreal.DataTableFactory()
        f.set_editor_property("struct", unreal.AffixTableRow.static_struct())
        dt = asset_tools.create_asset(name, folder, unreal.DataTable, f)
    ok = DTL.fill_data_table_from_json_string(dt, json.dumps(rows))
    lib.save_asset(path)
    dt = lib.load_asset(path)
    names = [str(n) for n in DTL.get_data_table_row_names(dt)]
    eff = DTL.get_data_table_column_as_string(dt, "Effect")
    scale = DTL.get_data_table_column_as_string(dt, "bScaleWithItemLevel")
    tags = DTL.get_data_table_column_as_string(dt, "AffixTag")
    valid_tags = sum(1 for t in tags if "Affix.D1." in str(t))
    unreal.log(f"POF_DIABLO_AFFIXES_TABLE={cls} {path} filled={ok} rows={len(names)}/{len(rows)} effectsSet={sum(1 for e in eff if e and e != 'None')} scaleFalse={sum(1 for s in scale if str(s).lower() == 'false')} tagsValid={valid_tags}")

    set_count = 0
    for a in pool["assets"]:
        if not lib.does_asset_exist(a):
            continue
        da = lib.load_asset(a)
        da.set_editor_property("AffixPool", dt)
        lib.save_asset(a)
        if lib.load_asset(a).get_editor_property("AffixPool") == dt:
            set_count += 1
    powers = sorted({r["power"] for r in pool["rows"]})
    unreal.log(f"POF_DIABLO_AFFIXES_POOL={cls} items={set_count}/{len(pool['assets'])} LIFE={'LIFE' in powers}")

    by_name = {}
    for r in pool["rows"]:
        by_name.setdefault(r["DisplayName"], []).append(r)
    totals = {"affixes": 0, "outOfRange": 0, "levelGateBroken": 0, "dupFamilies": 0, "overSideCap": 0, "unknown": 0, "tagless": 0}
    for rarity_name in ["UNCOMMON", "RARE"]:
        rarity = getattr(unreal.ARPGItemRarity, rarity_name)
        cap = 1 if rarity_name == "UNCOMMON" else 3
        for ilvl in [1, 5, 10, 20, 30]:
            for _ in range(100):
                affixes = unreal.ARPGAffixRoller.roll_affixes(dt, rarity, ilvl)
                fams, pre, suf = [], 0, 0
                for af in affixes:
                    totals["affixes"] += 1
                    if not af.get_editor_property("AffixTag").get_editor_property("tag_name"):
                        totals["tagless"] += 1
                    cands = by_name.get(str(af.get_editor_property("DisplayName")))
                    if not cands:
                        totals["unknown"] += 1
                        continue
                    m = af.get_editor_property("Magnitude")
                    fit = [c for c in cands if c["MinValue"] - 1e-4 <= m <= c["MaxValue"] + 1e-4]
                    if not fit:
                        totals["outOfRange"] += 1
                    if not any(c["MinItemLevel"] <= max(1, ilvl) for c in (fit or cands)):
                        totals["levelGateBroken"] += 1
                    r = (fit or cands)[0]
                    fams.append(r["family"])
                    if r["bIsPrefix"]:
                        pre += 1
                    else:
                        suf += 1
                totals["dupFamilies"] += len(fams) - len(set(fams))
                if pre > cap or suf > cap:
                    totals["overSideCap"] += 1
    unreal.log(f"POF_DIABLO_AFFIXES_ROLL={cls} items=1000 " + " ".join(f"{k}={v}" for k, v in totals.items()))
unreal.log("POF_DIABLO_AFFIXES_DONE=1")
