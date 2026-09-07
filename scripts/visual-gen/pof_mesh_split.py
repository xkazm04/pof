"""Headless Blender mesh split: one multi-object GLB -> one GLB per object.

A generator charges per JOB, not per object. Asking one image-to-3D job for a
small group of simple props and separating them afterwards costs one job instead
of four, and each separated prop lands well under its class budget with no
decimation at all. This is the separating half.

Run:
    blender --background --python pof_mesh_split.py -- \
        --input props.glb --output-dir generated/mesh-split --prefix props \
        --min-face-share 0.005 --max-parts 24 --center

Emits POF_MESHSPLIT_* stdout markers consumed by
`src/lib/visual-gen/mesh-split.ts` (never judge by exit code — Blender's
headless shutdown is noisy).

Two rules this script exists to keep:

  * The split runs in Blender's own BMesh via bpy.ops.mesh.separate(type='LOOSE'),
    NOT in trimesh. trimesh.split() deep-copies material data per connected
    component; on a fragmented textured mesh it reached 211 GB and crashed the
    host (2026-08-18).

  * Nothing is dropped silently. Generated meshes carry speck debris (measured:
    314 of 375 components on one real character were specks holding 36% of the
    faces). Specks must not become "assets", so components below --min-face-share
    are discarded and the count + face total of what was discarded is REPORTED.
"""

import argparse
import os
import sys

import bpy


def marker(key, value):
    print("POF_MESHSPLIT_%s=%s" % (key, value))
    sys.stdout.flush()


def fail(message):
    marker("ERROR", message)
    sys.exit(0)  # markers are the contract; a non-zero exit adds nothing


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output-dir", required=True)
    p.add_argument("--prefix", required=True)
    p.add_argument("--min-face-share", type=float, default=0.005)
    p.add_argument("--max-parts", type=int, default=24)
    p.add_argument("--min-coverage", type=float, default=0.8)
    p.add_argument("--center", action="store_true")
    return p.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_mesh(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        fail("unsupported input extension %s" % ext)
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def join_meshes(objs):
    """One object is the precondition for a LOOSE separate to mean anything."""
    if not objs:
        fail("no mesh objects in the input")
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def recenter(obj):
    """Origin to the part's own bounding-box centre, then the part to the world origin.

    A prop separated out of a group otherwise keeps the group's offset, and every
    downstream consumer (viewer framing, the UE import, the world-scale gate)
    reads an asset as origin-centred.
    """
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0.0, 0.0, 0.0)


def export_one(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )


def main():
    args = parse_args()
    if not os.path.isfile(args.input):
        fail("input not found: %s" % args.input)
    os.makedirs(args.output_dir, exist_ok=True)

    reset_scene()
    obj = join_meshes(import_mesh(args.input))
    faces_in = len(obj.data.polygons)
    marker("FACES_IN", faces_in)
    if faces_in == 0:
        fail("input mesh has no faces")

    # LOOSE separate: Blender walks its own BMesh adjacency and hands back one object
    # per connected component. Everything the caller cares about is measured after.
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")

    parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    marker("COMPONENTS", len(parts))
    if len(parts) < 2:
        fail("mesh has one connected component — nothing to split")

    # Largest first, so `_01` is the dominant object and the cap drops the least significant.
    parts.sort(key=lambda o: len(o.data.polygons), reverse=True)

    kept = []
    discarded = 0
    discarded_faces = 0
    capped = 0
    for o in parts:
        faces = len(o.data.polygons)
        share = float(faces) / float(faces_in)
        if share < args.min_face_share:
            discarded += 1
            discarded_faces += faces
            continue
        if len(kept) >= args.max_parts:
            # A cap drop is NOT a speck. Conflating them would report a truncated split
            # as a clean one that happened to shed debris.
            capped += 1
            continue
        kept.append((o, faces, share))

    if not kept:
        fail("every component is below the %.4f face-share threshold" % args.min_face_share)

    # THE GROUP-VS-SHATTERED GATE. A group of distinct props is a handful of components
    # that between them are the whole mesh; a fragmented single object is hundreds of
    # slivers that are not. Only coverage separates the two, and getting this wrong
    # manufactures assets out of debris -- measured on props__crate.glb (one crate, 451
    # components): 24 parts covering 23% of the faces.
    coverage = sum(f for _, f, _ in kept) / float(faces_in)
    marker("COVERAGE", "%.4f" % coverage)
    if coverage < args.min_coverage:
        fail(
            "the %d components above the threshold cover only %.0f%% of the faces "
            "(floor %.0f%%) -- this is one fragmented mesh, not a group of objects; "
            "run mesh-finish on it instead of splitting it"
            % (len(kept), coverage * 100.0, args.min_coverage * 100.0)
        )

    for index, (o, faces, share) in enumerate(kept, start=1):
        if args.center:
            recenter(o)
        name = "%s_%02d.glb" % (args.prefix, index)
        path = os.path.join(args.output_dir, name).replace("\\", "/")
        export_one(o, path)
        if not os.path.isfile(path):
            fail("export wrote no file for %s" % name)
        marker("PART", "%s|%d|%.4f|%s" % (name, faces, share, path))

    marker("DISCARDED", discarded)
    marker("DISCARDED_FACES", discarded_faces)
    marker("CAPPED", capped)
    marker("DONE", 1)


main()
