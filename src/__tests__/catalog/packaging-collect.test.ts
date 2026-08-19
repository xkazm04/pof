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

  // The serve route resolves `?dir=` against the ASSET_DIRS allow-list, so packaging
  // must too — one allow-list, one resolution. This case used to assert a FICTIONAL
  // mapping (`pof_bestiary_grunt.glb` → generated/triposr/) while the real file on
  // disk is `generated/meshes/bestiary_grunt.glb`, which packaging silently DROPPED
  // because the anchored regex never matched a `?dir=` URL.
  it('resolves a ?dir= serve-route URL to the real generated/<dir>/ file it serves', () => {
    const { files, unresolved } = collectPackageInputs([
      // Exactly what `assetUrl('bestiary_grunt.glb', 'meshes')` produces, and exactly
      // what /api/visual-gen/asset serves from generated/meshes/.
      sib('3D & Rig', { glbUrl: '/api/visual-gen/asset/bestiary_grunt.glb?dir=meshes' }),
      sib('3D Generation', { payload: { glbUrl: '/api/visual-gen/asset/pof_1755.glb?dir=tripo3d' } }),
    ]);
    expect(files).toEqual([
      { kind: 'file', sourceStep: '3D & Rig', path: 'generated/meshes/bestiary_grunt.glb' },
      { kind: 'file', sourceStep: '3D Generation', path: 'generated/tripo3d/pof_1755.glb' },
    ]);
    expect(unresolved).toEqual([]);
  });

  it('still resolves a legacy no-query serve-route URL to generated/triposr', () => {
    const { files, unresolved } = collectPackageInputs([
      sib('3D & Rig', { glbUrl: '/api/visual-gen/asset/bestof_fg070.glb' }),
    ]);
    // Every URL already stored in a pipeline artifact predates `?dir=` and must
    // resolve to exactly the file it always resolved to (DEFAULT_ASSET_DIR).
    expect(files).toEqual([
      { kind: 'file', sourceStep: '3D & Rig', path: 'generated/triposr/bestof_fg070.glb' },
    ]);
    expect(unresolved).toEqual([]);
  });

  it('REPORTS a serve-route URL it cannot resolve instead of silently omitting it', () => {
    const { files, unresolved } = collectPackageInputs([
      sib('3D & Rig', { glbUrl: '/api/visual-gen/asset/warrior.glb?dir=../../secrets' }),
      sib('3D Alt', { glbUrl: '/api/visual-gen/asset/warrior.glb?dir=not-a-provider' }),
    ]);
    // Nothing is invented on disk...
    expect(files).toEqual([]);
    // ...but the package can never claim completeness while quietly lacking them.
    expect(unresolved).toHaveLength(2);
    expect(unresolved[0]).toMatchObject({
      kind: 'unresolved',
      sourceStep: '3D & Rig',
      reference: '/api/visual-gen/asset/warrior.glb?dir=../../secrets',
    });
    expect(unresolved[0].reason).toMatch(/allow-list/i);
    expect(unresolved[1].reason).toMatch(/not-a-provider/);
  });

  it('reports an asset URL whose basename the serve route would itself refuse', () => {
    const { files, unresolved } = collectPackageInputs([
      sib('3D & Rig', { glbUrl: '/api/visual-gen/asset/warrior.exe' }),
    ]);
    expect(files).toEqual([]);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].reason).toMatch(/refuse/i);
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
