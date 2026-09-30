"""Headless Blender FBX -> GLB conversion: one .fbx file in, one .glb file out.

This is a FILE job and it runs in its own background Blender, never in the
operator's live session. The earlier implementation pushed a script over the
Blender MCP bridge whose first line reset the scene the operator had open; here
the process is started with --factory-startup, so the only scene touched is this
process's own throwaway one.

Run:
    blender --background --factory-startup --python pof_fbx_convert.py -- \
        --input C:/in/model.fbx --output generated/converted/model.glb [--draco]

Emits POF_FBXCONV_* stdout markers consumed by `src/lib/visual-gen/fbx-convert.ts`
(never judge by exit code -- Blender's headless shutdown is noisy):

    POF_FBXCONV_MESHES=<mesh objects exported>
    POF_FBXCONV_TRIS=<triangles exported>
    POF_FBXCONV_DONE=<output path>      only after the file is on disk
    POF_FBXCONV_ERROR=<reason>          any refusal

Draco is opt-in: the app's own viewer (SceneViewer's GLTFLoader) has no Draco
decoder, so a compressed GLB would not open in PoF itself.
"""

import argparse
import os
import sys

import bpy


def marker(key, value):
    print("POF_FBXCONV_%s=%s" % (key, value))
    sys.stdout.flush()


def fail(message):
    marker("ERROR", message)
    sys.exit(0)  # markers are the contract; a non-zero exit adds nothing


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--draco", action="store_true")
    return p.parse_args(argv)


def empty_scene():
    """--factory-startup still opens the default cube/camera/light; drop them so the
    export holds only what the FBX brought in."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def apply_transforms(meshes):
    """Bake rotation + scale into unparented meshes so the GLB has identity transforms.

    Meshes parented to an armature keep theirs: baking a skinned child breaks its bind.
    """
    bpy.ops.object.select_all(action="DESELECT")
    free = [o for o in meshes if o.parent is None]
    for o in free:
        o.select_set(True)
    if free:
        bpy.context.view_layer.objects.active = free[0]
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")


def triangulate(meshes):
    """A Triangulate modifier per mesh, applied at export (export_apply=True)."""
    for o in meshes:
        o.modifiers.new(name="POF_Triangulate", type="TRIANGULATE")


def count_tris(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for o in meshes:
        mesh = o.evaluated_get(depsgraph).to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        o.evaluated_get(depsgraph).to_mesh_clear()
    return total


def main():
    args = parse_args()
    if not os.path.isfile(args.input):
        fail("input not found: %s" % args.input)
    if not args.input.lower().endswith(".fbx"):
        fail("input is not an .fbx file: %s" % args.input)
    out_dir = os.path.dirname(args.output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    empty_scene()
    try:
        bpy.ops.import_scene.fbx(filepath=args.input)
    except Exception as e:  # noqa: BLE001 -- the importer raises RuntimeError on bad files
        fail("FBX import failed: %s" % e)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        fail("the FBX holds no mesh")

    apply_transforms(meshes)
    triangulate(meshes)
    tris = count_tris(meshes)

    if os.path.isfile(args.output):
        os.remove(args.output)  # a stale file must never read as this run's output
    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=bool(args.draco),
    )
    if not os.path.isfile(args.output):
        fail("export wrote no file at %s" % args.output)

    marker("MESHES", len(meshes))
    marker("TRIS", tris)
    marker("DONE", args.output.replace("\\", "/"))


main()
