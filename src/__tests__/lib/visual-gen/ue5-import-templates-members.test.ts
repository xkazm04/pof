import { describe, it, expect } from 'vitest';
import { generateImportScript, DEFAULT_IMPORT_CONFIG } from '@/lib/visual-gen/ue5-import-templates';

// Member locations read from UE 5.8 Engine/Source/Editor/UnrealEd/Classes/Factories:
// FbxImportUI.h:142 bAutoComputeLodDistances, FbxStaticMeshImportData.h:53 bAutoGenerateCollision.
const fbx = (over = {}) => generateImportScript({ ...DEFAULT_IMPORT_CONFIG, format: 'fbx', use: 'blocking', ...over });

describe('the FBX importer template addresses members where the engine declares them', () => {
  it('sets collision on the static mesh import data', () => {
    expect(fbx()).toContain('ImportUI->StaticMeshImportData->bAutoGenerateCollision = false');
    expect(fbx()).not.toContain('ImportUI->bAutoGenerateCollision');
  });
  it('sets LOD distances on the import UI', () => {
    const out = fbx({ lodCount: 2 });
    expect(out).toContain('ImportUI->bAutoComputeLodDistances = true');
    expect(out).not.toContain('StaticMeshImportData->bAutoComputeLodDistances');
  });
  it('applies scale to the skeletal import data for a skeletal mesh', () => {
    const out = fbx({ meshType: 'skeletal', scale: 0.5 });
    expect(out).toContain('ImportUI->SkeletalMeshImportData->ImportUniformScale = 0.5f');
    expect(out).not.toContain('StaticMeshImportData->ImportUniformScale');
  });
  it('includes the headers those members need, before the generated header', () => {
    const out = fbx();
    for (const h of ['Factories/FbxImportUI.h', 'Factories/FbxStaticMeshImportData.h', 'Factories/FbxSkeletalMeshImportData.h']) {
      expect(out.indexOf(`#include "${h}"`)).toBeGreaterThan(-1);
      expect(out.indexOf(`#include "${h}"`)).toBeLessThan(out.indexOf('.generated.h"'));
    }
  });
});
