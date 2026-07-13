import { describe, it, expect } from 'vitest';
import { buildPackage, type PackagingFsDeps } from '@/lib/catalog/packaging/packageArtifacts';
import type { SiblingArtifact } from '@/lib/catalog/packaging/collect';

const B64 = Buffer.from('icon-bytes').toString('base64');

const sibs: SiblingArtifact[] = [
  { step: '3D Model', data: { meshPath: 'generated/tripo3d/warrior.glb' }, ueAssets: ['/Game/Items/SM_Warrior'] },
  { step: 'Icon Gallery', data: { swatch: `url(data:image/jpeg;base64,${B64})` }, ueAssets: [] },
  { step: 'Audio', data: { clip: 'generated/audio/missing-clip.wav' }, ueAssets: [] },
];

/** In-memory fs seam: one real file (the glb), the audio clip missing. */
function fakeFs(): { deps: PackagingFsDeps; written: Map<string, Buffer | string> } {
  const written = new Map<string, Buffer | string>();
  const existing = new Map<string, Buffer>([['generated/tripo3d/warrior.glb', Buffer.from('glb-bytes-here')]]);
  const norm = (p: string) => p.replace(/\\/g, '/');
  const deps: PackagingFsDeps = {
    exists: (p) => existing.has(norm(p)) || written.has(norm(p)),
    readFile: (p) => {
      const f = existing.get(norm(p)) ?? written.get(norm(p));
      if (!f) throw new Error(`ENOENT ${p}`);
      return Buffer.isBuffer(f) ? f : Buffer.from(f);
    },
    writeFile: (p, content) => { written.set(norm(p), content as Buffer); },
    mkdir: () => {},
    packagesRoot: 'generated/packages',
    now: () => '2026-07-13T12:00:00.000Z',
  };
  return { deps, written };
}

describe('buildPackage', () => {
  it('hashes referenced files in place, materializes data-URLs, and lists honest missing[]', () => {
    const { deps, written } = fakeFs();
    const manifest = buildPackage('items', 'rusted-blade', sibs, deps);

    // referenced glb: present → hashed in place
    const glb = manifest.files.find((f) => f.origin === 'referenced');
    expect(glb).toMatchObject({ sourceStep: '3D Model', bytes: 14 });
    expect(glb!.sha1).toMatch(/^[0-9a-f]{40}$/);

    // data-URL swatch: materialized into the package dir
    const mat = manifest.files.find((f) => f.origin === 'materialized');
    expect(mat).toBeTruthy();
    expect(mat!.path).toMatch(/^generated\/packages\/items\/rusted-blade\//);
    expect(written.has(mat!.path.replace(/\\/g, '/'))).toBe(true);
    expect(mat!.bytes).toBe(Buffer.from(B64, 'base64').length);

    // missing audio clip: reported, not dropped
    expect(manifest.missing).toEqual([
      { path: 'generated/audio/missing-clip.wav', sourceStep: 'Audio', reason: 'referenced file not found on disk' },
    ]);

    // declarations pass through; manifest.json is written
    expect(manifest.ueDeclarations).toEqual(['/Game/Items/SM_Warrior']);
    const manifestFile = [...written.keys()].find((k) => k.endsWith('manifest.json'));
    expect(manifestFile).toBe('generated/packages/items/rusted-blade/manifest.json');
    expect(JSON.parse(String(written.get(manifestFile!)))).toMatchObject({ catalogId: 'items', entityId: 'rusted-blade' });
  });

  it('an empty sibling set yields an empty—but still honest—manifest', () => {
    const { deps } = fakeFs();
    const manifest = buildPackage('items', 'rusted-blade', [], deps);
    expect(manifest.files).toEqual([]);
    expect(manifest.missing).toEqual([]);
    expect(manifest.packagedAt).toBe('2026-07-13T12:00:00.000Z');
  });
});
