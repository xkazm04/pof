import unreal as u
mesh=u.load_asset("/MoverTests/Characters/Mannequins/Meshes/SKM_Manny")
sub=u.get_editor_subsystem(u.SkeletalMeshEditorSubsystem)
pa=sub.create_physics_asset(mesh)
u.log("MK: created %s"%(pa.get_path_name() if pa else None))
dest="/Game/Characters/Player"
u.EditorAssetLibrary.make_directory(dest)
target=dest+"/PA_VSPlayer"
if u.EditorAssetLibrary.does_asset_exist(target):
    u.EditorAssetLibrary.delete_asset(target)
dup=u.EditorAssetLibrary.duplicate_loaded_asset(pa, target)
u.log("MK: dup=%s"%(dup.get_path_name() if dup else None))
if dup:
    ok=u.EditorAssetLibrary.save_loaded_asset(dup)
    u.log("MK: saved=%s exists=%s"%(ok, u.EditorAssetLibrary.does_asset_exist(target)))
    u.log("MK: RESULT=PASS")
