"""
Convert a rigged .glb to a UE-importable FBX (/diablo W05) — Blender headless.

  blender -b -P scripts/diablo/glb_to_fbx.py -- <in.glb> <out.fbx> [target_height_units]

UE's proven skeletal import in this project is the FBX importer (ardy_import.py). Armature, skin
weights and the baked animation are exported; no leaf bones (UE rejects the extra joints).
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    print("POF_FBX_ERROR=usage: -- <in.glb> <out.fbx>")
    sys.exit(2)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])

# Optional third arg: make the model this many Blender units tall BEFORE export, so the FBX carries
# the entity's real size. UE's animation import ignores `import_uniform_scale` (W06: a 180 cm mesh with
# a walk whose translations stayed in the source's units posed the skeleton at 1/100 and the figure
# vanished), so mesh and animation must already agree in the file.
if len(argv) > 2:
    target = float(argv[2])
    import mathutils
    objs = [o for o in bpy.context.scene.objects]
    pts = [o.matrix_world @ mathutils.Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    height = max(p.z for p in pts) - min(p.z for p in pts)
    factor = target / height if height else 1.0
    for o in objs:
        if o.parent is None:
            o.scale = (o.scale[0] * factor, o.scale[1] * factor, o.scale[2] * factor)
    bpy.context.view_layer.update()
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    print(f"POF_FBX_SCALE height={height:.3f} -> {target} (x{factor:.3f})")
# The glb's textures are PACKED images; an FBX export only references files, so without this the
# FBX points at textures that were never written and UE imports the material without its maps
# (W05: "Unable to find Texture file ...fbm"). Write each image next to the FBX first.
import os
tex_dir = os.path.splitext(argv[1])[0] + "_tex"
os.makedirs(tex_dir, exist_ok=True)
written = 0
for img in bpy.data.images:
    if img.size[0] == 0:
        continue
    img.filepath_raw = os.path.join(tex_dir, f"{bpy.path.clean_name(img.name)}.png")
    img.file_format = "PNG"
    img.save()
    written += 1
arm = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
# The walk arrived as the active action AND an NLA strip named "preset:walk_Armature"; the default
# NLA-strip export wrote NO animation into the FBX (W05: 0 AnimSequence in UE). Give the actions clean
# names (a ':' is not a safe take name) and export every action directly.
for act in bpy.data.actions:
    act.name = act.name.split(":")[-1].replace("_Armature", "") or "Anim"
for a in arm:
    if a.animation_data:
        for t in list(a.animation_data.nla_tracks):
            a.animation_data.nla_tracks.remove(t)
bpy.ops.export_scene.fbx(
    filepath=argv[1], use_selection=False, object_types={"ARMATURE", "MESH"},
    add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
    path_mode="COPY", embed_textures=True,
)
print(f"POF_FBX_DONE={argv[1]} armatures={len(arm)} meshes={len(meshes)} bones={sum(len(a.data.bones) for a in arm)} textures={written} actions={[a.name for a in bpy.data.actions]}")
