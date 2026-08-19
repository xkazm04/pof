/**
 * The mesh manifest sees every provider dir — and the serve route still refuses
 * everything it always refused.
 *
 * Forced-failure suite for `mesh-gallery-sees-every-provider`: before this, both routes
 * hardcoded `generated/triposr` while the generate route writes `generated/<providerId>/`
 * and mesh-finish writes `generated/mesh-finish/`, so a Tripo cloud mesh could neither be
 * listed nor served. These tests write real files into the real `generated/<dir>` tree
 * (uniquely named, removed afterwards) and drive the real route handlers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET as listAssets } from '@/app/api/visual-gen/assets/route';
import { GET as serveAsset } from '@/app/api/visual-gen/asset/[name]/route';
import { ASSET_DIRS, DEFAULT_ASSET_DIR } from '@/lib/visual-gen/generated-assets';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';

const STAMP = `pof_lotav_${process.pid}`;
const BYTES = Buffer.from('glTF-fake-bytes');

/** One real file per whitelisted dir, so the table below is exhaustive by construction. */
const FIXTURES = ASSET_DIRS.map((d) => ({
  dir: d.dir,
  label: d.label,
  name: `${STAMP}_${d.dir.replace(/[^a-z0-9]/gi, '')}.glb`,
}));

const diskPath = (dir: string, name: string) => join(process.cwd(), 'generated', dir, name);

beforeAll(() => {
  for (const f of FIXTURES) {
    mkdirSync(join(process.cwd(), 'generated', f.dir), { recursive: true });
    writeFileSync(diskPath(f.dir, f.name), BYTES);
  }
});

afterAll(() => {
  for (const f of FIXTURES) {
    try { rmSync(diskPath(f.dir, f.name)); } catch { /* already gone */ }
  }
});

async function assets(): Promise<GeneratedAsset[]> {
  const res = await listAssets();
  const body = await res.json() as { success: boolean; data: { assets: GeneratedAsset[] } };
  expect(body.success).toBe(true);
  return body.data.assets;
}

function serve(name: string, query = '') {
  const url = `http://localhost/api/visual-gen/asset/${name}${query}`;
  return serveAsset(new NextRequest(url), { params: Promise.resolve({ name }) });
}

describe('GET /api/visual-gen/assets — every provider dir is visible', () => {
  it('lists a mesh from generated/tripo3d (the cloud provider that was invisible)', async () => {
    const f = FIXTURES.find((x) => x.dir === 'tripo3d')!;
    const hit = (await assets()).find((a) => a.name === f.name);
    expect(hit).toBeDefined();
    expect(hit!.provider).toBe('tripo3d');
    expect(hit!.providerLabel).toBe(f.label);
    expect(hit!.url).toContain('dir=tripo3d');
  });

  it.each(FIXTURES)('lists and TAGS the mesh in generated/$dir', async (f) => {
    const hit = (await assets()).find((a) => a.name === f.name);
    expect(hit).toBeDefined();
    expect(hit!.provider).toBe(f.dir);
  });

  it('keeps the legacy bare URL for the default dir, so stored artifact URLs still resolve', async () => {
    const f = FIXTURES.find((x) => x.dir === DEFAULT_ASSET_DIR)!;
    const hit = (await assets()).find((a) => a.name === f.name);
    expect(hit!.url).toBe(`/api/visual-gen/asset/${f.name}`); // no query at all
  });

  it('sorts newest-first ACROSS dirs, not dir by dir', async () => {
    const list = await assets();
    const times = list.map((a) => a.mtimeMs);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe('GET /api/visual-gen/asset/:name — serves any whitelisted dir', () => {
  it.each(FIXTURES)('serves the mesh in generated/$dir', async (f) => {
    const query = f.dir === DEFAULT_ASSET_DIR ? '' : `?dir=${f.dir}`;
    const res = await serve(f.name, query);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('model/gltf-binary');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(BYTES.toString());
  });

  it('a file in a non-default dir is NOT reachable without naming that dir', async () => {
    const f = FIXTURES.find((x) => x.dir === 'tripo3d')!;
    const res = await serve(f.name); // no ?dir → default dir, where it does not exist
    expect(res.status).toBe(404);
  });
});

describe('traversal + allow-list refusals (table-driven across dirs)', () => {
  const badNames = ['../secret.glb', '..%2Fsecret.glb', 'a/b.glb', 'a\\b.glb', '.env', 'chair.exe', '%2e%2e%2fpackage.json'];
  const dirQueries = ['', '?dir=tripo3d', '?dir=mesh-finish', '?dir=meshes'];

  for (const name of badNames) {
    for (const q of dirQueries) {
      it(`refuses name "${name}" with dir "${q || '(default)'}"`, async () => {
        const res = await serve(encodeURIComponent(name), q);
        expect([400, 404]).toContain(res.status);
      });
    }
  }

  const badDirs = ['..', '../..', 'icons/../..', 'C:/Windows', '/etc', 'anim', 'jinx-leo', 'packages'];
  for (const dir of badDirs) {
    it(`refuses dir "${dir}" even with a perfectly valid name`, async () => {
      const f = FIXTURES.find((x) => x.dir === DEFAULT_ASSET_DIR)!;
      const res = await serve(f.name, `?dir=${encodeURIComponent(dir)}`);
      expect(res.status).toBe(400); // not on the allow-list ⇒ not a dir at all
    });
  }

  it('a dir NOT on the allow-list is refused even though the file really exists there', async () => {
    // generated/anim holds real .glb files; it is deliberately not a mesh source.
    const res = await serve('anything.glb', '?dir=anim');
    expect(res.status).toBe(400);
  });
});
