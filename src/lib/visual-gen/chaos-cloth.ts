/**
 * Chaos Cloth attach — the clothing-physics bridge (UE 5.8). Takes a generated garment
 * mesh + a target character (skeletal mesh + physics asset) and builds a Chaos Cloth Asset
 * headless by authoring its Dataflow graph, then regenerating the asset from that graph —
 * closing the "generated character has no clothing/physics modality" gap. Reuses the
 * Experiment Lab runner (full-editor headless Python) so the whole flow runs with no
 * interactive editor. Mirrors the `metahuman-conform.ts` seam.
 *
 * Ground-truthed on the real UE 5.8.0 install (2026-07-22, probes `cloth_probe.py` /
 * `cloth_probe2d.py`): the Chaos Cloth authoring graph is fully scriptable headless via
 * `DataflowEditorBlueprintLibrary` (add/set-property/connect) + `DataflowBlueprintLibrary`
 * (regenerate/evaluate). The proven chain is StaticMeshImport → TransferSkinWeights →
 * SetPhysicsAsset → Terminal. See `docs/research/chaos-cloth-headless-spec.md` for the full recipe.
 *
 * Two ground-truthed gotchas baked in here:
 *  - The Dataflow node type name is the full struct name WITH the `F` prefix
 *    (`FChaosClothAssetStaticMeshImportNode`); the un-prefixed name returns an empty node.
 *  - The Terminal node's collection input pin is `CollectionLod0` (NOT the display name
 *    "Collection LOD 0").
 *
 * The Chaos Cloth Asset plugins are NOT enabled in `PoF.uproject`, so this run declares them
 * via `enablePlugins` (the runner merges them into the `-EnablePlugins` flag) rather than
 * requiring a global .uproject edit.
 *
 * SCOPE (MVP): the auto skin-weight transfer path — no interactive weight-map painting. A
 * physics garment that needs region-weighting (which brush is where, how strong) is the one
 * editor/bridge-gated part; the graph here can be extended with WeightMap / SolverConfig nodes
 * the same way once needed. The garment must be FITTED to the target skeleton — the transfer
 * fails (and `bound` is false) on a mismatched mesh/skeleton pair.
 */
import { runExperiment, type ExperimentResult, type ExperimentSpec, type RunnerDeps } from '@/lib/ue-experiment/runner';

/** Engine plugins this seam needs (beyond PythonScriptPlugin), enabled per-run. */
export const CHAOS_CLOTH_PLUGINS = ['ChaosClothAsset', 'ChaosClothAssetEditor', 'ChaosClothAssetDataflowNodes'];

export interface ClothOptions {
  /** /Game path of the target character skeletal mesh (the skin-weight transfer source). */
  targetSkeletalMesh: string;
  /** /Game path of the character physics asset (the cloth collider). */
  physicsAsset: string;
  /** An existing /Game static-mesh path for the garment. Provide this OR `garmentGlbPath`. */
  garmentMeshPath?: string;
  /** A `.glb` on disk to import as the garment static mesh first (like conform imports its target). */
  garmentGlbPath?: string;
  /** /Game folder for the created Dataflow + ClothAsset. */
  destPath?: string;
  clothAssetName?: string;
  dataflowName?: string;
  /** Name for the imported garment static mesh (only used with `garmentGlbPath`). */
  garmentMeshName?: string;
  /** `EChaosClothAssetTransferSkinWeightsMethod` value (e.g. `ClosestPointOnSurface` for the
   *  no-paint path). Omit to use the engine default (`InpaintWeights`). */
  transferMethod?: string;
  settleMs?: number;
  runExperimentFn?: (spec: ExperimentSpec, deps?: RunnerDeps) => Promise<ExperimentResult>;
}

/**
 * UE editor-Python that builds a Chaos Cloth Dataflow graph and regenerates a ClothAsset from
 * it. Pure (no I/O) so it's unit-testable; the runner wraps it in try/except + DONE and spawns
 * the editor. Emits `POF_CLOTH_*` markers the caller parses.
 */
