"""Headless Blender: pose-swept see-through test for a RIGGED generated character - the
render tier the structural critique (pof_mesh_critique.py) cannot reach: it reads the rest
mesh only, and a generated character's separate armour/cloth sheets part under deformation.

Every face is shaded unlit, front grey and BACK magenta, on a transparent film. From outside a
closed surface no back face is visible, so each magenta pixel is a view into a shell's inside -
a gap between sheets, an open boundary, or inward winding. Single-sided engine materials cull
those faces, so the share is how much of the silhouette the player sees through.

Run it twice per character and read the EXCESS of the first over the second:
  blender --background <rig.blend> --python pof_mesh_seethrough.py -- <outdir>
  blender --background <rig.blend> --python pof_mesh_seethrough.py -- <outdir_closed> --fixture closed
'closed' voxel-remeshes the rest mesh (closed by construction) with weights transferred: it is
the floor, because deformation beyond a joint's range folds even a closed body (measured
2026-10-24: closed copy 0% at rest, up to 16% posed). 'holed' cuts a chest patch out of the
closed copy and must fire in the views facing it - prove the instrument before trusting it.
Measured on the four round-1 heroes: two fail at rest (32-42% back faces: inverted winding),
one opens only posed (0.95% rest -> 10.4% max excess in thigh lifts), one stays flat.
Writes <outdir>/result.json (per pose x camera) and the frames; prints POF_SEETHROUGH_* markers.
Poses default to a blind sweep of the UE-mannequin bones; pass --quick for the rest pose only.
"""
import bpy, bmesh, sys, json, math, os
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
out_dir = argv[0]
fixture = argv[argv.index('--fixture') + 1] if '--fixture' in argv else None
os.makedirs(out_dir, exist_ok=True)
RES = 192

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')

def build_fixture(holed):
    # closed-by-construction copy of the file's own mesh: voxel remesh at rest, weights
    # transferred from the original, original removed. 'holed' cuts a chest patch out of it.
    src = next(o for o in bpy.data.objects if o.type == 'MESH')
    ob = src.copy(); ob.data = src.data.copy(); ob.name = 'fixture'
    bpy.context.scene.collection.objects.link(ob)
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    bpy.context.view_layer.objects.active = ob
    rm = ob.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.012
    bpy.ops.object.modifier_apply(modifier='rm')
    ob.vertex_groups.clear()
    for g in src.vertex_groups: ob.vertex_groups.new(name=g.name)
    dt = ob.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = src; dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.modifier_apply(modifier='dt')
    if holed:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        zs = [v.co.z for v in bm.verts]; zc = min(zs) + (max(zs) - min(zs)) * 0.62
        ys = [v.co.y for v in bm.verts]; yf = min(ys)
        kill = [f for f in bm.faces if abs(f.calc_center_median().z - zc) < 0.05
                and abs(f.calc_center_median().x) < 0.08 and f.normal.y < -0.5]
        print('HOLED faces cut', len(kill))
        bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(ob.data)
    am = ob.modifiers.new('arm', 'ARMATURE'); am.object = arm
    bpy.data.objects.remove(src)
    return ob

if fixture: build_fixture(fixture.endswith('holed'))
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.visible_get()]

# unlit two-sided material: front grey, back magenta
mat = bpy.data.materials.new('st'); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
geo = nt.nodes.new('ShaderNodeNewGeometry'); mix = nt.nodes.new('ShaderNodeMixRGB')
mix.inputs[1].default_value = (0.5, 0.5, 0.5, 1); mix.inputs[2].default_value = (1, 0, 1, 1)
nt.links.new(geo.outputs['Backfacing'], mix.inputs[0])
em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(mix.outputs[0], em.inputs[0])
outn = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], outn.inputs[0])
mat.use_backface_culling = False
for o in meshes:
    o.data.materials.clear(); o.data.materials.append(mat)

sc = bpy.context.scene
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: sc.render.engine = eng; break
    except TypeError: pass
