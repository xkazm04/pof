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
import math
import os
import sys
from array import array

import bpy


# Above this face count the interior cull is REFUSED outright rather than attempted.
#
# The cull runs before decimation, i.e. on the full-density generated mesh — 1.5M faces
# is a normal input here (`FACES_IN=1500000` is the shape of a real run). Two costs scale
# with that count and only one of them is ours to bound: `loose_shell_count` below is now
# fixed-width and cheap, but `bpy.ops.mesh.select_interior_faces` builds a BMesh of the
# whole undecimated mesh inside Blender's own allocator, which this script cannot cap.
#
# Refusing costs nothing measurable: `select_interior_faces` sees only WELDED interior,
# and generated assets arrive as SEPARATE shells (measured Blender 4.2, 2026-08-09: an
# enclosed separate shell selects 0 of 12 faces), so on exactly the meshes that are large
# enough to hit this ceiling the cull's yield has been zero. Saying so beats spending the
# memory to rediscover it.
CULL_FACE_CEILING = 200_000


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
    p.add_argument("--retopo", choices=["collapse", "quadriflow"], default="collapse")
    p.add_argument("--mirror", choices=["x", "y", "z"], default=None)
    p.add_argument("--cull-interior", action="store_true")
    p.add_argument("--smooth-angle", type=float, default=0.0)
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
    """How many disconnected shells the object holds (parts of an assembled character).

    Vertex-connected components: two polygons are in the same shell when they share a
    vertex, directly or transitively. That is the same relation the previous version
    computed, so the number this returns is unchanged.

    What changed is the memory. This used to build `poly_of_vert` — a Python dict mapping
    EVERY vertex to a Python list of EVERY polygon touching it — and then BFS from each
    polygon with a `seen` set and a `stack` list. On a 1.5M-face mesh (the ordinary input
    here: the caller runs this on the undecimated high-poly copy) that materialises
    ~750k dict entries, ~750k list objects and several million boxed ints: hundreds of MB
    to GBs, growing with how tangled the mesh is. It is the same unbounded per-element
    materialisation as the `trimesh.Trimesh.split()` call that reached 211 GB and crashed
    the host on 2026-08-18.

    Now it is union-find over two arrays sized ONCE, before the walk, from counts that are
    already known: one signed 32-bit slot per vertex and one per polygon. At 1.5M faces /
    ~750k verts that is ~9 MB total, and it does not grow with connectivity — no dict, no
    per-vertex list, no BFS stack, no recursion. Worst case is a mesh where every polygon
    touches every other; the arrays are the same size.
    """
    mesh = obj.data
    n_faces = len(mesh.polygons)
    n_verts = len(mesh.vertices)
    if n_faces == 0:
        return 0

    # parent[f] = f  (each polygon starts as its own shell). The "~9 MB" above assumes
    # array("i") is 4 bytes, which it is on every CPython build Blender ships; the module
    # only guarantees >= 2. On a hypothetical 2-byte build an index past 32767 raises
    # OverflowError on assignment — the walk fails loudly, it does not corrupt or grow.
    parent = array("i", range(n_faces))
    # -1 = no polygon has claimed this vertex yet. `array * n` repeats at C level.
    first_face_of_vert = array("i", [-1]) * n_verts

    def find(x):
        # Path halving: iterative (no recursion depth to blow), no extra allocation.
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for poly in mesh.polygons:
        idx = poly.index
        for v in poly.vertices:
            claimed = first_face_of_vert[v]
            if claimed < 0:
                first_face_of_vert[v] = idx
                continue
            a = find(idx)
            b = find(claimed)
            if a != b:
                # Union by index keeps the result deterministic run to run.
                if a < b:
                    parent[b] = a
                else:
                    parent[a] = b

    shells = 0
    for i in range(n_faces):
        if find(i) == i:
            shells += 1
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


def quad_count(obj):
    """Quads in the mesh RIGHT NOW. Only meaningful before the GLB export, which
    triangulates (glTF 2.0 has no quad primitive)."""
    return sum(1 for p in obj.data.polygons if len(p.vertices) == 4)


