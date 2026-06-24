import unreal as u
def L(m): u.log("PREV: %s"%m)
els = u.get_editor_subsystem(u.LevelEditorSubsystem)
eas = u.get_editor_subsystem(u.EditorActorSubsystem)
SRC="/Game/Maps/VerticalSlice"; PREV="/Game/Maps/VS_VeoPreview"
if not u.EditorAssetLibrary.does_asset_exist(PREV):
    u.EditorAssetLibrary.duplicate_asset(SRC, PREV)
    L("duplicated arena -> %s" % PREV)
els.load_level(PREV)
SKM   = u.load_asset("/MoverTests/Characters/Mannequins/Meshes/SKM_Manny")
ANIM  = u.load_asset("/Game/MHA/AS_VeoStrike_Manny")
SABER = u.load_asset("/Game/Weapons/SM_RuneSword")
PA    = u.load_asset("/Game/Characters/Player/PA_VSPlayer")
# clear prior preview actors
for a in eas.get_all_level_actors():
    try:
        if a.get_actor_label() in ("PREVIEW_VeoStrike","PREVIEW_VeoStrike_Saber"): eas.destroy_actor(a)
    except Exception: pass
# place near a PlayerStart, facing it
loc = u.Vector(0,0,98); rot = u.Rotator(0,0,0)
for a in eas.get_all_level_actors():
    if 'PlayerStart' in a.get_class().get_name():
        b=a.get_actor_location(); f=a.get_actor_forward_vector()
        loc=u.Vector(b.x+f.x*320, b.y+f.y*320, b.z+0)
        rot=u.Rotator(0,0,a.get_actor_rotation().yaw+180)
        break
d = eas.spawn_actor_from_class(u.SkeletalMeshActor, loc, rot)
d.set_actor_label("PREVIEW_VeoStrike")
smc = d.skeletal_mesh_component
try: smc.set_skeletal_mesh_asset(SKM)
except Exception: smc.set_editor_property("skeletal_mesh_asset", SKM)
smc.set_animation_mode(u.AnimationMode.ANIMATION_SINGLE_NODE)
apd = u.SingleAnimationPlayData(); apd.anim_to_play=ANIM; apd.saved_looping=True; apd.saved_playing=True
smc.set_editor_property("animation_data", apd)
try:
    smc.set_update_animation_in_editor(True)  # animate live in the editor viewport (no PIE needed)
    L("update-in-editor ON")
except Exception as e:
    L("update-in-editor unavailable (hit Play to see it loop): %s" % e)
smc.play_animation(ANIM, True)
L("dummy spawned at (%.0f,%.0f,%.0f) anim=%s" % (loc.x,loc.y,loc.z,bool(ANIM)))
# saber as a separate movable StaticMeshActor snapped to the hand_r bone
try:
    sa = eas.spawn_actor_from_class(u.StaticMeshActor, loc, rot)
    sa.set_actor_label("PREVIEW_VeoStrike_Saber")
    smcomp = sa.static_mesh_component
    smcomp.set_mobility(u.ComponentMobility.MOVABLE)
    smcomp.set_static_mesh(SABER)
    L("attach doc: %s" % sa.attach_to_actor.__doc__)
    sa.attach_to_actor(d, u.Name("hand_r"), u.AttachmentRule.SNAP_TO_TARGET, u.AttachmentRule.SNAP_TO_TARGET, u.AttachmentRule.KEEP_WORLD, False)
    L("saber actor attached to hand_r")
except Exception as e:
    L("saber attach err (body still previews): %s" % e)
els.save_current_level()
L("RESULT saved %s" % PREV)
