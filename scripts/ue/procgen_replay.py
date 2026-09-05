"""Replay a PoF procgen grid export into the open Unreal level.

WHAT THIS IS
------------
The PoF browser preview generates a level layout in TypeScript (BSP / WFC /
cellular / Perlin over a `CellType` grid, seeded with a faithful port of UE's
`FRandomStream`). Every other UE-side path REGENERATES a layout from the seed --
`ARPGLevelGenerator` places room-template actors from a pool, and the C++ codegen
path is authored freehand by an LLM -- so "the same seed" has never meant "the
same map".

This script does not regenerate anything. It reads the exported CELLS and places
one actor per cell, in the order the file lists them. That is the whole idea: the
layout is data, and the engine replays it.

VERIFICATION STATUS -- READ THIS BEFORE QUOTING THIS FILE
---------------------------------------------------------
VERIFIED (by `src/__tests__/lib/level-design/procgen-grid-export.test.ts`, in CI):
  * the JSON field names this script requires are exactly the field names
    `exportProcgenGrid()` writes -- `REQUIRED_FIELDS` below is compared against
    the TypeScript `PROCGEN_GRID_EXPORT_FIELDS` list;
  * `importProcgenGrid(exportProcgenGrid(preview))` reproduces the preview grid
    cell-for-cell, so the artifact this script consumes is lossless.

NOT VERIFIED:
  * THIS SCRIPT HAS NEVER BEEN RUN. It was authored, not executed -- no Unreal
    editor was launched in the session that wrote it. Nothing here has been
    observed placing an actor, and no frame of the replayed level exists.
  * Consequently the parity claim for the `grid-replay` engine is made at the
    DATA rung only: `layoutAgreement('browser-preview', 'grid-replay')` returns
    `agree: true` with a reason that says, in the same sentence, that runtime
    placement in Unreal is unverified. Do not promote that claim to "verified in
    UE" until a live replay has been observed and a frame read.

USAGE (Unreal editor Python console or -ExecutePythonScript)
------------------------------------------------------------
    py "scripts/ue/procgen_replay.py" --grid "C:/path/procgen-cellular-32x32-149.json"

Options:
    --cell-size    world units per grid cell (default 200.0)
    --wall-height  Z extent of a wall actor, world units (default 400.0)
    --origin       "X,Y,Z" world origin of cell (0, 0) (default "0,0,0")
    --folder       World Outliner folder for the spawned actors
    --dry-run      parse + report, place nothing (safe first invocation)

Grid axes: `cells[y][x]`, row 0 first. X grows east (+X), Y grows south (+Y).
"""

from __future__ import annotations

import argparse
import json
import sys

# ---------------------------------------------------------------------------
# The contract with the TypeScript emitter.
#
# These are the artifact's top-level field names, in the order
# `PROCGEN_GRID_EXPORT_FIELDS` declares them in
# `src/lib/level-design/procgen-grid-export.ts`. A vitest test parses this tuple
# out of this file and asserts it equals that list, so renaming a field on
# either side fails the build instead of silently breaking this script.
# ---------------------------------------------------------------------------
REQUIRED_FIELDS = (
    "version",
    "generatedBy",
    "algorithm",
    "levelType",
    "seedLabel",
    "seedValue",
    "width",
    "height",
    "requestedWidth",
    "requestedHeight",
    "scale",
    "cellLegend",
    "cells",
    "rooms",
    "specFieldsConsumed",
    "specFieldsIgnored",
    "connectPass",
    "parity",
)

# Bumped in lockstep with PROCGEN_GRID_EXPORT_VERSION. An unknown version is
# REFUSED rather than guessed at -- a stored plan whose shape we cannot read is
# not a plan we may half-apply.
SUPPORTED_VERSION = 1

# Cell type -> what to place. `empty` places nothing.
FLOOR_CELLS = frozenset(("floor", "corridor", "door"))
WALL_CELLS = frozenset(("wall",))


def load_export(path):
    """Read + validate the artifact. Returns the parsed dict, or raises ValueError."""
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, dict):
        raise ValueError("Export root is not an object.")

    missing = [field for field in REQUIRED_FIELDS if field not in data]
    if missing:
        raise ValueError("Export is missing required field(s): %s" % ", ".join(missing))

    if data["version"] != SUPPORTED_VERSION:
        raise ValueError(
            "Export version %r is not supported by this script (expects %d). "
            "Refusing rather than guessing at the shape."
            % (data["version"], SUPPORTED_VERSION)
        )

    width, height, rows = data["width"], data["height"], data["cells"]
    if not isinstance(rows, list) or len(rows) != height:
        raise ValueError("Export declares height %r but carries %d rows." % (height, len(rows or [])))
    for y, row in enumerate(rows):
        if not isinstance(row, str) or len(row) != width:
            raise ValueError("Row %d is not a string of %r glyphs." % (y, width))

    legend = data["cellLegend"]
    if not isinstance(legend, dict) or not legend:
        raise ValueError("Export carries no cell legend, so its glyphs cannot be read.")
    unknown = sorted({ch for row in rows for ch in row} - set(legend))
    if unknown:
        raise ValueError("Cells use glyph(s) the legend does not define: %s" % ", ".join(unknown))

    return data