def nonmanifold_edge_count(obj):
    """Edges not shared by exactly two faces. QuadriFlow's hard precondition."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    n = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    return n


def prepare_for_quadriflow(obj):
    """Make an imported mesh eligible for QuadriFlow -> residual non-manifold edges.

    Measured on Blender 4.2.1: a mesh imported from GLB is ALWAYS non-manifold on
    arrival, even when its author was watertight, because glTF stores attributes
    per-vertex and therefore SPLITS every vertex on a UV/normal seam. A clean displaced
    ico-sphere exported to GLB and re-imported showed 61,434 non-manifold edges. Welding
    those seam duplicates took it back to 0 and QuadriFlow then produced an all-quad
    mesh; without the weld it silently did nothing.

    Custom split normals are cleared first for the same reason `apply_shading` reasons
    about them — but here it costs nothing: QuadriFlow REPLACES the topology, so normals
    authored against vertices that are about to be deleted carry no information forward.
    (That is the opposite of the re-shading case, where clearing them destroys the
    source's better normals — hence `shadingSkippedReason`.)
    """
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)      # re-weld glTF's seam-split verts
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return nonmanifold_edge_count(obj)


def quad_retopo(obj, target_faces):
    """Field-aligned QuadriFlow remesh -> (faces, quads_authored, fallback_reason).

    Returns a fallback_reason (leaving the caller to collapse-decimate instead) when
    QuadriFlow cannot run. It is far less robust than edge-collapse: it requires a
    manifold surface with consistent normals, so a shattered multi-shell generator mesh
    is exactly the input it fails on. A silent downgrade to collapse would be the same
    lie class SHADING_SKIPPED and UV_MODE_FALLBACK exist to prevent, so the reason is
    always reported — with the measured non-manifold edge count, which is the actionable
    number (and the same defect the Tier-1 gate already reports as `not-watertight`).

    NOTE: the repair pass mutates the mesh before the attempt, so a run that falls back
    collapse-decimates a WELDED mesh rather than the raw import. That is a better input
    for decimation, not a worse one, but it does mean `--retopo quadriflow` is not
    byte-identical to `--retopo collapse` even when it falls back.
    """
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    before = face_count(obj)
    residual = prepare_for_quadriflow(obj)
    if residual:
        return (
            None,
            0,
            "mesh is genuinely non-manifold after repair (%d non-manifold edges remain; "
            "seam-weld and normal-consistency passes already ran) — QuadriFlow requires a "
            "manifold surface and silently no-ops without one; fell back to collapse" % residual,
        )
    try:
        result = bpy.ops.object.quadriflow_remesh(
            mode="FACES",
            target_faces=int(target_faces),
            use_preserve_sharp=True,
            use_preserve_boundary=True,
            use_mesh_symmetry=False,
        )
    except Exception as exc:  # operator raised (zero-area, cancelled)
        return None, 0, "quadriflow raised on this input (%s); fell back to collapse" % exc
    if "FINISHED" not in result:
        return None, 0, "quadriflow returned %s on this input; fell back to collapse" % ("/".join(result) or "nothing")

    # DO NOT TRUST THE RETURN VALUE. Measured on Blender 4.2.1 against real Tripo output
    # (generated/tripo3d/jinx_hd_idle.glb, 1,492,072 faces): on a NON-MANIFOLD mesh the
    # operator logs "QuadriFlow: The mesh needs to be manifold and have face normals that
    # point in a consistent direction", changes nothing at all, and STILL returns
    # {'FINISHED'}. Reporting that as a quadriflow run delivered a 43MB unreduced mesh
    # labelled as retopologized — a silent no-op wearing a success marker. The artifact is
    # the only honest signal, so success is judged by what the mesh actually became.
    after = face_count(obj)
    quads = quad_count(obj)
    if quads == 0 or after == before:
        return (
            None,
            0,
            "quadriflow reported success but did not alter the mesh (%d faces, %d quads) — "
            "the operator silently no-ops on non-manifold input with inconsistent normals, "
            "which most raw generator output is; fell back to collapse" % (after, quads),
        )
    if after == 0:
        return None, 0, "quadriflow produced an empty mesh; fell back to collapse"
    return after, quads, None


def apply_shading(obj, angle_deg):
    """Auto-smooth the low-poly by crease angle — but only when nothing better exists.

    Measured on Blender 4.2 against real Tripo output: a generated .glb arrives with
    CUSTOM SPLIT NORMALS already set and every polygon already smooth, and custom
    normals override the smooth flag — so shade_auto_smooth is a silent no-op there
    (0 of 30,967 exported normals changed). Clearing them first does make it bite, and
    that is exactly why this refuses to: on the same mesh it rewrote 99.9% of normals by
    a mean of 73 degrees (max 179, i.e. flipped). Those normals carry the generator's own
    surface information; a 30-degree crease guess is worse information, not better.

    So the rule is: re-shade only a mesh that has no custom normals to lose — which is
    the .obj/.fbx-without-normals case that genuinely imports faceted — and report the
    refusal otherwise rather than claiming a shading pass that changed nothing.

    Returns (applied, detail).
    """
    if obj.data.has_custom_normals:
        return (False, "source carries custom split normals (they override any crease "
                       "angle); re-shading would discard the generator's own surface "
                       "information for a guess")

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    # Blender 4.1 replaced the use_auto_smooth mesh flag with this operator; fall back to
    # a plain shade_smooth and report which ran, so the angle is never assumed honoured.
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle_deg))
        return (True, "auto_smooth@%g" % angle_deg)
    except (AttributeError, RuntimeError, TypeError):
        bpy.ops.object.shade_smooth()
        return (True, "smooth_all")


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


# A face whose texel density differs from the mesh median by more than this FACTOR is
# counted as stretched. The unit is deliberately a ratio, not an angle: what a bake
# actually loses to a bad unwrap is resolution, and resolution scales with UV area per
# unit of surface area. 2.0 = the face receives half (or twice) the texels of a typical
# face, which is the band Blender's own "UV stretch (area)" view starts painting red.
UV_STRETCH_BAD_FACTOR = 2.0


def uv_stretch_stats(obj):
    """Measure how evenly the UV layout distributes texels over the surface.

    `UV=1` only ever said a UV LAYER EXISTS. Every bake this script then runs -- normal,
    AO, diffuse, roughness -- writes into that layout, so a layout that squashes a face
    into a sliver silently degrades all four maps at once, and the run still reports a
    finished mesh with four map paths. This is the number that distinguishes them.

    Per triangle, scale = sqrt(uv_area / world_area) is its texel density. Dividing by
    the mesh MEDIAN makes it relative and unit-free, so the result is comparable across
    assets of any size and any bake resolution -- a mesh is not penalised for being small,
    only for being INCONSISTENT with itself, which is the thing a single square atlas
    cannot compensate for.

    Distortion is reported as max(r, 1/r) so squashed and blown-up faces are equally bad,
    and degenerate faces (zero UV area) are counted separately rather than folded into a
    percentile: they are not "stretched", they are unbakeable, and an average would hide
    them.
    """
    mesh = obj.data
    uv_layer = mesh.uv_layers.active
    if uv_layer is None:
        return None

    mesh.calc_loop_triangles()
    tris = mesh.loop_triangles
    if not tris:
        return None

    verts = mesh.vertices
    uvs = uv_layer.data
    scales = []
    degenerate = 0

    for tri in tris:
        a, b, c = (verts[i].co for i in tri.vertices)
        world = (b - a).cross(c - a).length * 0.5
        l0, l1, l2 = tri.loops
        ua, ub, uc = uvs[l0].uv, uvs[l1].uv, uvs[l2].uv
        uv_area = abs((ub.x - ua.x) * (uc.y - ua.y) - (uc.x - ua.x) * (ub.y - ua.y)) * 0.5
        # A world-degenerate triangle carries no surface to texture; it is a decimation
        # artefact, not a UV defect, so it is excluded rather than blamed on the unwrap.
        if world <= 0.0:
            continue
        if uv_area <= 0.0:
            degenerate += 1
            continue
        scales.append(math.sqrt(uv_area / world))

    if not scales:
        return None

    scales.sort()
    median = scales[len(scales) // 2]
    if median <= 0.0:
        return None

    distortion = sorted(max(s / median, median / s) for s in scales)
    p95 = distortion[min(len(distortion) - 1, int(len(distortion) * 0.95))]
    bad = sum(1 for d in distortion if d > UV_STRETCH_BAD_FACTOR)
    total = len(distortion) + degenerate
    return {
        "p95": p95,
        "bad_frac": bad / float(total),
        "degenerate": degenerate,
    }


def emit_uv_stretch(obj):
    """Report the layout quality, or say why there is no number -- never stay silent."""
    stats = uv_stretch_stats(obj)
    if stats is None:
        marker("UV_STRETCH_UNMEASURED", "no active UV layer or no triangles to measure")
        return
    marker("UV_STRETCH_P95", "%.4f" % stats["p95"])
    marker("UV_STRETCH_BAD_FRAC", "%.4f" % stats["bad_frac"])
    marker("UV_STRETCH_DEGENERATE", stats["degenerate"])


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
        # `low` is still `high.data.copy()` here — the FULL-DENSITY mesh. Check its size
        # before touching it; a refusal that says why is the contract, never a silent skip
        # and never an attempt that the host has to survive.
        cull_faces = face_count(low)
        if cull_faces > CULL_FACE_CEILING:
            marker(
                "CULL_REFUSED",
                "interior cull refused at %d faces (ceiling %d): the cull runs before "
                "decimation, so select_interior_faces would build a BMesh of the whole "
                "undecimated mesh — memory this script cannot bound. It would also almost "
                "certainly remove nothing: it selects only WELDED interior and generated "
                "meshes this large arrive as separate shells. Nothing was culled and no "
                "shell count was computed."
                % (cull_faces, CULL_FACE_CEILING),
            )
        else:
            shells = loose_shell_count(low)
            marker("FACES_CULLED", cull_interior(low))
            marker("CULL_UNEVALUATED_SHELLS", shells)

    # Retopo. `collapse` (default) is the original edge-collapse decimate; `quadriflow`
    # authors regular, curvature-aligned topology first and falls back to collapse — out
    # loud — when the operator cannot handle the input. The mode ACTUALLY applied is
    # reported, never the mode requested.
    if args.target_faces:
        quads_authored = 0
        mode_used = "collapse"
        if args.retopo == "quadriflow":
            qf_faces, quads_authored, fallback = quad_retopo(low, args.target_faces)
            if fallback:
                marker("RETOPO_FALLBACK", fallback)
            else:
                mode_used = "quadriflow"
                faces_out = qf_faces
        if mode_used == "collapse":
            faces_out = decimate(low, args.target_faces)
        marker("RETOPO", mode_used)
        if mode_used == "quadriflow":
            # Counted here, before the export triangulates it — afterwards it is 0 and
            # the number would be a lie about what the remesher produced.
            marker("QUADS_AUTHORED", quads_authored)
    else:
        faces_out = face_count(low)
    marker("FACES_OUT", faces_out)

    # After decimation (which destroys the source normals) and before the bake, whose
    # tangent-space normal map is computed against the low-poly's shading.
    if args.smooth_angle > 0:
        shaded, detail = apply_shading(low, args.smooth_angle)
        marker("SHADING" if shaded else "SHADING_SKIPPED", detail)

    if args.unwrap:
        unwrap(low, args.uv_mode)
        marker("UV", 1 if low.data.uv_layers else 0)
        if low.data.uv_layers:
            emit_uv_stretch(low)
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
