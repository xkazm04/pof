import { describe, it, expect } from 'vitest';
import {
  generateImportScript,
  generateDataAsset,
  DEFAULT_IMPORT_CONFIG,
  type ImportConfig,
} from '@/lib/visual-gen/ue5-import-templates';

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

  it('reflects collision setting', () => {
    const withCollision = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, generateCollision: true });
    expect(withCollision).toContain('bAutoGenerateCollision = true');

    const noCollision = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, generateCollision: false });
    expect(noCollision).toContain('bAutoGenerateCollision = false');
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

    const gltf = generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'gltf' });
    expect(gltf).toContain('Interchange');
    expect(gltf).not.toContain('UFbxFactory');
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