sc.render.resolution_x = sc.render.resolution_y = RES; sc.render.resolution_percentage = 100
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
try: sc.eevee.taa_render_samples = 1
except Exception: pass

# frame on the rest-pose bounds
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
ctr = (lo + hi) / 2; H = max(hi - lo)
tgt = bpy.data.objects.new('tgt', None); sc.collection.objects.link(tgt); tgt.location = ctr
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = H * 1.5
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.constraints.new('TRACK_TO').target = tgt
CAMS = {'front': (0, -1, 0), 'back': (0, 1, 0), 'left': (-1, 0, 0), 'right': (1, 0, 0),
        'q_front_l': (-0.7, -0.7, 0.35), 'q_back_r': (0.7, 0.7, -0.25)}

GROUPS = {'arms': ['upperarm_l', 'upperarm_r'], 'forearms': ['lowerarm_l', 'lowerarm_r'],
          'thighs': ['thigh_l', 'thigh_r'], 'calves': ['calf_l', 'calf_r'],
          'spine': ['spine_01', 'spine_02', 'spine_03'], 'neck': ['neck_01', 'head']}
POSES = [('rest', {})]
QUICK = '--quick' in argv
for g, bones in GROUPS.items():
    per = 75 if g in ('arms', 'thighs', 'forearms', 'calves') else 25
    for ax in range(3):
        for sgn in (1, -1):
            e = [0, 0, 0]; e[ax] = sgn * per
            POSES.append((f'{g}_{"xyz"[ax]}{"+" if sgn > 0 else "-"}', {b: e for b in bones}))

def set_pose(spec):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
    for b, e in spec.items():
        if b in arm.pose.bones: arm.pose.bones[b].rotation_euler = [math.radians(x) for x in e]
    bpy.context.view_layer.update()

def measure(path):
    img = bpy.data.images.load(path); px = np.empty(RES * RES * 4, dtype=np.float32)
    img.pixels.foreach_get(px); bpy.data.images.remove(img); px = px.reshape(RES, RES, 4)
    a = px[..., 3] > 0.5
    mag = a & (px[..., 0] > 0.7) & (px[..., 1] < 0.3) & (px[..., 2] > 0.7)
    # transparent pixels not reachable from the border = enclosed background
    out = np.zeros_like(a); stack = [(y, x) for y in range(RES) for x in (0, RES - 1) if not a[y, x]] + \
        [(y, x) for x in range(RES) for y in (0, RES - 1) if not a[y, x]]
    for p in stack: out[p] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < RES and 0 <= nx < RES and not a[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; stack.append((ny, nx))
    enc = (~a) & (~out)
    return int(a.sum()), int(mag.sum()), int(enc.sum())

rows = []
if QUICK: POSES = POSES[:1]
for pname, spec in POSES:
    set_pose(spec)
    for cname, d in CAMS.items():
        cam.location = ctr + Vector(d).normalized() * H * 3
        f = os.path.join(out_dir, f'{pname}__{cname}.png'); sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        opaque, mag, enc = measure(f)
        rows.append({'pose': pname, 'cam': cname, 'opaque': opaque, 'backface': mag, 'enclosed_bg': enc,
                     'backface_share': round(mag / opaque, 5) if opaque else None})
json.dump({'fixture': fixture, 'meshes': [o.name for o in meshes], 'res': RES, 'rows': rows},
          open(os.path.join(out_dir, 'result.json'), 'w'), indent=1)
rest = [r['backface_share'] or 0 for r in rows if r['pose'] == 'rest']
posed = [r['backface_share'] or 0 for r in rows if r['pose'] != 'rest']
print(f'POF_SEETHROUGH_VIEWS={len(rows)}')
print(f'POF_SEETHROUGH_REST_MAX={max(rest):.5f}')
if posed: print(f'POF_SEETHROUGH_POSED_MAX={max(posed):.5f}')
