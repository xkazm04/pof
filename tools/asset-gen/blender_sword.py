"""Parametric game-ready sword generator (Blender 4.x, headless).

Part of the PoF idea->UE pipeline: a 2D concept is MEASURED (silhouette proportions + palette)
and this script builds a low-poly sword matching those parameters, with everything UE needs:
  - origin at the GRIP CENTER (hand attach point), blade along +Z
  - 4 named material slots (M_SwordBlade/M_SwordGuard/M_SwordGrip/M_SwordRunes) with the
    concept palette as base colors (FBX carries them -> UE auto-creates materials)
  - empties named SOCKET_Base / SOCKET_Tip at the blade root/tip -> UE FBX import converts
    "SOCKET_"-prefixed objects into StaticMesh sockets (used by melee hit-detection traces)
  - low-poly (~600 tris), 1 UV channel (smart-project), meters -> exported for UE cm

Run:  blender -b --python blender_sword.py -- --out C:/path/sword.fbx [--params JSON]
Params JSON keys (meters/0-1 rgb): blade_len, blade_w, guard_span, grip_len,
  col_blade, col_guard, col_grip, col_runes
"""
import bpy
import json
import math
import sys


def args_after_dashdash():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def parse_args():
    a = args_after_dashdash()
    out = "C:/Users/kazda/AppData/Local/Temp/sword.fbx"
    params = {}
    i = 0
    while i < len(a):
        if a[i] == "--out":
            out = a[i + 1]; i += 2
        elif a[i] == "--params":
            params = json.loads(a[i + 1]); i += 2
        elif a[i] == "--params-file":  # robust on Windows (PS strips quotes from inline JSON)
            with open(a[i + 1]) as fh:
                params = json.load(fh)
            i += 2
        else:
            i += 1
    return out, params


P = {
    "blade_len": 0.82, "blade_w": 0.05, "blade_t": 0.012,
    "guard_span": 0.27, "guard_h": 0.045, "guard_t": 0.03,
    "grip_len": 0.18, "grip_r": 0.017, "pommel_r": 0.030,
    "col_blade": (0.08, 0.13, 0.13, 1.0),
    "col_guard": (0.35, 0.24, 0.10, 1.0),
    "col_grip": (0.09, 0.06, 0.05, 1.0),
    "col_runes": (0.05, 0.85, 0.75, 1.0),
}


