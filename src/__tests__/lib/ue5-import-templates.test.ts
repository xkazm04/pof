import { describe, it, expect } from 'vitest';
import {
  generateImportScript,
  generateDataAsset,
  DEFAULT_IMPORT_CONFIG,
  type ImportConfig,
} from '@/lib/visual-gen/ue5-import-templates';
import { buildGlbImportPython, planUeImport } from '@/lib/visual-gen/ue-import-plan';

describe('generateImportScript', () => {
  it('generates valid C++ code for default config', () => {
    const output = generateImportScript(DEFAULT_IMPORT_CONFIG);
    expect(output).toContain('#pragma once');
    expect(output).toContain('#include "CoreMinimal.h"');
    expect(output).toContain('UCLASS(BlueprintType)');
    expect(output).toContain('GENERATED_BODY()');
    expect(output).toContain('UFUNCTION(BlueprintCallable');
    expect(output).toContain('UAssetImportTask');
  });

  it('uses asset name in class name', () => {
    const output = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, assetName: 'WarriorSword' });
    expect(output).toContain('UWarriorSwordImporter');
    expect(output).toContain('WarriorSword');
  });

  it('sets correct mesh type for static mesh', () => {
    const output = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, meshType: 'static' });
    expect(output).toContain('bImportAsSkeletal = false');
  });

  it('sets correct mesh type for skeletal mesh', () => {
    const output = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, meshType: 'skeletal' });
    expect(output).toContain('bImportAsSkeletal = true');
  });

  it('includes content path', () => {
    const output = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, contentPath: '/Game/Characters/Hero' });
    expect(output).toContain('/Game/Characters/Hero');
  });

  it('never asks the FBX importer for its one-box collision fallback (the plan decides collision)', () => {
    // The `generated-mesh-arrives-without-collision` gotcha: bAutoGenerateCollision is a coarse
    // one-box fallback and NOT a substitute — so no config can switch it on.
    const decorative = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'fbx', use: 'decorative' });
    expect(decorative).toContain('bAutoGenerateCollision = false');
    const blocking = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'fbx', use: 'blocking', components: 3 });
    expect(blocking).toContain('bAutoGenerateCollision = false');
    expect(blocking).not.toContain('bAutoGenerateCollision = true');
    expect(blocking).toMatch(/convex/);
  });

  it('reflects material import setting', () => {
    const withMats = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, importMaterials: true });
    expect(withMats).toContain('bImportMaterials = true');

    const noMats = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, importMaterials: false });
    expect(noMats).toContain('bImportMaterials = false');
  });

  it('includes scale factor', () => {
    const output = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, scale: 2.5 });
    expect(output).toContain('2.5');
  });

  it('handles glTF format differently from FBX', () => {
    const fbx = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'fbx' });
    expect(fbx).toContain('UFbxFactory');

    const gltf = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'gltf', use: 'blocking' });
    expect(gltf).not.toContain('UFbxFactory');
  });

  // ── One import plan (challenge-2026-09-29b) ────────────────────────────────
  it('case 8: the glb/gltf output IS the ue-import python, built from the same plan', () => {
    for (const format of ['glb', 'gltf'] as const) {
      const out = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format, use: 'blocking', components: 3 });
      expect(out).toContain('unreal.AssetImportTask');
      expect(out).toContain('set_convex_decomposition_collisions');
      expect(out).not.toContain('bAutoGenerateCollision');
      expect(out).not.toContain('UCLASS');
      // Not a look-alike: byte-for-byte the python the route runs for this plan.
      const plan = planUeImport({ critique: undefined, use: 'blocking', declaredShells: 3 });
      expect(plan.collisionBasis).toBe('declared');
      expect(out.endsWith(buildGlbImportPython(
        DEFAULT_IMPORT_CONFIG.sourcePath || `<path to ${DEFAULT_IMPORT_CONFIG.assetName}.${format}>`,
        DEFAULT_IMPORT_CONFIG.contentPath, DEFAULT_IMPORT_CONFIG.assetName, { collision: plan.collision },
      ))).toBe(true);
    }
  });

  it('case 8: a glb with no use picked emits no runnable import — no default is safe', () => {
    const out = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'glb', use: null });
    expect(out).not.toContain('import_asset_tasks');
    expect(out).toMatch(/use/i);
  });

  it('case 8: an FBX scale of 0.05 prints 0.05f (toFixed(1) printed 0.1f, a 2x error)', () => {
    const out = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'fbx', scale: 0.05 });
    expect(out).toContain('ImportUniformScale = 0.05f');
    expect(out).not.toContain('0.1f');
  });
});

describe('generateDataAsset', () => {
  it('generates valid C++ DataAsset code', () => {
    const output = generateDataAsset(DEFAULT_IMPORT_CONFIG);
    expect(output).toContain('#pragma once');
    expect(output).toContain('UPrimaryDataAsset');
    expect(output).toContain('GENERATED_BODY()');
    expect(output).toContain('GetPrimaryAssetId');
  });

  it('uses correct mesh type in TSoftObjectPtr', () => {
    const staticOutput = generateDataAsset({ ...DEFAULT_IMPORT_CONFIG, meshType: 'static' });
    expect(staticOutput).toContain('UStaticMesh');

    const skelOutput = generateDataAsset({ ...DEFAULT_IMPORT_CONFIG, meshType: 'skeletal' });
    expect(skelOutput).toContain('USkeletalMesh');
  });

  it('includes material overrides array', () => {
    const output = generateDataAsset(DEFAULT_IMPORT_CONFIG);
    expect(output).toContain('MaterialOverrides');
    expect(output).toContain('UMaterialInterface');
  });

  it('includes LOD screen sizes', () => {
    const output = generateDataAsset(DEFAULT_IMPORT_CONFIG);
    expect(output).toContain('LODScreenSizes');
  });

  it('includes asset tags', () => {
    const output = generateDataAsset(DEFAULT_IMPORT_CONFIG);
    expect(output).toContain('Tags');
    expect(output).toContain('FName');
  });

  it('includes import scale metadata', () => {
    const output = generateDataAsset({ ...DEFAULT_IMPORT_CONFIG, scale: 3.0 });
    expect(output).toContain('ImportScale = 3.0f');
  });

  it('uses asset name in class and asset ID', () => {
    const output = generateDataAsset({ ...DEFAULT_IMPORT_CONFIG, assetName: 'DragonShield' });
    expect(output).toContain('UDragonShieldData');
    expect(output).toContain('"DragonShieldData"');
  });
});
