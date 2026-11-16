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
import { createArmatureScript } from '@/lib/blender-mcp/scripts/create-armature';
import { exportSceneScript } from '@/lib/blender-mcp/scripts/export-scene';
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';
import { meshStatsScript } from '@/lib/blender-mcp/scripts/mesh-stats';
import { compositionBlockoutScript } from '@/lib/blender-mcp/scripts/composition-blockout';
import { dungeonToGeometryScript } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { comboAnimationScript } from '@/lib/blender-mcp/scripts/combo-animation';
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
  /** The exported `*Script` function this row exercises; `script-contract.test.ts` diffs these against the scripts directory. */
  emitter: string;
  receiptKind: string;
  /** Build the script from a small representative sample input. */
  build: () => string;
  /**
   * Where the receipt sits. `last` (default): the script's last statement. `per-item`: printed
   * inside a loop, one per generated item, so a closing prose line may follow it.
   */
  receiptPlacement?: 'last' | 'per-item';
  /** Values for the Python expressions in the receipt line, for the test's printed-output stand-in. */
  values: Record<string, unknown>;
}

export const SCRIPT_CATALOG: readonly ScriptCatalogEntry[] = [
  {
    id: 'level-blockout',
    emitter: 'levelBlockoutScript',
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
    emitter: 'levelMetadataScript',
    receiptKind: 'level-metadata',
    build: () => levelMetadataScript({ spawnPoints: [{ x: 1, y: 2, type: 'player' }] }),
    values: { 'len(meta_coll.objects)': 1 },
  },
  {
    id: 'scatter-vegetation',
    emitter: 'scatterVegetationScript',
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
    emitter: 'nlaStateMachineScript',
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
    emitter: 'compositorStackScript',
    receiptKind: 'compositor',
    build: () => compositorStackScript({ bloom: { intensity: 1, threshold: 0.8, radius: 5 } }),
    values: { 'len(nodes)': 3 },
  },
  {
    id: 'terrain-to-mesh',
    emitter: 'terrainToMeshScript',
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
    emitter: 'optimizeMeshScript',
    receiptKind: 'optimize-mesh',
    build: () => optimizeMeshScript({ objectName: 'Cube' }),
    values: { initial_verts: 8, final_verts: 8 },
  },
  {
    id: 'apply-texture',
    emitter: 'applyTextureScript',
    receiptKind: 'apply-texture',
    build: () => applyTextureScript({ materialName: 'Mat', textureSlot: 'base_color', texturePath: 'C:/t.png' }),
    values: { 'mat.name': 'Mat' },
  },
  {
    id: 'auto-weights',
    emitter: 'autoWeightsScript',
    receiptKind: 'auto-weights',
    build: () => autoWeightsScript({ armatureName: 'Rig', meshName: 'Body' }),
    values: { 'mesh.name': 'Body', 'armature.name': 'Rig', 'len(mesh.vertex_groups)': 4 },
  },
  {
    id: 'setup-ik',
    emitter: 'setupIKScript',
    receiptKind: 'setup-ik',
    build: () =>
      setupIKScript({ armatureName: 'Rig', chains: [{ boneName: 'Leg', targetBone: 'Foot', chainLength: 2 }] }),
    values: { ik_count: 1 },
  },
  {
    id: 'create-armature',
    emitter: 'createArmatureScript',
    receiptKind: 'armature',
    build: () =>
      createArmatureScript({ armatureName: 'Rig', bones: [{ name: 'Root', head: [0, 0, 0], tail: [0, 0, 1] }] }),
    values: { 'armature_obj.name': 'Rig', 'len(amt.bones)': 1 },
  },
  {
    id: 'export-scene',
    emitter: 'exportSceneScript',
    receiptKind: 'export',
    build: () => exportSceneScript({ outputPath: 'C:/out/hero.fbx', format: 'fbx' }),
    values: { _meshes: 1, True: true },
  },
  {
    id: 'generate-lods',
    emitter: 'generateLodsScript',
    receiptKind: 'lod',
    receiptPlacement: 'per-item',
    build: () => generateLodsScript({ objectName: 'Cube', targetTris: [1000, 500] }),
    values: { level: 1, 'lod.name': 'Cube_LOD1', target: 1000, tris: 990, 'len(lod.data.polygons)': 600 },
  },
  {
    id: 'mesh-stats',
    emitter: 'meshStatsScript',
    receiptKind: 'mesh-stats',
    build: () => meshStatsScript(),
    values: { meshes: [{ name: 'Cube', tris: 12, verts: 8, polys: 6 }] },
  },
  {
    id: 'composition-blockout',
    emitter: 'compositionBlockoutScript',
    receiptKind: 'blockout',
    build: () =>
      compositionBlockoutScript({
        placed: [],
        unplaced: [],
        gateSummary: { pass: 0, warn: 0, fail: 0, notRun: 0, notGated: 0 },
        note: null,
      }),
    values: { n: 0 },
  },
  {
    id: 'dungeon-to-geometry',
    emitter: 'dungeonToGeometryScript',
    receiptKind: 'dungeon-geometry',
    build: () => dungeonToGeometryScript({ grid: [['floor']], cellSize: 2, wallHeight: 3 }),
    values: { 'len(collection.objects)': 1 },
  },
  {
    id: 'combo-animation',
    emitter: 'comboAnimationScript',
    receiptKind: 'combo-preview',
    build: () =>
      comboAnimationScript({
        comboName: 'Combo',
        hits: [{ time: 0.5, type: 'light', damage: 10, rootMotion: 0 }],
        totalDuration: 1,
      }),
    values: { 'armature.name': 'Combo_Preview', 'len(amt.bones)': 2, '1': 1 },
  },
];

/**
 * Emitters that deliberately print prose only, each with the reason. An exported `*Script`
 * function must be in `SCRIPT_CATALOG` (receipted) or here; `script-contract.test.ts` derives
 * the set from the scripts directory, so a new emitter cannot skip the receipt contract silently.
 * An emitter whose file gains a `pyReceipt` must move to the catalog.
 */
export const PROSE_ONLY_EMITTERS: readonly { emitter: string; reason: string }[] = [
  { emitter: 'createMaterialScript', reason: 'builds a material node tree; no caller reads a result back yet' },
  { emitter: 'worldAlignedUvScript', reason: 'applies a UV projection to the selection; fire-and-forget' },
  { emitter: 'dissolveShaderScript', reason: 'shader-pattern preset; fire-and-forget material build' },
  { emitter: 'fireShaderScript', reason: 'shader-pattern preset; fire-and-forget material build' },
  { emitter: 'waterShaderScript', reason: 'shader-pattern preset; fire-and-forget material build' },
  { emitter: 'deleteObjectScript', reason: 'raises when the object is missing, so a transport OK already means deleted' },
  { emitter: 'duplicateObjectScript', reason: 'raises when the source is missing, so a transport OK already means duplicated' },
];
