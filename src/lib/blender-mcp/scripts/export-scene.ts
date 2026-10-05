import { py } from '@/lib/blender-mcp/escape';
import { pyReceipt, pyStr } from '@/lib/blender-mcp/receipt';

/**
 * The export script ends in an `'export'` receipt carrying the path, printed only
 * once Blender's own exporter reported FINISHED AND the written file was read
 * back. The UI keys off THAT receipt (`readReceipt(result, 'export', { path })`),
 * not off a bare transport OK: the bridge may be on another machine, so PoF
 * cannot stat the file, and a 200 from `/api/blender-mcp/execute` only means the
 * addon accepted the script.
 *
 * FINISHED is not the ceiling, though. It says the operator ran, not what the
 * file holds, and the script runs inside the Blender that wrote the file, so it
 * can open it a line later. Measured on Blender 4.2.1 with the previous calls:
 * a second scene in the document made the glTF exporter write BOTH scenes (the
 * side scene's object as a node beside the hero), and an empty scene wrote a
 * well-formed 132-byte file with zero meshes, both FINISHED. So the glTF call is
 * scoped to the active scene, and the read-back compares the file with the mesh
 * objects the scene meant to ship (resolved before the write) and raises on a
 * mismatch, before the receipt can print. Registry technique:
 * game-production mesh-finishing-for-engine-readiness/export-proven-by-read-back.
 */
export function exportSceneScript(params: {
  outputPath: string;
  format: 'fbx' | 'gltf';
}): string {
  const path = py(params.outputPath);
  const call =
    params.format === 'fbx'
      ? `bpy.ops.export_scene.fbx(filepath=r"${path}", use_selection=False)`
      : `bpy.ops.export_scene.gltf(filepath=r"${path}", export_format="GLB", use_active_scene=True)`;
  const readBack = params.format === 'fbx' ? FBX_READ_BACK : GLB_READ_BACK;
  // The operator's own return set is necessary but not sufficient evidence.
  // Anything but FINISHED raises; so does any read-back issue.
  return `
import bpy

_MESHLIKE = {'MESH', 'CURVE', 'SURFACE', 'META', 'FONT'}
_scene = bpy.context.scene
_intended = set()
for _o in _scene.objects:
    if _o.type in _MESHLIKE:
        _intended.add(_o.name)
    if _o.instance_collection is not None:
        _intended.update(c.name for c in _o.instance_collection.all_objects if c.type in _MESHLIKE)

status = ${call}
if 'FINISHED' not in status:
    raise RuntimeError("Blender's exporter returned " + str(status) + " instead of FINISHED")

_path = r"${path}"
${readBack}
if not _intended:
    _issues.append('empty-export: the active scene has no mesh objects')
elif _meshes == 0:
    _issues.append('meshes-missing: the file holds no meshes')
if _issues:
    raise RuntimeError('export read-back failed: ' + '; '.join(_issues))

${pyReceipt('export', { path: pyStr(params.outputPath), format: pyStr(params.format), meshes: '_meshes', checked: 'True' })}
`.trim();
}

/** Parse the GLB's JSON chunk: one scene, mesh nodes only from the intended set. */
const GLB_READ_BACK = `
import json, struct
with open(_path, 'rb') as _f:
    _data = _f.read()
_doc = json.loads(_data[20:20 + struct.unpack_from('<I', _data, 12)[0]].decode('utf-8'))
_issues = []
_scenes = len(_doc.get('scenes', []))
if _scenes != 1:
    _issues.append('extra-scenes: the file holds %d scenes' % _scenes)
_mesh_nodes = [n.get('name', '') for n in _doc.get('nodes', []) if 'mesh' in n]
_meshes = len(_mesh_nodes)
_foreign = sorted(set(_mesh_nodes) - _intended)
if _foreign:
    _issues.append('foreign-objects: ' + ', '.join(_foreign[:5]))
`.trim();

/**
 * Re-import into a temporary collection of the ACTIVE scene, count, then remove
 * every datablock the import created and restore the active collection, the
 * selection and the active object. Nothing that existed before is touched.
 */
const FBX_READ_BACK = `
_kinds = ('objects', 'meshes', 'materials', 'actions', 'armatures', 'images', 'cameras', 'lights', 'curves')
_before = {k: set(getattr(bpy.data, k)) for k in _kinds}
_vl = bpy.context.view_layer
_prev_layer = _vl.active_layer_collection
_prev_active = _vl.objects.active
_prev_selected = [o for o in _vl.objects if o.select_get()]
_tmp = bpy.data.collections.new('pof_export_read_back')
_scene.collection.children.link(_tmp)
_issues = []
_meshes = 0
try:
    _vl.active_layer_collection = _vl.layer_collection.children[_tmp.name]
    bpy.ops.import_scene.fbx(filepath=_path)
    _meshes = sum(1 for o in bpy.data.objects if o not in _before['objects'] and o.type == 'MESH')
finally:
    for _k in _kinds:
        _coll = getattr(bpy.data, _k)
        for _d in [d for d in _coll if d not in _before[_k]]:
            _coll.remove(_d)
    bpy.data.collections.remove(_tmp)
    _vl.active_layer_collection = _prev_layer
    for _o in _vl.objects:
        _o.select_set(_o in _prev_selected)
    _vl.objects.active = _prev_active
`.trim();
