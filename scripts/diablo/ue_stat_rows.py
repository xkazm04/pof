"""
Apply converted stat rows to the Diablo-replication monsters in UE (/diablo W07, D23) — UE editor, headless.

  UnrealEditor-Cmd.exe <PoF.uproject> -run=pythonscript -script=<abs path to this file> -nullrhi
  with env POF_DIABLO_STATS = path to generated/diablo/stat-rows.json (written by scripts/diablo/stats.ts)

PoF's characters initialise from `AttributeInitTable` + `AttributeInitRowName` (FARPGAttributeInitRow), but no
such table exists in the project — every character runs on UARPGAttributeSet's constructor defaults. This builds
a Diablo-scoped table under /Game/Diablo (gitignored: reference values stay local), REPLACES all its rows from the
JSON (the app is the source of truth, so a re-run is a full rebuild), points each monster's Blueprint at its own
row, sets its melee ability's BaseDamage to the converted damage, and VERIFIES by reading back. PoF's own
characters are never touched. Prints POF_DIABLO_STATS_* markers; the caller grades from those.
"""
import json
import os

import unreal

spec = json.load(open(os.environ["POF_DIABLO_STATS"], encoding="utf-8"))
TABLE = spec["table"]
folder, name = TABLE.rsplit("/", 1)
lib = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()

row_struct = unreal.load_object(None, "/Script/PoF.ARPGAttributeInitRow")
if row_struct is None:
    unreal.log_error("POF_DIABLO_STATS_ERROR=row struct /Script/PoF.ARPGAttributeInitRow not found")
    raise SystemExit(1)

if lib.does_asset_exist(TABLE):
    dt = lib.load_asset(TABLE)
else:
    factory = unreal.DataTableFactory()
    factory.set_editor_property("struct", row_struct)
    dt = asset_tools.create_asset(name, folder, unreal.DataTable, factory)

rows = [{"Name": r["entityId"], **r["ueRow"]} for r in spec["rows"]]
filled = unreal.DataTableFunctionLibrary.fill_data_table_from_json_string(dt, json.dumps(rows))
lib.save_asset(TABLE)
unreal.log(f"POF_DIABLO_STATS_TABLE={TABLE} filled={filled} rows={len(rows)}")

applied, skipped = [], []
for r in spec["rows"]:
    bp_path, ga_path = r["blueprint"], r["melee"]
    if not lib.does_asset_exist(bp_path):
        skipped.append(f"{r['entityId']} (no {bp_path})")
        continue
    bp = lib.load_asset(bp_path)
    cdo = unreal.get_default_object(bp.generated_class())
    cdo.set_editor_property("AttributeInitTable", dt)
    cdo.set_editor_property("AttributeInitRowName", r["entityId"])
    # The actor's level: it sets the item level of what this monster drops (D7, W10) — it stayed 1 before.
    cdo.set_editor_property("CharacterLevel", int(r["ueRow"].get("CharacterLevel", 1)))
    # Behaviour (W08): per-entity timing that survives ApplyArchetypeDefaults() at possession.
    beh = r.get("behaviour") or {}
    if "MoveSpeedOverride" in beh:
        cdo.set_editor_property("MoveSpeedOverride", float(beh["MoveSpeedOverride"]))
        cdo.set_editor_property("AttackCooldownOverride", float(beh["AttackCooldownOverride"]))
    if beh.get("bNeverApproach"):
        cdo.set_editor_property("bNeverApproach", True)
        cdo.set_editor_property("RetreatDistanceOverride", float(beh["RetreatDistanceOverride"]))
        cdo.set_editor_property("AttackRangeOverride", float(beh["AttackRangeOverride"]))
    unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    lib.save_asset(bp_path)
    if lib.does_asset_exist(ga_path):
        ga_bp = lib.load_asset(ga_path)
        ga_cdo = unreal.get_default_object(ga_bp.generated_class())
        ga_cdo.set_editor_property("BaseDamage", float(r["baseDamage"]))
        if "hitDelay" in beh and r.get("attackKind", "melee") == "melee":
            ga_cdo.set_editor_property("FallbackAttackWindow", float(beh["hitDelay"]))
        unreal.BlueprintEditorLibrary.compile_blueprint(ga_bp)
        lib.save_asset(ga_path)
    applied.append(r["entityId"])

# Verify by READING BACK from freshly loaded assets.
back_rows = [str(n) for n in unreal.DataTableFunctionLibrary.get_data_table_row_names(lib.load_asset(TABLE))]
verify = {}
for r in spec["rows"]:
    if r["entityId"] not in applied:
        continue
    cdo = unreal.get_default_object(lib.load_asset(r["blueprint"]).generated_class())
    tbl = cdo.get_editor_property("AttributeInitTable")
    ga = lib.load_asset(r["melee"]) if lib.does_asset_exist(r["melee"]) else None
    verify[r["entityId"]] = {
        "table": tbl.get_path_name() if tbl else None,
        "row": str(cdo.get_editor_property("AttributeInitRowName")),
        "rowInTable": r["entityId"] in back_rows,
        "meleeBaseDamage": round(unreal.get_default_object(ga.generated_class()).get_editor_property("BaseDamage"), 3) if ga else None,
        "hitWindow": round(unreal.get_default_object(ga.generated_class()).get_editor_property("FallbackAttackWindow"), 3) if ga and r.get("attackKind", "melee") == "melee" else None,
        "neverApproach": cdo.get_editor_property("bNeverApproach"),
        "retreat": round(cdo.get_editor_property("RetreatDistanceOverride"), 1),
        "moveSpeedOverride": round(cdo.get_editor_property("MoveSpeedOverride"), 1),
        "level": cdo.get_editor_property("CharacterLevel"),
        "attackCooldownOverride": round(cdo.get_editor_property("AttackCooldownOverride"), 3),
    }
unreal.log(f"POF_DIABLO_STATS_ROWS={json.dumps(back_rows)}")
unreal.log(f"POF_DIABLO_STATS_VERIFY={json.dumps(verify)}")
unreal.log(f"POF_DIABLO_STATS_SKIPPED={json.dumps(skipped)}")
# The speed anchor assumed PoF's player walks at the C++ WalkSpeed default; report what the player Blueprints hold.
for pbp in ("/Game/Characters/Jedi/BP_JediPlayer", "/Game/VerticalSlice/BP_VSPlayer"):
    if lib.does_asset_exist(pbp):
        pc = unreal.get_default_object(lib.load_asset(pbp).generated_class())
        unreal.log(f"POF_DIABLO_STATS_PLAYER_WALK={pbp} WalkSpeed={pc.get_editor_property('WalkSpeed')} anchor={spec['basis'].get('playerWalkSpeed')}")
