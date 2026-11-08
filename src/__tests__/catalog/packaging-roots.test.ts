import { describe, it, expect } from 'vitest';
import { buildPackage, isSafePackageId, type PackagingFsDeps } from '@/lib/catalog/packaging/packageArtifacts';

const FILES = new Set([
  'generated/tripo3d/a.glb',
  'C:/app/generated/meshes/b.glb',
  'C:/UE/PoF/Content/Python/c.py',
  'C:/Windows/System32/x.png',
]);

function deps(): PackagingFsDeps {
  return {
    exists: (p) => FILES.has(p.split('\\').join('/')),
    readFile: () => Buffer.from('bytes'),
    writeFile: () => {},
    mkdir: () => {},
    packagesRoot: 'generated/packages',
    now: () => '2026-11-08T00:00:00.000Z',
    ueRoot: () => 'C:/UE/PoF',
    generatedRoot: 'C:/app/generated',
  };
}

describe('buildPackage reference roots', () => {
  it('stages generated/ and UE-root files, reports every other path as missing with a reason', () => {
    const m = buildPackage('items', 'blade', [
      { step: 'S', data: { a: 'generated/tripo3d/a.glb', b: 'C:/app/generated/meshes/b.glb', c: 'C:/UE/PoF/Content/Python/c.py', d: 'C:/Windows/System32/x.png', e: 'generated/../secret.json' }, ueAssets: [] },
    ], deps());
    expect(m.files.map((f) => f.path).sort()).toEqual(['C:/UE/PoF/Content/Python/c.py', 'C:/app/generated/meshes/b.glb', 'generated/tripo3d/a.glb']);
    expect(m.missing.map((x) => x.path).sort()).toEqual(['C:/Windows/System32/x.png', 'generated/../secret.json']);
    expect(m.missing.every((x) => x.reason.length > 0)).toBe(true);
  });

  it('refuses ids that could write the package dir outside packagesRoot', () => {
    expect(isSafePackageId('items')).toBe(true);
    expect(isSafePackageId('..')).toBe(false);
    expect(() => buildPackage('items', '../../evil', [], deps())).toThrow(/unsafe/);
  });
});
