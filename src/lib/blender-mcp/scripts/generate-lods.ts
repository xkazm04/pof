import { py } from '@/lib/blender-mcp/escape';
import { pyReceipt } from '@/lib/blender-mcp/receipt';

/** Receipt kind printed once per generated LOD level (read by `gradeLodReceipt`). */
export const LOD_RECEIPT_KIND = 'lod';

/**
 * Where each level's triangle target comes from:
 *  - `targetTris` — the plan's targets, stated from a MEASURED source (`planLodChain`);
 *  - `lodRatios` — no measurement was read, so Blender measures the source itself and
 *    derives each target as `int(src_tris * ratio)`; the receipt reports that target.
 */
export type LodTargets = { targetTris: number[] } | { lodRatios: number[] };

const positiveInts = (ns: number[]) => ns.filter((n) => Number.isFinite(n) && n >= 1).map((n) => Math.floor(n));
const unitRatios = (ns: number[]) => ns.filter((n) => Number.isFinite(n) && n > 0 && n < 1);

/**
 * Decimate copies of one mesh to TRIANGLE targets. Each Decimate ratio is
 * computed in Blender as target / measured source triangles (never applied
 * blind), and every level ends in one `lod` receipt on the shared envelope:
 * `{ level, name, targetTris, tris, polys }` with `tris` re-measured from
 * `loop_triangles` after the modifier is applied. A level that raised prints no
 * receipt, so it reads as unmeasured rather than done.
 */
export function generateLodsScript(params: { objectName: string } & LodTargets): string {
  const name = py(params.objectName);
  const targets =
    'targetTris' in params
      ? `[${positiveInts(params.targetTris).join(', ')}]`
      : `[int(src_tris * r) for r in [${unitRatios(params.lodRatios).join(', ')}]]`;

  return `
import bpy

obj = bpy.data.objects.get("${name}")
if not obj or obj.type != 'MESH':
    raise ValueError("Object '${name}' not found or not a mesh")

def pof_tris(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)

src_tris = pof_tris(obj)
if src_tris == 0:
    raise ValueError("Object '${name}' has no triangles to decimate")

targets = ${targets}
bpy.ops.object.select_all(action='DESELECT')
print(f"Generating {len(targets)} LODs for {obj.name} ({src_tris} triangles)")
for level, target in enumerate(targets, start=1):
    lod = obj.copy()
    lod.data = obj.data.copy()
    lod.name = f"{obj.name}_LOD{level}"
    bpy.context.collection.objects.link(lod)
    bpy.context.view_layer.objects.active = lod
    lod.select_set(True)
    mod = lod.modifiers.new(name="Decimate", type='DECIMATE')
    mod.ratio = min(1.0, target / src_tris)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    lod.select_set(False)
    lod.location.x += level * 3
    tris = pof_tris(lod)
    print(f"  LOD{level}: {tris} triangles (target {target})")
    ${pyReceipt(LOD_RECEIPT_KIND, {
      level: 'level',
      name: 'lod.name',
      targetTris: 'target',
      tris: 'tris',
      polys: 'len(lod.data.polygons)',
    })}
print("LOD generation complete")
`.trim();
}