export function buildClothGraphPython(opts: ClothOptions): string {
  const dest = opts.destPath ?? '/Game/Generated/Cloth';
  const dfName = opts.dataflowName ?? 'DF_Cloth';
  const caName = opts.clothAssetName ?? 'CA_Cloth';
  const meshName = opts.garmentMeshName ?? 'ClothGarment';

  // Resolve the garment: import a glb → static mesh, else use the given /Game path.
  const garmentLines = opts.garmentGlbPath
    ? [
        '_task = unreal.AssetImportTask()',
        `_task.filename = '${opts.garmentGlbPath.replace(/\\/g, '/')}'`,
        `_task.destination_path = '${dest}'`,
        `_task.destination_name = '${meshName}'`,
        '_task.automated = True',
        '_task.replace_existing = True',
        '_task.save = True',
        '_at.import_asset_tasks([_task])',
        '_gp = list(_task.imported_object_paths)',
        "_garment = _gp[0] if _gp else 'NONE'",
      ]
    : [`_garment = '${opts.garmentMeshPath ?? 'NONE'}'`];

  const transferLine = opts.transferMethod
    ? [`if _ntsw: _DFEBL.set_dataflow_node_property(_udf, _ntsw, 'TransferMethod', '${opts.transferMethod}')`]
    : [];

  return [
    '_at = unreal.AssetToolsHelpers.get_asset_tools()',
    '_DFEBL = unreal.DataflowEditorBlueprintLibrary',
    '_DFBL = unreal.DataflowBlueprintLibrary',
    // 1) garment mesh
    ...garmentLines,
    "unreal.log('POF_CLOTH_GARMENT=' + _garment)",
    // 2) Dataflow asset to author into
    `_udf = _at.create_asset('${dfName}', '${dest}', None, unreal.DataflowAssetFactory())`,
    "unreal.log('POF_CLOTH_DATAFLOW=' + (_udf.get_path_name() if _udf else 'NONE'))",
    // 3) add the 4 cloth nodes (node type = struct name WITH the F prefix)
    'def _add(_t, _b):',
    '    _n = _DFEBL.add_dataflow_node(_udf, _t, _b, unreal.Vector2D(0.0, 0.0)) if _udf else None',
    '    _s = str(_n) if _n is not None else ""',
    '    return _s if _s and _s.lower() != "none" else ""',
    "_nsm = _add('FChaosClothAssetStaticMeshImportNode', 'SMImport')",
    "_ntsw = _add('FChaosClothAssetTransferSkinWeightsNode', 'XferWeights')",
    "_nph = _add('FChaosClothAssetSetPhysicsAssetNode', 'SetPhys')",
    "_ntm = _add('FChaosClothAssetTerminalNode', 'Terminal')",
    '_nodes = [n for n in (_nsm, _ntsw, _nph, _ntm) if n]',
    "unreal.log('POF_CLOTH_NODES=' + str(len(_nodes)))",
    // 4) set node properties (asset refs pass as object-path strings)
    `if _nsm: _DFEBL.set_dataflow_node_property(_udf, _nsm, 'StaticMesh', _garment)`,
    `if _ntsw: _DFEBL.set_dataflow_node_property(_udf, _ntsw, 'SkeletalMesh', '${opts.targetSkeletalMesh}')`,
    `if _nph: _DFEBL.set_dataflow_node_property(_udf, _nph, 'PhysicsAsset', '${opts.physicsAsset}')`,
    ...transferLine,
    // 5) connect the chain (terminal input pin = CollectionLod0)
    "_c1 = _DFEBL.connect_dataflow_nodes(_udf, _nsm, 'Collection', _ntsw, 'Collection') if (_nsm and _ntsw) else False",
    "_c2 = _DFEBL.connect_dataflow_nodes(_udf, _ntsw, 'Collection', _nph, 'Collection') if (_ntsw and _nph) else False",
    "_c3 = _DFEBL.connect_dataflow_nodes(_udf, _nph, 'Collection', _ntm, 'CollectionLod0') if (_nph and _ntm) else False",
    "unreal.log('POF_CLOTH_CONNECTED=' + str(bool(_c1 and _c2 and _c3)))",
    'if _udf: unreal.EditorAssetLibrary.save_loaded_asset(_udf)',
    // 6) create the ClothAsset + regenerate/evaluate from the graph (evaluate = the bind signal)
    `_cloth = _at.create_asset('${caName}', '${dest}', None, unreal.ChaosClothAssetFactory())`,
    "unreal.log('POF_CLOTH_ASSET=' + (_cloth.get_path_name() if _cloth else 'NONE'))",
    '_regen = _DFBL.regenerate_asset_from_dataflow(_cloth, False) if _cloth else False',
    "unreal.log('POF_CLOTH_REGEN=' + str(bool(_regen)))",
    '_eval = _DFBL.evaluate_dataflow(_udf, _cloth) if (_udf and _cloth) else False',
    "unreal.log('POF_CLOTH_EVAL=' + str(bool(_eval)))",
  ].join('\n');
}

