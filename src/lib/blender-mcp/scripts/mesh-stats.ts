import { pyReceipt, readReceipt } from '@/lib/blender-mcp/receipt';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';

/**
 * Measure every mesh in the operator's scene, in TRIANGLES.
 *
 * The scene endpoint's `ObjectSummary` carries no size, so a script is the only
 * honest source of how big a mesh is. It reads, it never writes: no object is
 * added, removed, linked or selected, and no operator runs. Triangles come from
 * `loop_triangles` (what the runtime pays for), not `len(polygons)`, where a
 * quad or n-gon counts once. The counts travel in ONE `mesh-stats` receipt on
 * the shared `POF_RESULT=` envelope.
 */
export const MESH_STATS_KIND = 'mesh-stats';

export interface MeshStat {
  name: string;
  /** Triangles after tessellation — the authored budget unit. */
  tris: number;
  verts: number;
  /** Blender polygons (quads and n-gons count once) — reported, never graded. */
  polys: number;
}

export type MeshStatsRead =
  | { state: 'confirmed'; meshes: MeshStat[] }
  | { state: 'unconfirmed'; reason: string };

export function meshStatsScript(): string {
  return `
import bpy

meshes = []
for o in bpy.context.scene.objects:
    if o.type != 'MESH':
        continue
    o.data.calc_loop_triangles()
    meshes.append({"name": o.name, "tris": len(o.data.loop_triangles), "verts": len(o.data.vertices), "polys": len(o.data.polygons)})
print(f"Measured {len(meshes)} mesh objects")
${pyReceipt(MESH_STATS_KIND, { meshes: 'meshes' })}
`.trim();
}

const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function toMeshStat(v: unknown): MeshStat | null {
  if (typeof v !== 'object' || v === null) return null;
  const { name, tris, verts, polys } = v as Record<string, unknown>;
  if (typeof name !== 'string' || !count(tris) || !count(verts) || !count(polys)) return null;
  return { name, tris, verts, polys };
}

/**
 * The measured meshes, or why there are none. Only a `mesh-stats` receipt
 * confirms; prose, a transport OK or a bespoke marker is `unconfirmed`. A
 * malformed row is dropped rather than guessed at.
 */
export function readMeshStats(source: string | Partial<ExecuteOutput>): MeshStatsRead {
  const read = readReceipt(source, MESH_STATS_KIND);
  if (read.state !== 'confirmed') {
    return { state: 'unconfirmed', reason: read.reason };
  }
  if (!Array.isArray(read.data.meshes)) {
    return { state: 'unconfirmed', reason: "the 'mesh-stats' receipt carried no mesh list" };
  }
  const meshes = read.data.meshes.map(toMeshStat).filter((m): m is MeshStat => m !== null);
  return { state: 'confirmed', meshes };
}
