"""Headless Blender: build a combat-arena mesh and export Arena.fbx.
Run: blender --background --python build_arena.py
Authored in metres; the UE import applies a x100 scale (m -> cm)."""
import bpy, os, math

OUT = os.path.join(os.path.dirname(bpy.data.filepath) or os.path.dirname(__file__), "Arena.fbx")
ARENA = 20.0           # floor is 20 m square
WALL_H = 5.0           # wall height (m)
WALL_T = 0.5           # wall thickness (m)

# --- clean scene -----------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

def new_material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return m

def add_box(name, size, location, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(material)
    return obj

mat_floor  = new_material("M_Floor")
mat_wall   = new_material("M_Wall")
mat_pillar = new_material("M_Pillar")

parts = []
# floor: 20x20x0.2, top at z=0
parts.append(add_box("Floor", (ARENA, ARENA, 0.2), (0, 0, -0.1), mat_floor))
# four perimeter walls
half = ARENA / 2.0
parts.append(add_box("Wall_N", (ARENA, WALL_T, WALL_H), (0,  half, WALL_H/2), mat_wall))
parts.append(add_box("Wall_S", (ARENA, WALL_T, WALL_H), (0, -half, WALL_H/2), mat_wall))
parts.append(add_box("Wall_E", (WALL_T, ARENA, WALL_H), ( half, 0, WALL_H/2), mat_wall))
parts.append(add_box("Wall_W", (WALL_T, ARENA, WALL_H), (-half, 0, WALL_H/2), mat_wall))
# four corner pillars
for i, (sx, sy) in enumerate([(1,1),(1,-1),(-1,1),(-1,-1)]):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.6, depth=WALL_H,
        location=(sx*(half-1.5), sy*(half-1.5), WALL_H/2))
    p = bpy.context.active_object
    p.name = f"Pillar_{i}"
    p.data.materials.append(mat_pillar)
    parts.append(p)

# --- UV unwrap each part (cube projection is fine for a gray-arena) --------
for obj in parts:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=2.0)
    bpy.ops.object.mode_set(mode='OBJECT')

# --- join into one object "Arena" -----------------------------------------
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
arena = bpy.context.active_object
arena.name = "Arena"

# --- export FBX ------------------------------------------------------------
bpy.ops.export_scene.fbx(filepath=OUT, use_selection=True,
    apply_unit_scale=True, global_scale=1.0, object_types={'MESH'},
    mesh_smooth_type='FACE', path_mode='COPY')
assert os.path.isfile(OUT), "FBX export failed: " + OUT
print("ARENA_EXPORTED", OUT)
