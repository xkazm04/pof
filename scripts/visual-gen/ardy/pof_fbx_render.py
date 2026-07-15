# PoF: Blender headless — render a UE-exported animation FBX (armature-only) to MP4.
# Builds a box-proxy body from the armature so the retargeted motion is reviewable.
# Usage: blender --background --python pof_fbx_render.py -- <in.fbx> <out.mp4>
import math
import sys

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1 :]
fbx_path, mp4_path = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx_path, automatic_bone_orientation=True)

arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
scene = bpy.context.scene
act = arm.animation_data.action
scene.frame_start, scene.frame_end = int(act.frame_range[0]), max(int(act.frame_range[1]), int(act.frame_range[0]) + 1)
scene.render.fps = 20

# Proxy only the MAIN deform bones — UE skeletons carry ik_/root/twist/finger helper
# bones that render as giant or noisy boxes.
MAIN = (
    "pelvis", "spine", "neck", "head", "clavicle", "upperarm", "lowerarm", "hand",
    "thigh", "calf", "foot", "ball",
    # ARDY/Mixamo-convention names (source-skeleton renders)
    "hips", "leftarm", "rightarm", "leftforearm", "rightforearm", "leftshoulder", "rightshoulder",
    "leftupleg", "rightupleg", "leftleg", "rightleg", "leftfoot", "rightfoot", "lefttoebase", "righttoebase",
)


def is_main(name: str) -> bool:
    n = name.lower()
    if "twist" in n or "ik_" in n or n == "root" or "interaction" in n or "center_of_mass" in n or "gun" in n:
        return False
    return any(n.startswith(p) or n.replace("_l", "").replace("_r", "").startswith(p) for p in MAIN)


main_bones = [pb for pb in arm.pose.bones if is_main(pb.name)]
if not main_bones:
    main_bones = list(arm.pose.bones)
avg_len = sum(pb.bone.length for pb in main_bones) / len(main_bones)
verts_all, faces_all, groups = [], [], []
for pb in main_bones:
    b = pb.bone
    length = max(b.length, avg_len * 0.3)
    r = max(0.14 * length, avg_len * 0.12)
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

bpy.ops.mesh.primitive_plane_add(size=30)
ground = bpy.context.object
gmat = bpy.data.materials.new("Ground")
gmat.diffuse_color = (0.15, 0.16, 0.18, 1)
ground.data.materials.append(gmat)

# track the pelvis/hips bone (NOT bone 0 — UE's bone 0 is the static root)
root_name = next((pb.name for pb in arm.pose.bones if pb.name.lower() in ("pelvis", "hips")), arm.pose.bones[0].name)
target = bpy.data.objects.new("RootTarget", None)
scene.collection.objects.link(target)
con = target.constraints.new("COPY_LOCATION")
con.target = arm
con.subtarget = root_name

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.parent = target
# frame by pelvis height above ground at the first frame (~half the character height)
scene.frame_set(scene.frame_start)
pelvis_pb = arm.pose.bones[root_name]
root_h = max((arm.matrix_world @ pelvis_pb.head).z, 0.5)
cam.location = (root_h * 2.6, -root_h * 2.6, root_h * 1.2)
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
print("POF_RENDER_OK", mp4_path, "bones:", len(arm.pose.bones), "root:", root_name)
