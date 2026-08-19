/**
 * Generated media is CACHEABLE — and a rewrite is never masked.
 *
 * Forced-failure suite for `generated-images-cacheable`. Both serve routes answered
 * `Cache-Control: no-store`, so a 4-slot gallery re-downloaded every image on every mount
 * and every re-roll (and a `.glb` viewer re-downloaded megabytes), while both list routes
 * paid a `readdir` + one `stat` PER FILE on every mount. These tests drive the real route
 * handlers over real files written into the real `generated/` tree (uniquely named,
 * removed afterwards — nothing pre-existing is touched).
 *
 * The policy under test is deliberately NOT `immutable`: generated filenames are reused
 * in place (`scripts/gap-loop/power-icon.mjs` names every icon `iconSlug(catalog, step)`),
 * so the tests below pin that an overwrite and a new filename both defeat the cache.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET as serveIcon } from '@/app/api/visual-gen/icon/[name]/route';
import { GET as listIcons } from '@/app/api/visual-gen/icons/route';
import { GET as serveAsset } from '@/app/api/visual-gen/asset/[name]/route';
import { GET as listAssets } from '@/app/api/visual-gen/assets/route';
import { readListingCache, invalidateListingCache, DEFAULT_ASSET_DIR } from '@/lib/visual-gen/generated-assets';
import type { GeneratedIcon } from '@/lib/visual-gen/generated-icons';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';

const STAMP = `pof_lotcb_${process.pid}`;
const ICON_DIR = join(process.cwd(), 'generated', 'icons');
const MESH_DIR = join(process.cwd(), 'generated', DEFAULT_ASSET_DIR);

/** The step's art. Its name is deterministic in production, so it is a MUTABLE path. */
const ICON_A = `${STAMP}_a.jpg`;
/** What a re-roll that writes a NEW filename produces. */
const ICON_B = `${STAMP}_b.jpg`;
const MESH = `${STAMP}.glb`;
/** A real subdirectory inside generated/icons/ — the `_unaddressable/` shape. */
const SUBDIR = `_${STAMP}_subdir`;

const BYTES_1 = Buffer.from('first-generation-image-bytes');
const BYTES_2 = Buffer.from('re-generated-image-bytes-which-are-a-different-length');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(() => {
  mkdirSync(ICON_DIR, { recursive: true });
  mkdirSync(MESH_DIR, { recursive: true });
  mkdirSync(join(ICON_DIR, SUBDIR), { recursive: true });
  writeFileSync(join(ICON_DIR, ICON_A), BYTES_1);
  writeFileSync(join(ICON_DIR, ICON_B), BYTES_2); // a re-roll's output: different art
  writeFileSync(join(ICON_DIR, SUBDIR, 'nested.jpg'), BYTES_1);
  writeFileSync(join(MESH_DIR, MESH), BYTES_1);
  invalidateListingCache();
});

afterAll(() => {
  for (const p of [join(ICON_DIR, ICON_A), join(ICON_DIR, ICON_B), join(MESH_DIR, MESH)]) {
    try { rmSync(p); } catch { /* already gone */ }
  }
  try { rmSync(join(ICON_DIR, SUBDIR), { recursive: true }); } catch { /* already gone */ }
  invalidateListingCache();
});

function icon(name: string, ifNoneMatch?: string) {
  const init = ifNoneMatch ? { headers: { 'if-none-match': ifNoneMatch } } : undefined;
  return serveIcon(new NextRequest(`http://localhost/api/visual-gen/icon/${name}`, init), {
    params: Promise.resolve({ name }),
  });
}

function mesh(name: string, ifNoneMatch?: string) {
  const init = ifNoneMatch ? { headers: { 'if-none-match': ifNoneMatch } } : undefined;
  return serveAsset(new NextRequest(`http://localhost/api/visual-gen/asset/${name}`, init), {
    params: Promise.resolve({ name }),
  });
}

