# PoF: Blender headless — import ARDY BVH, render a filmstrip (scramble check), export FBX.
# Usage: blender --background --python pof_bvh_blender.py -- <in.bvh> <out.fbx> <strip.png>
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
bvh_path, fbx_path, strip_path = argv[0], argv[1], argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)

bpy.ops.import_anim.bvh(
    filepath=bvh_path,
    axis_forward="-Z",
    axis_up="Y",
    update_scene_fps=True,
    update_scene_duration=True,
)
arm = bpy.context.object
scene = bpy.context.scene
n_frames = scene.frame_end - scene.frame_start + 1

# --- filmstrip: 6 frames, OpenGL-free stills via EEVEE
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x, scene.render.resolution_y = 360, 420
scene.render.image_settings.file_format = "PNG"

# camera + light aimed at the armature
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
light = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", type="SUN"))
scene.collection.objects.link(light)
light.rotation_euler = (math.radians(45), 0, math.radians(30))

# stick-figure visibility: bones as octahedral in solid render need a mesh; use "stick" armature display + workbench-like matcap isn't rendered by eevee.
# Simplest robust visual: skin the armature with Skin-like bone meshes via bpy.ops.object.armature display? Instead: create a thin mesh per bone parented to it.
import mathutils


# Build ONE skinned proxy mesh (a box per bone, 100% weighted to it) so the FBX
# imports into UE as a real SkeletalMesh + Skeleton + AnimSequence.
verts_all, faces_all, groups = [], [], []
for pb in arm.pose.bones:
    b = pb.bone
    length = max(b.length, 0.03)
    r = 0.03
    base = len(verts_all)
    # box in BONE space (Y along the bone), transformed to armature space by the REST matrix
    local = [(-r, 0, -r), (r, 0, -r), (r, 0, r), (-r, 0, r), (-r, length, -r), (r, length, -r), (r, length, r), (-r, length, r)]
    m = b.matrix_local
    verts_all += [tuple(m @ mathutils.Vector(v)) for v in local]
    faces_all += [tuple(base + i for i in f) for f in [(0, 1, 2, 3), (7, 6, 5, 4), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]]
    groups.append((pb.name, list(range(base, base + 8))))

mesh = bpy.data.meshes.new("ProxyBody")
mesh.from_pydata(verts_all, [], faces_all)
proxy = bpy.data.objects.new("ProxyBody", mesh)
scene.collection.objects.link(proxy)
proxy.parent = arm
for name, vidx in groups:
    vg = proxy.vertex_groups.new(name=name)
    vg.add(vidx, 1.0, "REPLACE")
mod = proxy.modifiers.new("Armature", "ARMATURE")
mod.object = arm

picks = [scene.frame_start + int(i * (n_frames - 1) / 5) for i in range(6)]
tiles = []
for i, f in enumerate(picks):
    scene.frame_set(f)
    # frame the armature root each pick
    hips = arm.pose.bones[0]
    target = arm.matrix_world @ hips.head
    cam.location = target + mathutils.Vector((2.6, -2.6, 1.4))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = strip_path.replace(".png", f"_{i}.png")
    bpy.ops.render.render(write_still=True)
    tiles.append(scene.render.filepath)

# --- FBX export (UE conventions: no leaf bones, bake anim)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
proxy.select_set(True)  # the skinned mesh must be IN the export or UE sees no skeletal mesh
bpy.context.view_layer.objects.active = arm
# clamp the bake range to the actual clip (BVH import leaves scene_end at the default 250)
act = arm.animation_data.action
scene.frame_start, scene.frame_end = int(act.frame_range[0]), int(act.frame_range[1])
bpy.ops.export_scene.fbx(
    filepath=fbx_path,
    use_selection=True,
    add_leaf_bones=False,
    bake_anim=True,
    bake_anim_use_all_actions=False,
    bake_anim_use_nla_strips=False,
    object_types={"ARMATURE", "MESH"},
)
print("POF_BLENDER_OK", fbx_path, "tiles:", len(tiles))
