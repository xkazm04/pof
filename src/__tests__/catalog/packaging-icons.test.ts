/**
 * Packaging resolves the 2D half too — or REPORTS why it cannot.
 *
 * Forced-failure suite for `packaging-resolves-icons`. Wave 13 taught the collector to
 * resolve `/api/visual-gen/asset/<name>?dir=…` through the `ASSET_DIRS` allow-list and to
 * report what it could not place. `/api/visual-gen/icon/<name>` — the per-step library the
 * gap-loop campaigns write, and the URL a gallery candidate's `imageUrl` actually holds —
 * was resolved by nothing: it has no `generated/` segment and no drive letter, so
 * `looksLikeFile` rejected it and packaging DROPPED it. A row whose selected candidate
 * showed a real icon shipped a package silently missing that image.
 *
 * Assertions are on PATHS, never on disk existence: `generated/` is gitignored, so an
 * existence assertion is red on a fresh checkout (the wave-13 lesson). Whether the bytes
 * are there is `buildPackage`'s job, and it reports absence into `missing[]` — pinned
 * below with injected fs deps.
 */
import { describe, it, expect } from 'vitest';
import { collectPackageInputs, type SiblingArtifact } from '@/lib/catalog/packaging/collect';
import { buildPackage, type PackagingFsDeps } from '@/lib/catalog/packaging/packageArtifacts';
import { iconSlug } from '@/lib/visual-gen/generated-icons';

const sib = (step: string, data: Record<string, unknown>, ueAssets: string[] = []): SiblingArtifact => ({
  step,
  data,
  ueAssets,
});

/** A filename the real generator would write for this step, built with the generator's own rule. */
const iconFile = (catalogId: string, step: string) => `${iconSlug(catalogId, step)}.jpg`;

describe('collectPackageInputs — icon serve-route URLs', () => {
  it('resolves an icon URL to its file under generated/icons/', () => {
    const name = iconFile('items', 'Icon 2D Art');
    const { files, unresolved } = collectPackageInputs([
      sib('Icon 2D Art', { imageUrl: `/api/visual-gen/icon/${name}` }),
    ]);
    expect(files).toEqual([
      { kind: 'file', sourceStep: 'Icon 2D Art', path: `generated/icons/${name}` },
    ]);
    expect(unresolved).toEqual([]);
  });

  it('resolves the icon a gallery candidate actually carries (nested under genHistory)', () => {
    const name = iconFile('bestiary', 'Concept 2D Art');
    const { files } = collectPackageInputs([
      sib('Concept 2D Art', {
        genHistory: {
          batches: [{ id: 'b0', candidates: [{ id: 'b0-c0', imageUrl: `/api/visual-gen/icon/${name}` }] }],
        },
        imageUrl: `/api/visual-gen/icon/${name}`, // projected selection — same file, deduped
      }),
    ]);
    expect(files).toEqual([{ kind: 'file', sourceStep: 'Concept 2D Art', path: `generated/icons/${name}` }]);
  });

  it('decodes a percent-encoded icon name exactly as the serve route does', () => {
    const { files } = collectPackageInputs([
      sib('Icon', { imageUrl: '/api/visual-gen/icon/characters_Icon_2D_Art_portrait_.jpg' }),
      sib('Icon B', { imageUrl: `/api/visual-gen/icon/${encodeURIComponent('items_icon_2d_art.jpg')}` }),
    ]);
    expect(files.map((f) => f.path)).toEqual([
      'generated/icons/characters_Icon_2D_Art_portrait_.jpg',
      'generated/icons/items_icon_2d_art.jpg',
    ]);
  });

  it('REPORTS an icon URL whose basename the serve route would itself refuse', () => {
    const { files, unresolved } = collectPackageInputs([
      sib('Icon', { imageUrl: '/api/visual-gen/icon/steal.exe' }),
      sib('Icon B', { imageUrl: '/api/visual-gen/icon/..%2F..%2Fpackage.json' }),
    ]);
    expect(files).toEqual([]);
    expect(unresolved).toHaveLength(2);
    expect(unresolved[0]).toMatchObject({ kind: 'unresolved', sourceStep: 'Icon', reference: '/api/visual-gen/icon/steal.exe' });
    expect(unresolved[0].reason).toMatch(/refuse/i);
    expect(unresolved[1].reason).toMatch(/refuse/i);
  });

  it('REPORTS an icon URL with an undecodable filename rather than dropping it', () => {
    const { files, unresolved } = collectPackageInputs([
      sib('Icon', { imageUrl: '/api/visual-gen/icon/%E0%A4%A.jpg' }),
    ]);
    expect(files).toEqual([]);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].reason).toMatch(/undecodable/i);
  });

  it('composes with the mesh path unchanged — one row, both routes, in one pass', () => {
    const icon = iconFile('character-pipeline', 'Concept 2D');
    const { files, unresolved } = collectPackageInputs([
      sib('Concept 2D', { imageUrl: `/api/visual-gen/icon/${icon}` }),
      sib('3D Generation', { payload: { glbUrl: '/api/visual-gen/asset/pof_1755.glb?dir=tripo3d' } }),
      sib('3D & Rig', { glbUrl: '/api/visual-gen/asset/legacy.glb' }),
      sib('Broken', { glbUrl: '/api/visual-gen/asset/warrior.glb?dir=not-a-provider' }),
    ]);
    expect(files).toEqual([
      { kind: 'file', sourceStep: 'Concept 2D', path: `generated/icons/${icon}` },
      { kind: 'file', sourceStep: '3D Generation', path: 'generated/tripo3d/pof_1755.glb' },
      { kind: 'file', sourceStep: '3D & Rig', path: 'generated/triposr/legacy.glb' },
    ]);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].reason).toMatch(/not-a-provider/);
  });

  it('does NOT mistake a look-alike string for an icon URL', () => {
    const { files, unresolved } = collectPackageInputs([
      sib('Prose', { note: 'see /api/visual-gen/icons for the manifest' }),
      // A nested path is not a URL this route can serve (its allow-list is a bare
      // basename), and a different route is not this route.
      sib('Nested', { url: '/api/visual-gen/icon/sub/dir/pic.jpg' }),
      sib('Other route', { url: '/api/visual-gen/preview/pic.jpg' }),
    ]);
    // Neither is claimed as a resolved icon...
    expect(files.map((f) => f.path)).not.toContain('generated/icons/pic.jpg');
    // ...and neither is invented into `unresolved` either: only a string that IS this
    // route's URL shape may be reported against it.
    expect(unresolved).toEqual([]);
    // They fall through to the pre-existing absolute-path heuristic unchanged (they start
    // with `/` and carry a media extension), which is harmless: `buildPackage` stats them
    // and reports whatever is not on disk into `missing[]`. Pinned so this stays a
    // deliberate pass-through rather than an accident of the new branch.
    expect(files.map((f) => f.path)).toEqual([
      '/api/visual-gen/icon/sub/dir/pic.jpg',
      '/api/visual-gen/preview/pic.jpg',
    ]);
  });
});

