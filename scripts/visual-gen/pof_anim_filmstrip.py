"""Headless Blender: import an animated .glb, frame the character, render N frames of the
animation to <outdir>/frame_NN.png (the filmstrip the anim-critique tier expects).
Run: blender --background --python render_anim.py -- <glb> <outdir> <nframes>
"""
import bpy
import sys
import os
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUTDIR, NFRAMES = argv[0], argv[1], int(argv[2]) if len(argv) > 2 else 8
os.makedirs(OUTDIR, exist_ok=True)

# Clean scene.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

# Combined bounds of all mesh objects -> center + size for camera framing.
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
mins = Vector((1e9, 1e9, 1e9)); maxs = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        mins = Vector((min(mins[i], w[i]) for i in range(3)))
        maxs = Vector((max(maxs[i], w[i]) for i in range(3)))
center = (mins + maxs) * 0.5
size = max((maxs - mins).x, (maxs - mins).y, (maxs - mins).z) or 1.0

# Camera: front-3/4, looking at the character center, distance scaled to size.
cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.scene.collection.objects.link(cam)
dist = size * 1.5
cam.location = Vector((center.x + dist * 0.5, center.y - dist, center.z + size * 0.15))
direction = center - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam

# Lights: a key sun + fill.
for name, loc, energy in (("Key", (3, -3, 5), 4.0), ("Fill", (-3, -2, 3), 2.0)):
    ld = bpy.data.lights.new(name, "SUN"); ld.energy = energy
    lo = bpy.data.objects.new(name, ld); lo.location = loc
    lo.rotation_euler = (math.radians(55), 0, math.radians(30))
    bpy.context.scene.collection.objects.link(lo)

# World a touch grey so silhouette reads.
world = bpy.data.worlds.new("W"); bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1)

# Render settings — try EEVEE (4.2 = EEVEE_NEXT), fall back to Workbench.
scene = bpy.context.scene
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
    try:
        scene.render.engine = eng
        break
    except Exception:
        continue
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.image_settings.file_format = "PNG"

# Real animation range = the widest action frame_range among the imported actions
# (NOT scene.frame_end, which defaults to 250 and would sample the frozen post-clip pose).
fstart, fend = None, None
for act in bpy.data.actions:
    a, b = act.frame_range
    fstart = a if fstart is None else min(fstart, a)
    fend = b if fend is None else max(fend, b)
if fstart is None:
    fstart, fend = float(scene.frame_start), float(scene.frame_start) + 24
fstart, fend = int(round(fstart)), int(round(fend))
if fend <= fstart:
    fend = fstart + 24
print(f"POF_RENDER_RANGE={fstart}-{fend}")

# Sample NFRAMES evenly across the clip; skip the very last frame (often == first when looped).
i = 0
span = fend - fstart
for k in range(NFRAMES):
    f = fstart + int(round(span * k / max(1, NFRAMES)))
    scene.frame_set(f)
    scene.render.filepath = os.path.join(OUTDIR, f"frame_{i:02d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"POF_RENDER_FRAME={i} scene_frame={f}")
    i += 1
print(f"POF_RENDER_DONE={i} frames -> {OUTDIR}")
