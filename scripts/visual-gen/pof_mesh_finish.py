"""Headless Blender mesh-finish: high-poly -> game-tier low-poly.

Turns a dense generated mesh (Hunyuan3D / Tripo / TripoSR) into a shippable
low-poly: decimate to a face budget, optionally mirror a symmetric half,
UV-unwrap the DECIMATED mesh only, and bake the high-poly detail down into
normal / AO / base-colour / roughness maps, wired into one Principled material so
the exported GLB is a textured asset rather than a bare mesh beside loose PNGs.

Run:
    blender --background --python pof_mesh_finish.py -- \
        --input hi.glb --output low.glb --target-faces 40000 \
        --mirror x --unwrap --uv-mode pack-existing \
        --bake normal,ao,diffuse,roughness --bake-size 2048

Emits POF_MESHFINISH_* stdout markers consumed by
`src/lib/visual-gen/mesh-finish.ts` (never judge by exit code — Blender's
headless shutdown is noisy).
"""

import argparse
import os
import sys

import bpy


def marker(key, value):
    print("POF_MESHFINISH_%s=%s" % (key, value))
    sys.stdout.flush()


def fail(message):
    marker("ERROR", message)
    sys.exit(0)  # markers are the contract; a non-zero exit adds nothing


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--target-faces", type=int, default=None)
    p.add_argument("--mirror", choices=["x", "y", "z"], default=None)
    p.add_argument("--cull-interior", action="store_true")
    p.add_argument("--unwrap", action="store_true")
    p.add_argument("--uv-mode", choices=["smart", "pack-existing"], default="smart")
    p.add_argument("--bake", default="")
    p.add_argument("--bake-size", type=int, default=1024)
    return p.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def import_mesh(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".glb" or ext == ".gltf":
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        fail("unsupported input extension %s (use .glb/.gltf/.fbx/.obj)" % ext)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        fail("no mesh found in %s" % path)
    return meshes


def join_meshes(meshes):
    """One object to finish — generated parts arrive split."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def face_count(obj):
    return len(obj.data.polygons)


def apply_mirror(obj, axis):
    """Author one half, get the whole: mirror + weld the seam."""
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new(name="pof_mirror", type="MIRROR")
    mod.use_axis = (axis == "x", axis == "y", axis == "z")
    mod.use_clip = True
    mod.use_mirror_merge = True
    bpy.ops.object.modifier_apply(modifier=mod.name)


def loose_shell_count(obj):
    """How many disconnected shells the object holds (parts of an assembled character)."""
    mesh = obj.data
    seen = set()
    shells = 0
    poly_of_vert = {}
    for poly in mesh.polygons:
        for v in poly.vertices:
            poly_of_vert.setdefault(v, []).append(poly.index)
    for poly in mesh.polygons:
        if poly.index in seen:
            continue
        shells += 1
        stack = [poly.index]
        seen.add(poly.index)
        while stack:
            cur = mesh.polygons[stack.pop()]
            for v in cur.vertices:
                for nb in poly_of_vert.get(v, ()):
                    if nb not in seen:
                        seen.add(nb)
                        stack.append(nb)
    return shells


def cull_interior(obj):
    """Delete WELDED interior faces — geometry enclosed within a single continuous shell.

    Scope, measured against Blender 4.2 headless: select_interior_faces selects faces
    whose every edge has more than 2 face users. A small cube fully enclosed inside a
    big one and joined into the same object selects 0 of 12 faces; a welded shared wall
    selects 1. So occlusion between SEPARATE shells — the body under a chest plate, the
    scalp under a helmet — is invisible to this operator, and a 0 here means "no welded
    interior found", never "nothing is hidden". The caller reports the unevaluated shell
    count so that distinction survives to the result.

    Returns how many faces were removed.
    """
    before = face_count(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.mesh.select_mode(type="FACE")
    bpy.ops.mesh.select_interior_faces()
    bpy.ops.mesh.delete(type="FACE")
    bpy.ops.object.mode_set(mode="OBJECT")
    return before - face_count(obj)


def decimate(obj, target_faces):
    current = face_count(obj)
    if current <= target_faces:
        return current
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new(name="pof_decimate", type="DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = max(0.0001, float(target_faces) / float(current))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return face_count(obj)


def unwrap(obj, mode):
    """Lay out the decimated low-poly's UVs.

    'smart' angle-projects a fresh atlas — right when the source has no usable UVs.
    'pack-existing' keeps the islands the source parts already carried and only
    re-packs them into one atlas: joining N textured parts stacks N layouts in the
    same 0-1 space, and re-projecting discards authored seams that beat anything an
    angle limit finds. Falling back is reported, never silent — a caller that asked
    to keep authored UVs must not be told it got them.
    """
    if mode == "pack-existing" and not obj.data.uv_layers:
        marker(
            "UV_MODE_FALLBACK",
            "pack-existing needs authored UVs on the source mesh; none survived the "
            "import/join, so an angle-based smart projection ran instead",
        )
        mode = "smart"

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    if mode == "pack-existing":
        bpy.ops.uv.select_all(action="SELECT")
        bpy.ops.uv.pack_islands(margin=0.02)
    else:
        # Angle-based seams, then unwrap — no hand-placed seams available headless.
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    marker("UV_MODE", mode)


def new_bake_image(name, size, non_color):
    img = bpy.data.images.new(name, width=size, height=size, alpha=False)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def ensure_bake_material(obj):
    """ONE material on the low-poly, reused by every bake.

    Each bake used to build a fresh material and clear the object's slots, so a
    multi-map run exported the mesh wearing only the last map and no base colour at
    all. Bake targets are added as image nodes inside this one material and made
    active per bake instead.
    """
    existing = obj.data.materials[0] if obj.data.materials else None
    if existing is not None and existing.name.startswith("pof_bake_mat"):
        return existing
    mat = bpy.data.materials.new(name="pof_bake_mat")
    mat.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return mat


def bake_target_node(mat, image):
    """Add the destination image node and make it active — Cycles bakes into
    whichever image node is active on the target's material."""
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    node.label = image.name
    mat.node_tree.nodes.active = node
    node.select = True
    return node


def wire_baked_map(mat, node, kind):
    """Connect a finished bake into the Principled BSDF so the exported GLB is a
    real textured asset rather than a bare mesh beside some loose PNGs. AO has no
    Principled socket — glTF carries occlusion separately, so it stays a file."""
    tree = mat.node_tree
    bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return
    if kind == "diffuse":
        tree.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    elif kind == "roughness":
        tree.links.new(node.outputs["Color"], bsdf.inputs["Roughness"])
    elif kind == "normal":
        nm = tree.nodes.new("ShaderNodeNormalMap")
        tree.links.new(node.outputs["Color"], nm.inputs["Color"])
        tree.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])


