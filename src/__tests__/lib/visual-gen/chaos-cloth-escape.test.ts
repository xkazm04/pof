import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { spawnSync } from 'node:child_process';
import { buildClothGraphPython, type ClothOptions } from '@/lib/visual-gen/chaos-cloth';

afterEach(cleanup);

const BASE: ClothOptions = {
  targetSkeletalMesh: '/Game/Characters/Player/SK_VSPlayer.SK_VSPlayer',
  physicsAsset: '/Game/Characters/Player/PA_VSPlayer.PA_VSPlayer',
  garmentMeshPath: '/Game/G/SM_Skirt.SM_Skirt',
};

// Parse (never run) the generated script and list any import statement in it. The legitimate
// script has none, so an `import os` smuggled through an option shows up here.
const PARSE = [
  'import ast, sys, json',
  'tree = ast.parse(sys.stdin.read())',
  'print(json.dumps([type(n).__name__ for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom))]))',
].join('\n');

function importsIn(script: string): string[] {
  const r = spawnSync('python', ['-I', '-c', PARSE], { input: script, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`python parse failed: ${r.stderr}`);
  return JSON.parse(r.stdout) as string[];
}

const EVIL = "x'; import os; y = '";

describe('buildClothGraphPython escapes every interpolated option', () => {
  it('ordinary options produce a script with no import statement', () => {
    expect(importsIn(buildClothGraphPython(BASE))).toEqual([]);
  });

  it.each([
    ['targetSkeletalMesh', { targetSkeletalMesh: EVIL }],
    ['physicsAsset', { physicsAsset: EVIL }],
    ['garmentMeshPath', { garmentMeshPath: EVIL }],
    ['garmentGlbPath', { garmentMeshPath: undefined, garmentGlbPath: EVIL }],
    ['destPath', { destPath: EVIL }],
    ['clothAssetName', { clothAssetName: EVIL }],
    ['dataflowName', { dataflowName: EVIL }],
    ['garmentMeshName', { garmentMeshName: EVIL, garmentMeshPath: undefined, garmentGlbPath: 'C:/g.glb' }],
    ['transferMethod', { transferMethod: EVIL }],
  ] as [string, Partial<ClothOptions>][])('a quote in %s stays inside its literal', (_name, over) => {
    expect(importsIn(buildClothGraphPython({ ...BASE, ...over }))).toEqual([]);
  });

  it('a newline in a value cannot start a new statement', () => {
    const script = buildClothGraphPython({ ...BASE, physicsAsset: "/Game/A'\nimport os\n#" });
    expect(importsIn(script)).toEqual([]);
  });

  it('ordinary paths are byte-identical to the literal form', () => {
    const script = buildClothGraphPython({ ...BASE, garmentMeshPath: undefined, garmentGlbPath: ['C:', 'art', 'garment.glb'].join(String.fromCharCode(92)), transferMethod: 'ClosestPointOnSurface' });
    expect(script).toContain("_task.filename = 'C:/art/garment.glb'");
    expect(script).toContain("_task.destination_path = '/Game/Generated/Cloth'");
    expect(script).toContain(`'SkeletalMesh', '${BASE.targetSkeletalMesh}'`);
    expect(script).toContain("'TransferMethod', 'ClosestPointOnSurface'");
  });
});
