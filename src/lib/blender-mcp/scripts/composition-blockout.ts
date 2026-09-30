import { py } from '@/lib/blender-mcp/escape';
import { pyReceipt, readReceipt } from '@/lib/blender-mcp/receipt';
import type { DressPlan, DressRow } from '@/lib/visual-gen/scene-dress-plan';

/**
 * Block a set-dressing plan out in Blender: one sized proxy cube per PLACED instance,
 * carrying its UE actor tags, in a NEW collection.
 *
 * `generators/composition.ts` emits "a transform manifest an editor-side spawn script
 * consumes" — this is that script's Blender half (the UE spawn is still the gap the
 * composition spec names). The manifest is composition-local CENTIMETRES with `z` at the
 * prop's BASE; Blender is METRES with an object's origin where we put it. The conversion
 * happens here, once: dims = size/100, location = (x, y, z + h/2)/100, yaw deg → rad.
 *
 * It only ever ADDS. Meshes are built with bmesh and linked straight into the new
 * collection, so nothing already in the scene is unlinked, removed or reset — a blockout is
 * safe to run into a scene the operator is working in, and running it twice just leaves two
 * collections. Unplaced instances are not spawned (they have no transform).
 *
 * The last line prints a `'blockout'` receipt on the shared POF_RESULT envelope
 * (`receipt.ts`); `readBlockoutReceipt` is what the UI believes, never a bare transport OK.
 */

export const BLOCKOUT_COLLECTION = 'PoF Set Dressing';

/** The Script History label for one blockout dispatch. */
export function blockoutScriptName(placed: number): string {
  return `Block out set dressing (${placed} prop${placed === 1 ? '' : 's'})`;
}

/** cm → m, rounded so 170 reads 1.7 rather than a float tail. */
function m(cm: number): number {
  return Number((cm / 100).toFixed(4)) || 0;
}

function rad(deg: number): number {
  return Number(((deg * Math.PI) / 180).toFixed(6)) || 0;
}

function rowLiteral(r: DressRow): string {
  const [w, d, h] = r.sizeCm;
  const dims = `(${m(w)}, ${m(d)}, ${m(h)})`;
  const loc = `(${m(r.x)}, ${m(r.y)}, ${m(r.z + h / 2)})`;
  return (
    `    {"name": "SD_${py(r.instanceId)}", "dims": ${dims}, "loc": ${loc}, ` +
    `"yaw": ${rad(r.yawDeg)}, "tags": "${py(r.ueActorTags.join(','))}"},`
  );
}

export function compositionBlockoutScript(plan: DressPlan): string {
  const rows = plan.placed.map(rowLiteral).join('\n');
  return `
import bpy
import bmesh
from mathutils import Matrix

# PoF set-dressing blockout: ${plan.placed.length} placed, ${plan.unplaced.length} unplaced (not spawned).
# Manifest cm (z = prop base) converted to Blender metres (origin = proxy centre).
ROWS = [
${rows}
]

coll = bpy.data.collections.new("${BLOCKOUT_COLLECTION}")
bpy.context.scene.collection.children.link(coll)

n = 0
for r in ROWS:
    w, d, h = r["dims"]
    mesh = bpy.data.meshes.new(r["name"] + "_mesh")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((w, d, h, 1.0)))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(r["name"], mesh)
    obj.location = r["loc"]
    obj.rotation_euler = (0.0, 0.0, r["yaw"])
    obj["pof_tags"] = r["tags"]
    obj.display_type = 'SOLID'
    coll.objects.link(obj)
    n += 1

${pyReceipt('blockout', { placed: 'n' })}
`.trim();
}

export type BlockoutReceipt =
  | { state: 'confirmed'; placed: number }
  | { state: 'unconfirmed'; reason: string }
  | { state: 'mismatch'; placed: number; expected: number; reason: string };

/**
 * Read what Blender printed. Only a `'blockout'` receipt carrying the expected count is
 * `confirmed` — a missing receipt, or one without a numeric count, is `unconfirmed`.
 */
export function readBlockoutReceipt(output: string, expected: number): BlockoutReceipt {
  const read = readReceipt(output, 'blockout');
  const placed = read.state === 'unconfirmed' ? undefined : read.data.placed;
  if (typeof placed !== 'number') {
    return {
      state: 'unconfirmed',
      reason:
        'the script ran but Blender printed no blockout receipt, so the placed count could not be confirmed',
    };
  }
  if (placed === expected) return { state: 'confirmed', placed };
  return {
    state: 'mismatch',
    placed,
    expected,
    reason: `Blender placed ${placed} of ${expected} props`,
  };
}