async function icons(query = ''): Promise<GeneratedIcon[]> {
  const res = await listIcons(new NextRequest(`http://localhost/api/visual-gen/icons${query}`));
  const body = (await res.json()) as { success: boolean; data: { icons: GeneratedIcon[] } };
  expect(body.success).toBe(true);
  return body.data.icons;
}

/** Body bytes actually transferred — the number `no-store` forced to the full file size every time. */
async function bodyBytes(res: Response): Promise<number> {
  return (await res.arrayBuffer()).byteLength;
}

describe('GET /api/visual-gen/icon/:name — cacheable via revalidation', () => {
  it('serves store-and-revalidate headers instead of no-store', async () => {
    const res = await icon(ICON_A);
    expect(res.status).toBe(200);
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toContain('no-cache');
    expect(cc).not.toContain('no-store');
    expect(cc).not.toContain('immutable');
    expect(res.headers.get('etag')).toBeTruthy();
    expect(res.headers.get('last-modified')).toBeTruthy();
    expect(await bodyBytes(res)).toBe(BYTES_1.length);
  });

  it('a second mount revalidates to 304 with ZERO body bytes', async () => {
    const first = await icon(ICON_A);
    const etag = first.headers.get('etag')!;
    expect(await bodyBytes(first)).toBe(BYTES_1.length);

    const second = await icon(ICON_A, etag);
    expect(second.status).toBe(304);
    expect(await bodyBytes(second)).toBe(0);
    expect(second.headers.get('etag')).toBe(etag);
  });

  it('a re-roll that writes a NEW filename is NOT masked — new URL, no validator, full bytes', async () => {
    const a = await icon(ICON_A);
    const etagA = a.headers.get('etag')!;
    expect(Buffer.from(await a.arrayBuffer()).toString()).toBe(BYTES_1.toString());

    // A new filename is a new URL, so the client holds no stored response for it and
    // sends no validator at all — the full new art is transferred, and the previously
    // cached A is untouched and still correct at its own URL.
    const b = await icon(ICON_B);
    expect(b.status).toBe(200);
    expect(b.headers.get('etag')).not.toBe(etagA);
    expect(Buffer.from(await b.arrayBuffer()).toString()).toBe(BYTES_2.toString());

    const aAgain = await icon(ICON_A, etagA);
    expect(aAgain.status).toBe(304); // A is still A; the re-roll did not invalidate it
  });

  it('an in-place overwrite of the SAME filename is NOT masked — the etag moves, bytes are re-sent', async () => {
    const before = await icon(ICON_A);
    const staleEtag = before.headers.get('etag')!;

    await wait(25); // distinct mtime, so the assertion is about the policy, not clock granularity
    writeFileSync(join(ICON_DIR, ICON_A), BYTES_2); // exactly what re-generating a step's art does

    const after = await icon(ICON_A, staleEtag);
    expect(after.status).toBe(200); // NOT 304 — this is why the policy is not `immutable`
    expect(after.headers.get('etag')).not.toBe(staleEtag);
    expect(Buffer.from(await after.arrayBuffer()).toString()).toBe(BYTES_2.toString());

    writeFileSync(join(ICON_DIR, ICON_A), BYTES_1); // restore for the other cases
  });

  it('still refuses everything it always refused (no cache path around the allow-list)', async () => {
    for (const bad of ['../secret.jpg', 'a/b.jpg', '.env', 'chair.exe']) {
      const res = await icon(encodeURIComponent(bad), '*');
      expect([400, 404]).toContain(res.status);
    }
  });
});