def describe(data):
    """The provenance banner -- printed before anything is placed."""
    parity = data.get("parity") or {}
    lines = [
        "PoF procgen grid replay",
        "  algorithm     : %s (%s)" % (data["algorithm"], data["levelType"]),
        "  seed          : %s -> %s" % (data["seedLabel"] or "(default)", data["seedValue"]),
        "  grid          : %sx%s (requested %sx%s, scale %s)"
        % (data["width"], data["height"], data["requestedWidth"], data["requestedHeight"], data["scale"]),
        "  rooms         : %d" % len(data.get("rooms") or []),
        "  generated by  : %s" % data["generatedBy"],
        "  spec consumed : %s" % ", ".join(data.get("specFieldsConsumed") or []),
        "  spec ignored  : %s" % ", ".join(data.get("specFieldsIgnored") or []),
    ]
    pass_report = data.get("connectPass")
    if pass_report:
        lines.append(
            "  connectivity  : pass %s -- %s regions -> %s, %s culled, %s tunnels, %s cells changed"
            % (
                "applied" if pass_report.get("applied") else "SKIPPED",
                pass_report.get("regionsBefore"),
                pass_report.get("regionsAfter"),
                pass_report.get("regionsCulled"),
                pass_report.get("tunnelsCarved"),
                pass_report.get("cellsChanged"),
            )
        )
    if parity:
        lines.append("  parity        : %s" % parity.get("provenClaim", ""))
        lines.append("  UNVERIFIED    : %s" % parity.get("unverified", ""))
    return "\n".join(lines)


def iter_placements(data, cell_size, wall_height, origin):
    """Yield (kind, location_tuple, extent_tuple) per non-empty cell, row-major.

    Deterministic by construction: it walks `cells` in the exact order the file
    stores them, so two runs of one artifact place the same actors in the same
    order at the same coordinates.
    """
    ox, oy, oz = origin
    legend = data["cellLegend"]
    for y, row in enumerate(data["cells"]):
        for x, glyph in enumerate(row):
            cell = legend[glyph]
            if cell in FLOOR_CELLS:
                kind, half_z, z = "floor", cell_size * 0.05, 0.0
            elif cell in WALL_CELLS:
                kind, half_z, z = "wall", wall_height * 0.5, wall_height * 0.5
            else:
                continue
            location = (ox + x * cell_size, oy + y * cell_size, oz + z)
            extent = (cell_size * 0.5, cell_size * 0.5, half_z)
            yield kind, cell, location, extent


def place(data, cell_size, wall_height, origin, folder, dry_run):
    """Spawn one static-mesh actor per non-empty cell. Returns a per-kind count."""
    counts = {"floor": 0, "wall": 0}
    placements = list(iter_placements(data, cell_size, wall_height, origin))
    for kind, _cell, _location, _extent in placements:
        counts[kind] += 1

    if dry_run:
        return counts

    # Imported lazily so --dry-run works outside the editor (and so this file can
    # be read/linted anywhere without an Unreal interpreter).
    import unreal  # noqa: PLC0415  -- editor-only module

    cube = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cube.Cube")
    if cube is None:
        raise RuntimeError("/Engine/BasicShapes/Cube could not be loaded; nothing was placed.")

    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for kind, cell, location, extent in placements:
        actor = subsystem.spawn_actor_from_object(
            cube, unreal.Vector(location[0], location[1], location[2])
        )
        if actor is None:
            continue
        # The engine cube is 100 uu; scale it to the requested cell extent.
        actor.set_actor_scale3d(
            unreal.Vector(extent[0] / 50.0, extent[1] / 50.0, max(extent[2], 1.0) / 50.0)
        )
        actor.set_actor_label("ProcGen_%s_%s_%d_%d" % (kind, cell, location[0], location[1]))
        if folder:
            actor.set_folder_path(folder)
    return counts


def parse_origin(raw):
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 3:
        raise ValueError("--origin expects 'X,Y,Z'")
    return tuple(float(p) for p in parts)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Replay a PoF procgen grid export into UE.")
    parser.add_argument("--grid", required=True, help="Path to the exported JSON artifact.")
    parser.add_argument("--cell-size", type=float, default=200.0)
    parser.add_argument("--wall-height", type=float, default=400.0)
    parser.add_argument("--origin", default="0,0,0")
    parser.add_argument("--folder", default="ProcGenReplay")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report; place nothing.")
    args = parser.parse_args(argv)

    try:
        data = load_export(args.grid)
        origin = parse_origin(args.origin)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print("REPLAY REFUSED: %s" % exc)
        return 2

    print(describe(data))
    counts = place(data, args.cell_size, args.wall_height, origin, args.folder, args.dry_run)
    verb = "would place" if args.dry_run else "placed"
    print("Replay %s %d floor and %d wall actors." % (verb, counts["floor"], counts["wall"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
