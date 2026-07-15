# PoF: Blender headless — render an ARDY BVH clip to MP4 (camera tracks the hips).
# Usage: blender --background --python pof_bvh_render.py -- <in.bvh> <out.mp4>
import math
import sys

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1 :]
bvh_path, mp4_path = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_anim.bvh(
    filepath=bvh_path, axis_forward="-Z", axis_up="Y", update_scene_fps=True, update_scene_duration=True
)
arm = bpy.context.object
scene = bpy.context.scene
act = arm.animation_data.action
scene.frame_start, scene.frame_end = int(act.frame_range[0]), int(act.frame_range[1])

# skinned-look proxy: box per bone at rest, deformed by the armature
verts_all, faces_all, groups = [], [], []
for pb in arm.pose.bones:
    b = pb.bone
    length, r = max(b.length, 0.03), 0.03
    base = len(verts_all)
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
proxy.modifiers.new("Armature", "ARMATURE").object = arm

# ground plane for spatial reference
bpy.ops.mesh.primitive_plane_add(size=30)
ground = bpy.context.object
gmat = bpy.data.materials.new("Ground")
gmat.diffuse_color = (0.15, 0.16, 0.18, 1)
ground.data.materials.append(gmat)

# hips-tracking rig: empty copies the hips bone location; camera is parented with an offset + Track To
target = bpy.data.objects.new("HipsTarget", None)
scene.collection.objects.link(target)
con = target.constraints.new("COPY_LOCATION")
con.target = arm
con.subtarget = arm.pose.bones[0].name

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.parent = target
cam.location = (3.2, -3.2, 1.6)
track = cam.constraints.new("TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"

light = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", type="SUN"))
scene.collection.objects.link(light)
light.rotation_euler = (math.radians(50), 0, math.radians(30))
light.data.energy = 3

scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x, scene.render.resolution_y = 960, 720
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.filepath = mp4_path
bpy.ops.render.render(animation=True)
print("POF_RENDER_OK", mp4_path)
