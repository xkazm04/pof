"""
Convert a rigged .glb to a UE-importable FBX (/diablo W05) — Blender headless.

  blender -b -P scripts/diablo/glb_to_fbx.py -- <in.glb> <out.fbx>

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