def mat(name, color, emission=0.0, metallic=0.0, roughness=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission > 0:
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = emission
    return m


def build():
    out_path, overrides = parse_args()
    P.update(overrides)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    col = bpy.context.collection

    mats = {
        "M_SwordBlade": mat("M_SwordBlade", P["col_blade"], metallic=0.9, roughness=0.35),
        "M_SwordGuard": mat("M_SwordGuard", P["col_guard"], metallic=0.8, roughness=0.45),
        "M_SwordGrip": mat("M_SwordGrip", P["col_grip"], metallic=0.0, roughness=0.9),
        "M_SwordRunes": mat("M_SwordRunes", P["col_runes"], emission=4.0, roughness=0.4),
    }

    objs = []
    grip_half = P["grip_len"] / 2.0
    blade_z0 = grip_half + P["guard_t"]          # blade starts above the guard
    blade_z1 = blade_z0 + P["blade_len"]

    # --- Blade: diamond cross-section rings tapering to a point (manual mesh) ---
    rings_cfg = [(0.00, 1.00), (0.45, 0.92), (0.80, 0.70), (0.96, 0.42)]
    verts, faces = [], []
    for frac, wmul in rings_cfg:
        z = blade_z0 + P["blade_len"] * frac
        w = (P["blade_w"] / 2) * wmul
        t = (P["blade_t"] / 2) * wmul
        verts += [(-w, 0, z), (0, -t, z), (w, 0, z), (0, t, z)]
    tip = len(verts)
    verts.append((0, 0, blade_z1))
    for r in range(len(rings_cfg) - 1):
        b = r * 4
        for k in range(4):
            faces.append([b + k, b + (k + 1) % 4, b + 4 + (k + 1) % 4, b + 4 + k])
    b = (len(rings_cfg) - 1) * 4
    for k in range(4):
        faces.append([b + k, b + (k + 1) % 4, tip])
    base = b0 = 0
    for k in range(4):  # cap the blade root
        pass
    faces.append([3, 2, 1, 0])
    me = bpy.data.meshes.new("Blade")
    me.from_pydata(verts, [], faces)
    me.update()
    blade = bpy.data.objects.new("Blade", me)
    col.objects.link(blade)
    blade.data.materials.append(mats["M_SwordBlade"])
    objs.append(blade)

    # --- Rune strip: thin emissive slab on the blade face (reads as the glowing fuller) ---
    bpy.ops.mesh.primitive_cube_add(location=(0, P["blade_t"] / 2 * 0.7, blade_z0 + P["blade_len"] * 0.45))
    runes = bpy.context.active_object
    runes.name = "Runes"
    runes.scale = (P["blade_w"] * 0.10, 0.0012, P["blade_len"] * 0.38)
    runes.data.materials.append(mats["M_SwordRunes"])
    objs.append(runes)

    # --- Guard: center block + two swept wings ---
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, grip_half + P["guard_t"] / 2))
    gc = bpy.context.active_object
    gc.name = "GuardCenter"
    gc.scale = (P["blade_w"] * 1.4, P["guard_t"] * 0.8, P["guard_t"] / 2)
    gc.data.materials.append(mats["M_SwordGuard"])
    objs.append(gc)
    wing_len = (P["guard_span"] - P["blade_w"] * 2.8) / 2
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(
            location=(side * (P["blade_w"] * 1.4 + wing_len / 2), 0, grip_half + P["guard_t"] / 2))
        w = bpy.context.active_object
        w.name = f"GuardWing{'L' if side < 0 else 'R'}"
        w.scale = (wing_len / 2, P["guard_t"] * 0.55, P["guard_h"] / 2)
        w.rotation_euler = (0, side * math.radians(-8), 0)  # slight upward sweep like the wings
        w.data.materials.append(mats["M_SwordGuard"])
        objs.append(w)

    # --- Grip: cylinder centered on origin (the hand point) ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=P["grip_r"], depth=P["grip_len"], location=(0, 0, 0))
    grip = bpy.context.active_object
    grip.name = "Grip"
    grip.data.materials.append(mats["M_SwordGrip"])
    objs.append(grip)

    # --- Pommel: low-poly sphere below the grip ---
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=P["pommel_r"],
                                         location=(0, 0, -(grip_half + P["pommel_r"] * 0.7)))
    pom = bpy.context.active_object
    pom.name = "Pommel"
    pom.data.materials.append(mats["M_SwordGuard"])
    objs.append(pom)

    # --- Join into one mesh (origin stays at grip center) ---
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = blade
    bpy.ops.object.join()
    sword = bpy.context.active_object
    sword.name = "SM_RuneSword"
    bpy.ops.object.shade_flat()

    # UVs (UE wants a channel even if untextured for now)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66))
    bpy.ops.object.mode_set(mode="OBJECT")

    # --- Hit-trace sockets: UE FBX import converts SOCKET_* empties to StaticMesh sockets ---
    for name, z in (("SOCKET_Base", blade_z0), ("SOCKET_Tip", blade_z1)):
        e = bpy.data.objects.new(name, None)
        e.location = (0, 0, z)
        e.parent = sword
        col.objects.link(e)

    tris = sum(len(p.vertices) - 2 for p in sword.data.polygons)
    print(f"[sword_gen] tris={tris} blade={P['blade_len']}m span={P['guard_span']}m")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.fbx(
        filepath=out_path, use_selection=True,
        apply_unit_scale=True, apply_scale_options="FBX_SCALE_UNITS",
        object_types={"MESH", "EMPTY"}, path_mode="AUTO",
        use_mesh_modifiers=True, bake_anim=False)
    print(f"[sword_gen] exported {out_path}")


build()
