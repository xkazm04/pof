"""Headless Blender: import a .glb and render it from N yaws around the vertical axis,
so something can finally LOOK at a generated mesh.

    blender --background --factory-startup --python pof_mesh_views.py -- \
        <glb> <outdir> [--views 6] [--res 512]

Forked from pof_anim_filmstrip.py's framing block (bounds -> centre -> camera distance),
with the animation loop replaced by a camera orbit.

Two consumers, one render:
  * the unseen-side gate (view-critique.ts) needs a LIT view a vision model can judge —
    a smeared back face has to look wrong;
  * kit colour coherence (kit-coherence.ts) needs each member's dominant colours.

The palette comes from a SECOND, unlit pass, not from the lit view. Measured on
props__crate.glb: under the three-point rig the front yaws quantise to #c7b7b7 and the
shadowed yaws to #585858 — the same crate, the same texture, a palette that swings with
the lighting. That is systematic across members only while their SHAPES match; a tall
plank and a cube catch the key light differently, so a lit palette would report two
same-textured props as drifting. A Workbench flat/texture pass removes the light from
the measurement entirely. It is cheap (no ray tracing) and it is the difference between
a gate that measures colour and one that measures shadow.

The palette is measured here rather than in the app because Blender already ships numpy,
so no image-decoding dependency enters the Node side.

Markers (one line each, the protocol every PoF script uses):
    POF_VIEWS_<i>=<yawDeg>|<path>|<#rrggbb,...>
    POF_VIEWS_DONE=<n>
    POF_VIEWS_ERROR=<message>
"""
import bpy
import sys
import os
import math
from mathutils import Vector

# Palette knobs. 4 colours is enough to characterise a prop without turning noise into
# signal; 16 levels per channel keeps near-identical shades in one bin.
PALETTE_SIZE = 4
QUANT_LEVELS = 16
# Below this alpha a pixel is background, not the asset. The film is transparent, so the
# test is exact rather than a colour-key guess.
ALPHA_FLOOR = 0.5


def fail(message):
    print("POF_VIEWS_ERROR=%s" % message)
    sys.exit(0)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(argv) < 2:
        fail("usage: <glb> <outdir> [--views N] [--res R]")
    glb, outdir = argv[0], argv[1]
    views, res = 6, 512
    for i, a in enumerate(argv):
        if a == "--views" and i + 1 < len(argv):
            views = int(argv[i + 1])
        elif a == "--res" and i + 1 < len(argv):
            res = int(argv[i + 1])
    return glb, outdir, max(2, views), max(64, res)


def linear_to_srgb(c):
    """Blender hands back scene-linear floats; a palette must be display-referred or the
    hex values will not match what anyone sees."""
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def palette_of(path):
    """Dominant colours of the opaque pixels, as hex. Empty list when nothing is opaque."""
    try:
        import numpy as np
    except ImportError:
        return []
    img = None
    try:
        img = bpy.data.images.load(path)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
        opaque = px[px[:, 3] > ALPHA_FLOOR][:, :3]
        if opaque.shape[0] == 0:
            return []
        srgb = np.clip(np.vectorize(linear_to_srgb)(np.clip(opaque, 0.0, 1.0)), 0.0, 1.0)
        q = np.minimum((srgb * QUANT_LEVELS).astype(np.int32), QUANT_LEVELS - 1)
        keys = q[:, 0] * QUANT_LEVELS * QUANT_LEVELS + q[:, 1] * QUANT_LEVELS + q[:, 2]
        uniq, counts = np.unique(keys, return_counts=True)
        top = uniq[np.argsort(-counts)][:PALETTE_SIZE]
        out = []
        for k in top:
            r, g, b = (k // (QUANT_LEVELS * QUANT_LEVELS)), (k // QUANT_LEVELS) % QUANT_LEVELS, k % QUANT_LEVELS
            # Bin CENTRE, not its floor — the floor biases every colour dark.
            vals = [int(min(255, round((v + 0.5) / QUANT_LEVELS * 255))) for v in (r, g, b)]
            out.append("#%02x%02x%02x" % tuple(vals))
        return out
    except Exception:
        return []
    finally:
        if img is not None:
            try:
                bpy.data.images.remove(img)
            except Exception:
                pass


def main():
    glb, outdir, nviews, res = parse_args()
    if not os.path.isfile(glb):
        fail("mesh not found at %s" % glb)
    os.makedirs(outdir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=glb)
    except Exception as exc:
        fail("glb import failed: %s" % exc)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        fail("no mesh objects in %s" % os.path.basename(glb))

    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            mins = Vector((min(mins[i], w[i]) for i in range(3)))
            maxs = Vector((max(maxs[i], w[i]) for i in range(3)))
    center = (mins + maxs) * 0.5
    size = max((maxs - mins).x, (maxs - mins).y, (maxs - mins).z) or 1.0

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    # Lights ride WITH the camera would bias each yaw differently; a fixed three-point rig
    # keeps the comparison between yaws (and between kit members) honest.
    for name, loc, energy in (("Key", (3, -3, 5), 4.0), ("Fill", (-3, -2, 3), 2.0), ("Rim", (0, 4, 3), 2.0)):
        ld = bpy.data.lights.new(name, "SUN")
        ld.energy = energy
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = (math.radians(55), 0, math.radians(30))
        bpy.context.scene.collection.objects.link(lo)

    world = bpy.data.worlds.new("W")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1)

    scene = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = eng
            break
        except Exception:
            continue
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # Transparent film is what makes the palette exact: alpha separates asset from
    # background with no colour-key heuristic.
    scene.render.film_transparent = True

    dist = size * 1.9
    elev = math.radians(20.0)

    def place(i):
        yaw = 360.0 * i / nviews
        a = math.radians(yaw)
        cam.location = Vector((
            center.x + dist * math.cos(a) * math.cos(elev),
            center.y + dist * math.sin(a) * math.cos(elev),
            center.z + dist * math.sin(elev),
        ))
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        return yaw

    # Pass 1 — the LIT views the vision gate judges.
    paths, yaws = [], []
    for i in range(nviews):
        yaws.append(place(i))
        path = os.path.normpath(os.path.join(outdir, "view_%02d.png" % i))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        paths.append(path)

    # Pass 2 — unlit flat/texture, for the palette only. Deleted afterwards: it is a
    # measurement instrument, not a deliverable, and leaving it would let a caller grade
    # the wrong image.
    palettes = [[] for _ in range(nviews)]
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
        shading = scene.display.shading
        shading.light = "FLAT"
        shading.color_type = "TEXTURE"
        for i in range(nviews):
            place(i)
            flat = os.path.normpath(os.path.join(outdir, "_flat_%02d.png" % i))
            scene.render.filepath = flat
            bpy.ops.render.render(write_still=True)
            palettes[i] = palette_of(flat)
            try:
                os.remove(flat)
            except OSError:
                pass
    except Exception as exc:
        # An unusable palette pass must not fail the render — the lit views are the
        # primary product. Say nothing rather than emit a lit palette as if it were flat.
        print("POF_VIEWS_PALETTE_SKIPPED=%s" % exc)

    for i in range(nviews):
        print("POF_VIEWS_%d=%.1f|%s|%s" % (i, yaws[i], paths[i], ",".join(palettes[i])))

    print("POF_VIEWS_DONE=%d" % nviews)


main()