describe('buildPackage — an icon reference reaches the manifest, present or missing', () => {
  const deps = (present: Set<string>): PackagingFsDeps => ({
    exists: (p) => present.has(p),
    readFile: () => Buffer.from('icon-bytes'),
    writeFile: () => {},
    mkdir: () => {},
    packagesRoot: 'generated/packages',
    now: () => '2026-08-19T00:00:00.000Z',
    ueRoot: () => null,
  });

  const name = iconFile('items', 'Icon 2D Art');
  const siblings = [sib('Icon 2D Art', { imageUrl: `/api/visual-gen/icon/${name}` })];

  it('lists the icon as a real packaged file when the bytes are on disk', () => {
    const m = buildPackage('items', 'sword', siblings, deps(new Set([`generated/icons/${name}`])));
    expect(m.files).toHaveLength(1);
    expect(m.files[0]).toMatchObject({ origin: 'referenced', path: `generated/icons/${name}`, sourceStep: 'Icon 2D Art' });
    expect(m.missing).toEqual([]);
  });

  it('reports the icon into missing[] when the bytes are not there — never a silent omission', () => {
    const m = buildPackage('items', 'sword', siblings, deps(new Set()));
    expect(m.files).toEqual([]);
    expect(m.missing).toHaveLength(1);
    expect(m.missing[0]).toMatchObject({ path: `generated/icons/${name}`, sourceStep: 'Icon 2D Art' });
    expect(m.missing[0].reason).toMatch(/not found/i);
  });

  it('folds an UNRESOLVABLE icon URL into missing[] with the collector reason', () => {
    const m = buildPackage(
      'items',
      'sword',
      [sib('Icon 2D Art', { imageUrl: '/api/visual-gen/icon/steal.exe' })],
      deps(new Set()),
    );
    expect(m.files).toEqual([]);
    expect(m.missing).toHaveLength(1);
    expect(m.missing[0]).toMatchObject({ path: '/api/visual-gen/icon/steal.exe', sourceStep: 'Icon 2D Art' });
    expect(m.missing[0].reason).toMatch(/refuse/i);
  });
});