describe('GET /api/visual-gen/asset/:name — the same revalidation contract for meshes', () => {
  it('serves an etag + no-cache, and 304s a repeat viewer mount with zero body bytes', async () => {
    const first = await mesh(MESH);
    expect(first.status).toBe(200);
    const cc = first.headers.get('cache-control') ?? '';
    expect(cc).toContain('no-cache');
    expect(cc).not.toContain('no-store');
    expect(cc).not.toContain('immutable');
    const etag = first.headers.get('etag')!;
    expect(await bodyBytes(first)).toBe(BYTES_1.length);

    const second = await mesh(MESH, etag);
    expect(second.status).toBe(304);
    expect(await bodyBytes(second)).toBe(0);
  });

  it('a mesh rewritten under the same name is re-sent in full', async () => {
    const stale = (await mesh(MESH)).headers.get('etag')!;
    await wait(25);
    writeFileSync(join(MESH_DIR, MESH), BYTES_2);
    const res = await mesh(MESH, stale);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(BYTES_2.toString());
  });
});

describe('GET /api/visual-gen/icons — the manifest is cached, and stays honest', () => {
  it('populates the in-process listing cache on the first mount', async () => {
    invalidateListingCache();
    await icons();
    const stamp = statSync(ICON_DIR).mtimeMs;
    expect(readListingCache<GeneratedIcon[]>('icons', stamp)).toBeDefined();
  });

  it('a second mount returns exactly the same manifest', async () => {
    const a = await icons();
    const b = await icons();
    expect(b).toEqual(a);
    expect(b.some((i) => i.name === ICON_A)).toBe(true);
  });

  it('a file written OUT OF PROCESS is visible on the very next request, not after the TTL', async () => {
    await icons(); // warm
    const fresh = `${STAMP}_outofprocess.jpg`;
    await wait(25); // distinct directory mtime
    writeFileSync(join(ICON_DIR, fresh), BYTES_1); // stands in for scripts/gap-loop/*.mjs
    try {
      expect((await icons()).some((i) => i.name === fresh)).toBe(true);
    } finally {
      rmSync(join(ICON_DIR, fresh));
    }
  });

  it('NEVER lists a subdirectory of generated/icons/ (the `_unaddressable/` holding pen), warm or cold', async () => {
    invalidateListingCache();
    const cold = await icons();
    const warm = await icons();
    for (const list of [cold, warm]) {
      expect(list.some((i) => i.name === SUBDIR)).toBe(false);
      expect(list.some((i) => i.name.startsWith('_'))).toBe(false);
      expect(list.some((i) => i.name.includes('unaddressable'))).toBe(false);
      expect(list.some((i) => i.name.includes('/') || i.name.includes('\\'))).toBe(false);
    }
  });

  it('the per-step filter is applied AFTER the cache, so a warm listing never leaks another step', async () => {
    await icons(); // warm the full listing
    const filtered = await icons('?slug=a_slug_no_generated_file_uses');
    expect(filtered).toEqual([]);
    expect((await icons()).some((i) => i.name === ICON_A)).toBe(true);
  });
});

describe('GET /api/visual-gen/assets — cached per dir, contract intact', () => {
  it('caches each whitelisted dir under its own key', async () => {
    invalidateListingCache();
    const res = await listAssets();
    const body = (await res.json()) as { success: boolean; data: { assets: GeneratedAsset[] } };
    expect(body.success).toBe(true);
    expect(body.data.assets.some((a) => a.name === MESH)).toBe(true);
    const stamp = statSync(MESH_DIR).mtimeMs;
    expect(readListingCache(`assets:${DEFAULT_ASSET_DIR}`, stamp)).toBeDefined();
    // A different provider dir is a different key — one dir warming cannot answer for it.
    expect(readListingCache(`assets:tripo3d`, stamp + 1)).toBeUndefined();
  });

  it('a warm listing is identical to the cold one', async () => {
    invalidateListingCache();
    const cold = (await (await listAssets()).json()) as { data: { assets: GeneratedAsset[] } };
    const warm = (await (await listAssets()).json()) as { data: { assets: GeneratedAsset[] } };
    expect(warm.data.assets).toEqual(cold.data.assets);
  });
});
