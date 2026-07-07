import unreal as u
candidates = ["/MoverTests/Characters/Mannequins/Meshes/SKM_Manny",
              "/Game/Characters/Mannequins/Meshes/SKM_Manny",
              "/Game/Mixamo/Retargeted/SKM_Manny/SKM_Manny"]
mesh=None
for c in candidates:
    if u.EditorAssetLibrary.does_asset_exist(c):
        mesh=u.load_asset(c); u.log("PHYS: mesh=%s"%c); break
if not mesh:
    ar=u.AssetRegistryHelpers.get_asset_registry()
    for a in ar.get_assets_by_class("SkeletalMesh", True):
        n=str(a.asset_name)
        if "Manny" in n: u.log("PHYS: candidate %s"%a.package_name)
pa = mesh.get_physics_asset() if mesh else None
if pa:
    bodies = pa.get_editor_property("skeletal_body_setups")
    names=[str(b.get_editor_property("bone_name")) for b in bodies]
    u.log("PHYS: %d bodies: %s"%(len(names), ", ".join(names)))
else:
    u.log("PHYS: no physics asset")
