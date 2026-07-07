import unreal as u
ar=u.AssetRegistryHelpers.get_asset_registry()
pa_class=u.TopLevelAssetPath("/Script/Engine","PhysicsAsset")
metas=ar.get_assets_by_class(pa_class, True)
u.log("PHYS: %d PhysicsAssets in registry"%len(metas))
for m in metas: u.log("PHYS: PA %s"%m.package_name)
# also probe likely MoverTests/Manny physics asset paths directly
for p in ["/MoverTests/Characters/Mannequins/Meshes/PA_Manny",
          "/MoverTests/Characters/Mannequins/Meshes/PA_Mannequin_UE5",
          "/MoverTests/Characters/Mannequins/Meshes/SKM_Manny_PhysicsAsset",
          "/MoverTests/Characters/Mannequins/Rigs/PA_Mannequin",
          "/Game/Characters/Mannequins/Meshes/PA_Mannequin"]:
    if u.EditorAssetLibrary.does_asset_exist(p): u.log("PHYS: EXISTS %s"%p)
# what skeleton does SKM_Manny use (to match a compatible PA)
mesh=u.load_asset("/MoverTests/Characters/Mannequins/Meshes/SKM_Manny")
sk=mesh.get_editor_property("skeleton")
u.log("PHYS: SKM_Manny skeleton=%s"%(sk.get_path_name() if sk else None))