export interface ClothResult {
  ok: boolean;
  /** /Game path of the created ChaosClothAsset. */
  clothAssetPath?: string;
  /** /Game path of the authored Dataflow asset. */
  dataflowPath?: string;
  /** /Game path of the garment static mesh used. */
  garmentMeshPath?: string;
  /** How many of the 4 cloth Dataflow nodes were added. */
  nodesAdded: number;
  /** Whether the full chain connected (incl. the terminal). */
  connected: boolean;
  /** Whether `regenerate_asset_from_dataflow` rebuilt the ClothAsset. */
  regenerated: boolean;
  /** Whether the graph evaluated — the skin-weight transfer bound (a fitted-garment signal). */
  bound: boolean;
  error?: string;
  logs: string[];
}

/**
 * Build + attach a Chaos Cloth Asset for a character on the connected UE project.
 * `runExperimentFn` is injectable for tests; defaults to the real Experiment Lab runner.
 *
 * The MVP uses the auto skin-weight transfer (no weight-map painting); `bound` (from
 * `evaluate_dataflow`) is false when the garment is not fitted to the target skeleton.
 */
export async function attachClothToCharacter(opts: ClothOptions): Promise<ClothResult> {
  if (!opts.garmentMeshPath && !opts.garmentGlbPath) {
    return {
      ok: false, nodesAdded: 0, connected: false, regenerated: false, bound: false,
      error: 'no garment source: provide garmentMeshPath (an existing /Game static mesh) or garmentGlbPath (a .glb to import)',
      logs: [],
    };
  }
  const run = opts.runExperimentFn ?? runExperiment;
  const res = await run({
    python: buildClothGraphPython(opts),
    capture: false,
    enablePlugins: CHAOS_CLOTH_PLUGINS,
    settleMs: opts.settleMs ?? 300_000, // editor cold-start + optional glb import + graph build/evaluate
  });

  const garment = res.markers['POF_CLOTH_GARMENT'];
  const hasGarment = !!garment && garment !== 'NONE';
  const clothPath = res.markers['POF_CLOTH_ASSET'];
  const hasCloth = !!clothPath && clothPath !== 'NONE';
  const dataflowPath = res.markers['POF_CLOTH_DATAFLOW'];
  const nodesAdded = Number(res.markers['POF_CLOTH_NODES'] ?? '0') || 0;
  const connected = res.markers['POF_CLOTH_CONNECTED'] === 'True';
  const regenerated = res.markers['POF_CLOTH_REGEN'] === 'True';
  const bound = res.markers['POF_CLOTH_EVAL'] === 'True';

  const error = res.error
    ?? (!hasGarment ? 'garment import produced no asset'
      : nodesAdded < 4 ? `graph authoring incomplete (${nodesAdded}/4 cloth nodes added)`
      : !connected ? 'graph wiring failed (a connect_dataflow_nodes call returned False)'
      : !hasCloth ? 'ClothAsset was not created'
      : !regenerated ? 'regenerate_asset_from_dataflow returned False'
      : !bound ? 'skin-weight transfer did not bind — the garment is likely not fitted to the target skeleton (evaluate_dataflow=False)'
      : undefined);

  return {
    ok: res.ok && hasGarment && nodesAdded >= 4 && connected && hasCloth && regenerated && bound,
    clothAssetPath: hasCloth ? clothPath : undefined,
    dataflowPath: dataflowPath && dataflowPath !== 'NONE' ? dataflowPath : undefined,
    garmentMeshPath: hasGarment ? garment : undefined,
    nodesAdded,
    connected,
    regenerated,
    bound,
    error,
    logs: res.logs,
  };
}
