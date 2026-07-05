import { describe, it, expect } from 'vitest';
import {
  buildConformPython, conformMeshToMetaHuman,
  buildAssemblePython, assembleMetaHuman,
} from '@/lib/visual-gen/metahuman-conform';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const RES = (markers: Record<string, string>, ok = true): ExperimentResult => ({
  ok, logs: [], markers, durationMs: 1, binary: 'b', args: [],
});

describe('buildConformPython', () => {
  it('imports the glb, extracts conform topology, and conforms the body', () => {
    const py = buildConformPython('C:\\gen\\jinx.glb', { destPath: '/Game/X', charName: 'MH_Jinx', targetMeshName: 'JinxTarget' });
    expect(py).toContain('unreal.AssetImportTask()');
    expect(py).toContain("task.filename = 'C:/gen/jinx.glb'"); // backslashes normalized
    expect(py).toContain("task.destination_name = 'JinxTarget'");
    expect(py).toContain('get_mesh_data_for_conforming');
    expect(py).toContain('unreal.MetaHumanCharacterFactoryNew()');
    expect(py).toContain('conform_body_to_target(_char, _verts, [], True, True)');
    expect(py).toContain('commit_body_state');
    expect(py).toContain('POF_MH_CONFORMED=');
  });

  it('defaults the destination + asset names', () => {
    const py = buildConformPython('C:/gen/x.glb');
    expect(py).toContain("task.destination_path = '/Game/Generated/MetaHumans'");
    expect(py).toContain("'MH_Conformed'");
  });
});

describe('conformMeshToMetaHuman', () => {
  it('returns the conformed character on success', async () => {
    const res = await conformMeshToMetaHuman('C:/gen/jinx.glb', {
      runExperimentFn: async () => RES({
        POF_MH_IMPORT: '/Game/X/JinxTarget.JinxTarget',
        POF_MH_VERTS: '180007',
        POF_MH_CHAR: '/Game/X/MH_Jinx.MH_Jinx',
        POF_MH_CONFORMED: 'True',
        POF_EXPERIMENT_DONE: 'ok',
      }),
    });
    expect(res.ok).toBe(true);
    expect(res.characterPath).toBe('/Game/X/MH_Jinx.MH_Jinx');
    expect(res.targetMeshPath).toBe('/Game/X/JinxTarget.JinxTarget');
    expect(res.vertexCount).toBe(180007);
  });

  it('fails when the glb import produced no asset', async () => {
    const res = await conformMeshToMetaHuman('C:/gen/jinx.glb', {
      runExperimentFn: async () => RES({ POF_MH_IMPORT: 'NONE', POF_MH_VERTS: '0', POF_MH_CHAR: 'NONE', POF_MH_CONFORMED: 'False' }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no asset/i);
  });

  it('fails (with reason) when the body conform returns False', async () => {
    const res = await conformMeshToMetaHuman('C:/gen/jinx.glb', {
      runExperimentFn: async () => RES({
        POF_MH_IMPORT: '/Game/X/JinxTarget.JinxTarget',
        POF_MH_VERTS: '180007',
        POF_MH_CHAR: '/Game/X/MH_Jinx.MH_Jinx',
        POF_MH_CONFORMED: 'False',
      }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/returned False/i);
  });

  it('propagates an experiment-level failure', async () => {
    const res = await conformMeshToMetaHuman('C:/gen/jinx.glb', {
      runExperimentFn: async () => RES({ POF_EXPERIMENT_ERROR: 'boom' }, false),
    });
    expect(res.ok).toBe(false);
  });
});

describe('buildAssemblePython', () => {
  it('gates assembly on can_build_meta_human before build_meta_human', () => {
    const py = buildAssemblePython('/Game/X/MH_Jinx', { nameOverride: 'JinxHero' });
    expect(py).toContain("unreal.load_asset('/Game/X/MH_Jinx')");
    expect(py).toContain('can_build_meta_human(_char, True)');
    expect(py).toContain('unreal.MetaHumanCharacterEditorBuildParameters()');
    expect(py).toContain("set_editor_property('name_override', 'JinxHero')");
    expect(py).toContain('build_meta_human(_char, _p)');
    expect(py).toContain('POF_MH_CAN_BUILD=');
    expect(py).toContain('POF_MH_ASSEMBLED=');
  });

  it('omits the name override when not given', () => {
    const py = buildAssemblePython('/Game/X/MH_Jinx');
    expect(py).not.toContain('name_override');
  });
});

describe('assembleMetaHuman', () => {
  it('assembles when the character is build-ready', async () => {
    const res = await assembleMetaHuman('/Game/X/MH_Jinx', {
      runExperimentFn: async () => RES({ POF_MH_CHAR: '/Game/X/MH_Jinx.MH_Jinx', POF_MH_CAN_BUILD: 'True', POF_MH_ASSEMBLED: 'True', POF_EXPERIMENT_DONE: 'ok' }),
    });
    expect(res.ok).toBe(true);
    expect(res.canBuild).toBe(true);
    expect(res.assembled).toBe(true);
  });

  it('reports the Optional-Content install step when not build-ready', async () => {
    const res = await assembleMetaHuman('/Game/X/MH_Jinx', {
      runExperimentFn: async () => RES({ POF_MH_CHAR: '/Game/X/MH_Jinx.MH_Jinx', POF_MH_CAN_BUILD: 'False', POF_MH_ASSEMBLED: 'False' }),
    });
    expect(res.ok).toBe(false);
    expect(res.canBuild).toBe(false);
    expect(res.error).toMatch(/Optional Content/i);
  });
});
