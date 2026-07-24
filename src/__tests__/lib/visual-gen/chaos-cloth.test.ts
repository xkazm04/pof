import { describe, it, expect } from 'vitest';
import { buildClothGraphPython, attachClothToCharacter } from '@/lib/visual-gen/chaos-cloth';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const RES = (markers: Record<string, string>, ok = true): ExperimentResult => ({
  ok, logs: [], markers, durationMs: 1, binary: 'b', args: [],
});

const BASE = {
  targetSkeletalMesh: '/Game/Characters/Player/SK_VSPlayer.SK_VSPlayer',
  physicsAsset: '/Game/Characters/Player/PA_VSPlayer.PA_VSPlayer',
};

describe('buildClothGraphPython', () => {
  it('adds the 4 cloth nodes with the F-prefixed struct names', () => {
    const py = buildClothGraphPython({ ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt' });
    expect(py).toContain('DataflowAssetFactory()');
    expect(py).toContain("'FChaosClothAssetStaticMeshImportNode'");
    expect(py).toContain("'FChaosClothAssetTransferSkinWeightsNode'");
    expect(py).toContain("'FChaosClothAssetSetPhysicsAssetNode'");
    expect(py).toContain("'FChaosClothAssetTerminalNode'");
  });

  it('sets the StaticMesh (from the resolved garment) / SkeletalMesh / PhysicsAsset properties', () => {
    const py = buildClothGraphPython({ ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt' });
    // StaticMesh is set from the runtime _garment var (so the glb-import path also works)
    expect(py).toContain("'StaticMesh', _garment");
    expect(py).toContain("_garment = '/Game/G/SM_Skirt.SM_Skirt'");
    expect(py).toContain(`'SkeletalMesh', '${BASE.targetSkeletalMesh}'`);
    expect(py).toContain(`'PhysicsAsset', '${BASE.physicsAsset}'`);
  });

  it('connects the chain, with the terminal input pin CollectionLod0', () => {
    const py = buildClothGraphPython({ ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt' });
    expect(py).toContain('connect_dataflow_nodes');
    expect(py).toContain("'CollectionLod0'");
    expect(py).toContain('regenerate_asset_from_dataflow');
    expect(py).toContain('evaluate_dataflow');
  });

  it('imports the garment glb first (backslashes normalized) when given a .glb', () => {
    const py = buildClothGraphPython({ ...BASE, garmentGlbPath: 'C:\\gen\\skirt.glb', garmentMeshName: 'SkirtSM' });
    expect(py).toContain('unreal.AssetImportTask()');
    expect(py).toContain("_task.filename = 'C:/gen/skirt.glb'");
    expect(py).toContain("_task.destination_name = 'SkirtSM'");
  });

  it('uses an existing static mesh path directly when no glb given (no import task)', () => {
    const py = buildClothGraphPython({ ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt' });
    expect(py).not.toContain('unreal.AssetImportTask()');
    expect(py).toContain("_garment = '/Game/G/SM_Skirt.SM_Skirt'");
  });

  it('emits a TransferMethod line only when a method is supplied', () => {
    expect(buildClothGraphPython({ ...BASE, garmentMeshPath: '/Game/G/x.x' })).not.toContain('TransferMethod');
    const py = buildClothGraphPython({ ...BASE, garmentMeshPath: '/Game/G/x.x', transferMethod: 'ClosestPointOnSurface' });
    expect(py).toContain("'TransferMethod', 'ClosestPointOnSurface'");
  });

  it('defaults the destination folder and asset names', () => {
    const py = buildClothGraphPython({ ...BASE, garmentMeshPath: '/Game/G/x.x' });
    expect(py).toContain("'/Game/Generated/Cloth'");
  });
});

describe('attachClothToCharacter', () => {
  it('enables the Chaos Cloth plugins for the run', async () => {
    let seenPlugins: string[] | undefined;
    await attachClothToCharacter({
      ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt',
      runExperimentFn: async (spec) => { seenPlugins = spec.enablePlugins; return RES({ POF_EXPERIMENT_DONE: 'ok' }); },
    });
    expect(seenPlugins).toContain('ChaosClothAsset');
    expect(seenPlugins).toContain('ChaosClothAssetDataflowNodes');
  });

  it('returns the cloth asset on a successful bind', async () => {
    const res = await attachClothToCharacter({
      ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt',
      runExperimentFn: async () => RES({
        POF_CLOTH_GARMENT: '/Game/G/SM_Skirt.SM_Skirt',
        POF_CLOTH_DATAFLOW: '/Game/Generated/Cloth/DF_Cloth.DF_Cloth',
        POF_CLOTH_NODES: '4',
        POF_CLOTH_CONNECTED: 'True',
        POF_CLOTH_ASSET: '/Game/Generated/Cloth/CA_Cloth.CA_Cloth',
        POF_CLOTH_REGEN: 'True',
        POF_CLOTH_EVAL: 'True',
        POF_EXPERIMENT_DONE: 'ok',
      }),
    });
    expect(res.ok).toBe(true);
    expect(res.clothAssetPath).toBe('/Game/Generated/Cloth/CA_Cloth.CA_Cloth');
    expect(res.dataflowPath).toBe('/Game/Generated/Cloth/DF_Cloth.DF_Cloth');
    expect(res.nodesAdded).toBe(4);
    expect(res.bound).toBe(true);
  });

  it('errors without calling the runner when no garment source is given', async () => {
    let called = false;
    const res = await attachClothToCharacter({
      ...BASE,
      runExperimentFn: async () => { called = true; return RES({}); },
    });
    expect(called).toBe(false);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/garment/i);
  });

  it('fails (with reason) when the garment import produced no asset', async () => {
    const res = await attachClothToCharacter({
      ...BASE, garmentGlbPath: 'C:/gen/skirt.glb',
      runExperimentFn: async () => RES({ POF_CLOTH_GARMENT: 'NONE', POF_CLOTH_NODES: '4', POF_EXPERIMENT_DONE: 'ok' }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no asset|garment/i);
  });

  it('fails (with the fitted-garment reason) when the skin-weight transfer did not bind', async () => {
    const res = await attachClothToCharacter({
      ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt',
      runExperimentFn: async () => RES({
        POF_CLOTH_GARMENT: '/Game/G/SM_Skirt.SM_Skirt',
        POF_CLOTH_DATAFLOW: '/Game/Generated/Cloth/DF_Cloth.DF_Cloth',
        POF_CLOTH_NODES: '4',
        POF_CLOTH_CONNECTED: 'True',
        POF_CLOTH_ASSET: '/Game/Generated/Cloth/CA_Cloth.CA_Cloth',
        POF_CLOTH_REGEN: 'True',
        POF_CLOTH_EVAL: 'False',
        POF_EXPERIMENT_DONE: 'ok',
      }),
    });
    expect(res.ok).toBe(false);
    expect(res.bound).toBe(false);
    expect(res.error).toMatch(/fitted|transfer|skeleton/i);
  });

  it('propagates an experiment-level failure', async () => {
    const res = await attachClothToCharacter({
      ...BASE, garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt',
      runExperimentFn: async () => RES({ POF_EXPERIMENT_ERROR: 'boom' }, false),
    });
    expect(res.ok).toBe(false);
  });
});
