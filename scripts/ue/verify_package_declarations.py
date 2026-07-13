"""Packaging truth engine — Tier 2 rung B (L3): verify a package manifest's ueDeclarations
against the LIVE UE asset registry (does_asset_exist), one rung above the drain's
Content/*.uasset disk check (rung A). Run headless via the pythonscript commandlet:

  UnrealEditor-Cmd.exe <uproject> -run=pythonscript \
    -script="<abs path to this file>" -nullrhi -unattended -nosplash -abslog=<log>

The manifest path comes from the POF_PKG_MANIFEST env var (commandlet -script args are
unreliable). Emits one marker per declaration + a summary; judge by markers in the
abslog, not the exit code (UE headless shutdown crashes are routine).

  POF_PKG_DECL=<objectPath>=<0|1>
  POF_PKG_SUMMARY=realized=<n>;total=<n>
  POF_PKG_DONE=ok
"""
import json
import os

import unreal  # noqa: F401  (available inside the editor python runtime only)


def main() -> None:
    manifest_path = os.environ.get("POF_PKG_MANIFEST")
    if not manifest_path or not os.path.exists(manifest_path):
        print("POF_PKG_ERROR=POF_PKG_MANIFEST not set or file missing")
        return
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    decls = manifest.get("ueDeclarations", [])
    realized = 0
    for d in decls:
        path = d["path"] if isinstance(d, dict) else d
        exists = unreal.EditorAssetLibrary.does_asset_exist(path)
        realized += 1 if exists else 0
        print(f"POF_PKG_DECL={path}={1 if exists else 0}")
    print(f"POF_PKG_SUMMARY=realized={realized};total={len(decls)}")
    print("POF_PKG_DONE=ok")


main()
