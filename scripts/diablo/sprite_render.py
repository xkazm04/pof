"""
Prerendered-sprite render of a rigged .glb (/diablo W04, decision D16) — Blender headless.

  blender -b -P scripts/diablo/sprite_render.py -- <in.glb> <out_dir> [--size 96] [--frame 1] [--render 384]

Diablo I's look is PRERENDERED: 3D models rendered from ONE fixed diagonal camera and reduced to
sprite resolution. A text-to-image prompt cannot reach it (W03: 0/5). This renders the model the
way the originals were made: an orthographic camera at 30 deg elevation / 45 deg azimuth (a 2:1
ground diamond), the MODEL rotated through 8 directions under the fixed camera, one bounded key
light from the upper left over near-black ambient, transparent background. Each direction is
rendered at --render px and box-downsampled to --size px (the coarse-pixel step), plus a 4x
nearest-neighbour enlargement sheet for review. Prints POF_SPRITE_* markers.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    print("POF_SPRITE_ERROR=usage: -- <in.glb> <out_dir> [--size N] [--frame N] [--render N]")
    sys.exit(2)
src, out_dir = argv[0], argv[1]
opt = {argv[i][2:]: argv[i + 1] for i in range(2, len(argv) - 1) if argv[i].startswith("--")}
SIZE = int(opt.get("size", 96))
# --tint r,g,b: a family RECOLOUR (Diablo's trn palette swap: Zombie/Ghoul/Rotting Carcass share one
# model and differ by palette). Multiplies every material's base colour, so one rigged mesh renders as
# the whole family (/diablo W06).
TINT = [float(x) for x in opt["tint"].split(",")] if opt.get("tint") else None
FRAME = int(opt.get("frame", 1))
RENDER = int(opt.get("render", 384))
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
scene.frame_set(FRAME)

# Everything imported is parented under one pivot so the model (not the camera) turns.
pivot = bpy.data.objects.new("pivot", None)
scene.collection.objects.link(pivot)
for ob in list(scene.objects):
    if ob is not pivot and ob.parent is None:
        ob.parent = pivot

meshes = [o for o in scene.objects if o.type == "MESH"]
if TINT:
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            base = node.inputs["Base Color"]
            if base.is_linked:
                src = base.links[0].from_socket
                mix = mat.node_tree.nodes.new("ShaderNodeMixRGB")
                mix.blend_type = "MULTIPLY"
                mix.inputs[0].default_value = 1.0
                mix.inputs[2].default_value = (TINT[0], TINT[1], TINT[2], 1.0)
                mat.node_tree.links.new(src, mix.inputs[1])
                mat.node_tree.links.new(mix.outputs[0], base)
            else:
                c = base.default_value
                base.default_value = (c[0] * TINT[0], c[1] * TINT[1], c[2] * TINT[2], c[3])
if not meshes:
    print("POF_SPRITE_ERROR=no mesh in the glb")
    sys.exit(1)
bpy.context.view_layer.update()


def box(points):
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


# The FIGURE is what the rig deforms. W07: Tripo's rigged export carries a stray, unparented 2.0-unit
# `Icosphere` beside a 1.0-tall figure (in the zombie's glb too); framing on every mesh fit the sphere,
# the skeleton filled a third of the frame, its bones smeared at 96 px and the blind family check read
# it as a zombie. Other meshes are hidden from the render and named, never silently framed.
skinned = [o for o in meshes if any(m.type == "ARMATURE" for m in o.modifiers)]
if skinned:
    for o in meshes:
        if o not in skinned:
            o.hide_render = True
            print(f"POF_SPRITE_EXCLUDED={o.name} (not deformed by the rig)")
    meshes = skinned
# ...and frame it POSED, from its evaluated vertices — `bound_box` is the rest pose.
rest_lo, rest_hi = box([o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box])
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in meshes:
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    pts += [ev.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
lo, hi = box(pts)
center = (lo + hi) / 2
height = hi.z - lo.z
extent = max(hi.x - lo.x, hi.y - lo.y, height)
print(f"POF_SPRITE_BOUNDS=rest_height={rest_hi.z - rest_lo.z:.3f} posed_height={height:.3f} posed_extent={extent:.3f}")

# Fixed camera: orthographic, 30 deg elevation, 45 deg azimuth -> 2:1 ground diamond.
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = height * 1.25  # frame the FIGURE: the full extent left it a quarter of the frame (r1)
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
elev, azim, dist = math.radians(30), math.radians(45), extent * 4
cam.location = center + Vector((math.cos(elev) * math.sin(azim), -math.cos(elev) * math.cos(azim), math.sin(elev))) * dist
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# One bounded key light from the upper left; near-black world (d1-lighting).
key = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
key.data.energy = 7.0
key.rotation_euler = (math.radians(50), 0, math.radians(-135))
scene.collection.objects.link(key)
# Weak cool fill from the opposite side so the dark side keeps a readable edge (r1 was near-black).
fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
fill.data.energy = 1.2
fill.rotation_euler = (math.radians(60), 0, math.radians(45))
scene.collection.objects.link(fill)
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.01, 0.012, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.3
scene.world = world

scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = RENDER
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

full = []
for d in range(8):
    pivot.rotation_euler = (0, 0, math.radians(-45 * d))
    path = os.path.join(out_dir, f"dir{d}_full.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    full.append(path)

# Downsample (box) to sprite size, then a 4x nearest-neighbour review sheet.
for d, path in enumerate(full):
    img = bpy.data.images.load(path)
    img.scale(SIZE, SIZE)
    img.filepath_raw = os.path.join(out_dir, f"dir{d}.png")
    img.file_format = "PNG"
    img.save()
print(f"POF_SPRITE_DONE={out_dir} directions=8 size={SIZE} render={RENDER} frame={FRAME} height={height:.3f} verts={sum(len(o.data.vertices) for o in meshes)}")