# Cycles native passes only. Metallic is absent on purpose: it has no bake pass and
# would need an emission re-wire of every source material — `bakePlan` in
# mesh-finish.ts refuses it by name rather than letting a partial set read as full.
BAKE_TYPES = {
    "normal": "NORMAL",
    "ao": "AO",
    "diffuse": "DIFFUSE",
    "roughness": "ROUGHNESS",
}

# Data maps must not be colour-managed; only base colour is sRGB.
NON_COLOR_MAPS = ("normal", "roughness")


def bake_high_to_low(high, low, kind, size, out_dir, stem):
    """Cycles selected-to-active bake: high-poly detail -> low-poly UVs."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8 if kind == "ao" else 1
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.05
    scene.render.bake.use_clear = True
    if kind == "diffuse":
        # Albedo only — lighting baked into base colour double-shades in engine.
        scene.render.bake.use_pass_direct = False
        scene.render.bake.use_pass_indirect = False
        scene.render.bake.use_pass_color = True

    image = new_bake_image("pof_bake_%s" % kind, size, kind in NON_COLOR_MAPS)
    mat = ensure_bake_material(low)
    node = bake_target_node(mat, image)

    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low

    bpy.ops.object.bake(type=BAKE_TYPES[kind])

    path = os.path.join(out_dir, "%s_%s.png" % (stem, kind))
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    wire_baked_map(mat, node, kind)
    return path


def main():
    args = parse_args()
    if not os.path.exists(args.input):
        fail("input mesh not found at %s" % args.input)

    out_dir = os.path.dirname(os.path.abspath(args.output))
    stem = os.path.splitext(os.path.basename(args.output))[0]
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir)

    clear_scene()
    high = join_meshes(import_mesh(args.input))
    if args.mirror:
        apply_mirror(high, args.mirror)
        marker("MIRROR", args.mirror)
    faces_in = face_count(high)
    marker("FACES_IN", faces_in)

    bake_kinds = [k for k in args.bake.split(",") if k]

    # The low-poly is a copy so the high-poly survives as the bake source.
    low = high.copy()
    low.data = high.data.copy()
    low.name = "%s_low" % stem
    bpy.context.collection.objects.link(low)

    # Cull before decimating so the face budget is spent on visible surfaces only.
    # The high-poly keeps its interior faces — it is only ever the bake source.
    if args.cull_interior:
        shells = loose_shell_count(low)
        marker("FACES_CULLED", cull_interior(low))
        marker("CULL_UNEVALUATED_SHELLS", shells)

    faces_out = decimate(low, args.target_faces) if args.target_faces else face_count(low)
    marker("FACES_OUT", faces_out)

    if args.unwrap:
        unwrap(low, args.uv_mode)
        marker("UV", 1 if low.data.uv_layers else 0)
    else:
        marker("UV", 0)

    for kind in bake_kinds:
        if kind not in BAKE_TYPES:
            continue
        try:
            path = bake_high_to_low(high, low, kind, args.bake_size, out_dir, stem)
            marker("BAKE_%s" % kind.upper(), path)
        except Exception as exc:  # a failed bake must not fake a finished mesh
            marker("BAKE_%s_ERROR" % kind.upper(), str(exc))

    # Export the low-poly alone.
    bpy.ops.object.select_all(action="DESELECT")
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        use_selection=True,
    )
    if not os.path.exists(args.output):
        fail("export produced no file at %s" % args.output)

    marker("SIZE_MB", round(os.path.getsize(args.output) / (1024.0 * 1024.0), 2))
    marker("DONE", args.output)


if __name__ == "__main__":
    main()
