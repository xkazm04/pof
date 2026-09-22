"""
Budget a RIGGED .glb to a triangle count, keeping its skin (/diablo W05) — Blender headless.

  blender -b -P scripts/diablo/decimate_rigged.py -- <in.glb> <out.glb> <triangle_budget>

Image-to-3D services deliver dense meshes (the Zombie: 186k vertices) — right for generation, wrong
for a runtime. The registry standard (asset-class-poly-budgeting) is followed literally: the budget
is authored in TRIANGLES, the delivery is MEASURED in triangles after triangulation, and both are
printed so the caller can grade delivered-vs-requested. Decimation is placed FIRST in each mesh's
modifier stack (under the Armature modifier) so vertex groups — the skin weights — are carried
through and interpolated; animations and the skeleton are exported unchanged.
Prints POF_DECIMATE_* markers.
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 3:
    print("POF_DECIMATE_ERROR=usage: -- <in.glb> <out.glb> <triangle_budget>")
    sys.exit(2)
src, dst, budget = argv[0], argv[1], int(argv[2])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    print("POF_DECIMATE_ERROR=no mesh in the glb")
    sys.exit(1)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


before = sum(tri_count(o) for o in meshes)
ratio = min(1.0, budget / before) if before else 1.0
for obj in meshes:
    if ratio >= 1.0:
        continue
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("budget", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    # First in the stack, so it applies to the rest mesh and the Armature modifier still deforms it.
    while obj.modifiers.find("budget") > 0:
        bpy.ops.object.modifier_move_up(modifier="budget")
    bpy.ops.object.modifier_apply(modifier="budget")

after = sum(tri_count(o) for o in meshes)
groups = sum(len(o.vertex_groups) for o in meshes)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_skins=True, export_animations=True)
print(f"POF_DECIMATE_DONE={dst} requested_triangles={budget} before_triangles={before} after_triangles={after} vertex_groups={groups}")
