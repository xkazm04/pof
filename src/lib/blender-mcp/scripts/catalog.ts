import { levelBlockoutScript } from '@/lib/blender-mcp/scripts/level-blockout';
import { levelMetadataScript } from '@/lib/blender-mcp/scripts/level-metadata';
import { scatterVegetationScript } from '@/lib/blender-mcp/scripts/scatter-vegetation';
import { nlaStateMachineScript } from '@/lib/blender-mcp/scripts/nla-state-machine';
import { compositorStackScript } from '@/lib/blender-mcp/scripts/compositor-stack';
import { terrainToMeshScript } from '@/lib/blender-mcp/scripts/terrain-to-mesh';
import { optimizeMeshScript } from '@/lib/blender-mcp/scripts/optimize-mesh';
import { applyTextureScript } from '@/lib/blender-mcp/scripts/apply-texture';
import { autoWeightsScript } from '@/lib/blender-mcp/scripts/auto-weights';
import { setupIKScript } from '@/lib/blender-mcp/scripts/setup-ik';
import { DEFAULT_TERRAIN_CONFIG, resolveTerrainBasis } from '@/lib/visual-gen/generators/terrain';

function sampleBasis() {
  const r = resolveTerrainBasis(DEFAULT_TERRAIN_CONFIG);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

/**
 * One row per script emitter that ends in a `pyReceipt`. The contract test sweeps this
 * list: the last statement of `build()` must be a receipt of `receiptKind`, and a sample
 * output (`values` answers each Python expression the receipt evaluates) must read back
 * as confirmed. A new emitter belongs here; one that prints only prose does not pass.
 */
export interface ScriptCatalogEntry {
  id: string;
  receiptKind: string;
  /** Build the script from a small representative sample input. */
  build: () => string;
  /** Values for the Python expressions in the receipt line, for the test's printed-output stand-in. */
  values: Record<string, unknown>;
}

export const SCRIPT_CATALOG: readonly ScriptCatalogEntry[] = [
  {
    id: 'level-blockout',
    receiptKind: 'level-blockout',
    build: () =>
      levelBlockoutScript({
        rooms: [{ id: 'r1', name: 'Hall', type: 'combat', x: 0, y: 0, width: 4, height: 4, color: [1, 0, 0] }],
        wallHeight: 3,
      }),
    values: { 'len(rooms_coll.objects)': 1 },
  },
  {
    id: 'level-metadata',
    receiptKind: 'level-metadata',
    build: () => levelMetadataScript({ spawnPoints: [{ x: 1, y: 2, type: 'player' }] }),
    values: { 'len(meta_coll.objects)': 1 },
  },
  {
    id: 'scatter-vegetation',
    receiptKind: 'scatter-vegetation',
    build: () =>
      scatterVegetationScript({
        points: [{ x: 0, y: 0, speciesId: 'oak', rotation: 0, scale: 1 }],
        speciesNames: { oak: 'Oak' },
      }),
    values: { 'len(collection.objects)': 1 },
  },
  {
    id: 'nla-state-machine',
    receiptKind: 'nla-state-machine',
    build: () =>
      nlaStateMachineScript({
        armatureName: 'Rig',
        states: [{ name: 'Idle', type: 'loop', frameStart: 1, frameEnd: 24 }],
      }),
    values: { 'len(armature.animation_data.nla_tracks)': 1 },
  },
  {
    id: 'compositor-stack',
    receiptKind: 'compositor',
    build: () => compositorStackScript({ bloom: { intensity: 1, threshold: 0.8, radius: 5 } }),
    values: { 'len(nodes)': 3 },
  },
  {
    id: 'terrain-to-mesh',
    receiptKind: 'terrain-mesh',
    build: () =>
      terrainToMeshScript({
        heightmap: [
          [0, 1],
          [1, 2],
        ],
        basis: sampleBasis(),
      }),
    values: { 'len(mesh.polygons)': 1, 'len(mesh.vertices)': 4 },
  },
  {
    id: 'optimize-mesh',
    receiptKind: 'optimize-mesh',
    build: () => optimizeMeshScript({ objectName: 'Cube' }),
    values: { initial_verts: 8, final_verts: 8 },
  },
  {
    id: 'apply-texture',
    receiptKind: 'apply-texture',
    build: () => applyTextureScript({ materialName: 'Mat', textureSlot: 'base_color', texturePath: 'C:/t.png' }),
    values: { 'mat.name': 'Mat' },
  },
  {
    id: 'auto-weights',
    receiptKind: 'auto-weights',
    build: () => autoWeightsScript({ armatureName: 'Rig', meshName: 'Body' }),
    values: { 'mesh.name': 'Body', 'armature.name': 'Rig', 'len(mesh.vertex_groups)': 4 },
  },
  {
    id: 'setup-ik',
    receiptKind: 'setup-ik',
    build: () =>
      setupIKScript({ armatureName: 'Rig', chains: [{ boneName: 'Leg', targetBone: 'Foot', chainLength: 2 }] }),
    values: { ik_count: 1 },
  },
];
