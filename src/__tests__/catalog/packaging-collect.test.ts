import { describe, it, expect } from 'vitest';
import { collectPackageInputs, type SiblingArtifact } from '@/lib/catalog/packaging/collect';

const sib = (step: string, data: Record<string, unknown>, ueAssets: string[] = []): SiblingArtifact => ({
  step,
  data,
  ueAssets,
});

describe('collectPackageInputs', () => {
  it('collects real file references (generated/ paths + media extensions) from nested data', () => {
    const { files } = collectPackageInputs([
      sib('3D Model', { result: { meshPath: 'generated/tripo3d/warrior.glb' } }),
      sib('Icon', { rows: [{ icon: 'C:/Users/kazda/kiro/pof/generated/icons/items__Icon.jpg' }] }),
    ]);
    expect(files).toEqual([
      { kind: 'file', sourceStep: '3D Model', path: 'generated/tripo3d/warrior.glb' },
      { kind: 'file', sourceStep: 'Icon', path: 'C:/Users/kazda/kiro/pof/generated/icons/items__Icon.jpg' },
    ]);
  });

  it('extracts embedded data-URL swatches (incl. inside url(...)) as materializable inputs', () => {
    const b64 = Buffer.from('img').toString('base64');
    const { dataUrls } = collectPackageInputs([
      sib('Icon Gallery', {
        genHistory: {
          batches: [{ candidates: [{ id: 'b0-c0', swatch: `url(data:image/jpeg;base64,${b64})` }] }],
        },
      }),
    ]);
    expect(dataUrls).toHaveLength(1);
    expect(dataUrls[0]).toMatchObject({ kind: 'dataUrl', sourceStep: 'Icon Gallery', mime: 'image/jpeg', base64: b64 });
    expect(dataUrls[0].name).toMatch(/icon-gallery/i);
  });

  it('ignores prose, UE object paths, and non-file strings', () => {
    const { files, dataUrls } = collectPackageInputs([
      sib('Brief', { text: 'a sword of generated lore. See /Game/Items/DA_Sword for details.' }),
      sib('Economy', { price: 120, curve: 'exponential' }),
    ]);
    expect(files).toEqual([]);
    expect(dataUrls).toEqual([]);
  });

  it('maps /api/visual-gen/asset/ serve-route URLs to their generated/triposr disk paths', () => {
    const { files } = collectPackageInputs([
      sib('3D & Rig', { glbUrl: '/api/visual-gen/asset/pof_bestiary_grunt.glb' }),
    ]);
    expect(files).toEqual([
      { kind: 'file', sourceStep: '3D & Rig', path: 'generated/triposr/pof_bestiary_grunt.glb' },
    ]);
  });

  it('deduplicates repeated references and aggregates ueAssets declarations', () => {
    const { files, ueDeclarations } = collectPackageInputs([
      sib('3D Model', { meshPath: 'generated/a.glb', preview: { source: 'generated/a.glb' } }, ['/Game/Items/SM_A']),
      sib('Packaging-ish sibling', {}, ['/Game/Items/SM_A', '/Game/Items/DA_A']),
    ]);
    expect(files).toHaveLength(1);
    expect(ueDeclarations).toEqual(['/Game/Items/SM_A', '/Game/Items/DA_A']);
  });
});
