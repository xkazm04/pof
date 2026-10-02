/**
 * One icon-library door: provenance bound to the bytes, one lister for both reads.
 *
 * `generated/icons/` has several writers (the contact-sheet cut, icon-from-mesh, and three
 * out-of-process scripts) and used to have two listers that disagreed. These cases drive
 * the door (`icon-library.ts`), the `/api/visual-gen/icons` route and the bind lister
 * (`bindIconsDeps.listIconLibrary`) over a TEMP directory only — `process.cwd()` is pointed
 * at a fresh temp root, so the real `generated/` folder is never read or written.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import type { GeneratedIcon } from '@/lib/visual-gen/generated-icons';

// The bind lister's module also wires the artifact db + grader; neither is touched here.
vi.mock('@/lib/pipeline-artifacts-db', () => ({ listAllArtifacts: vi.fn(), getArtifact: vi.fn(), upsertArtifact: vi.fn() }));
vi.mock('@/lib/catalog/headless', () => ({ gradeArtifact: vi.fn() }));

const lib = () => import('@/lib/visual-gen/icon-library');
const route = () => import('@/app/api/visual-gen/icons/route');
const cache = () => import('@/lib/visual-gen/generated-assets');

let root = '';
let dir = '';

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'pof-iconlib-'));
  dir = join(root, 'generated', 'icons').split(/[\\/]/).join('/');
  mkdirSync(dir, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  (await cache()).invalidateListingCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

const bytes = (s: string) => async (p: string) => { writeFileSync(p, Buffer.from(s)); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function listed(query = ''): Promise<GeneratedIcon[]> {
  const { GET } = await route();
  const res = await GET(new NextRequest(`http://localhost/api/visual-gen/icons${query}`));
  const body = (await res.json()) as { success: boolean; data: { icons: GeneratedIcon[] } };
  expect(body.success).toBe(true);
  return body.data.icons;
}

const byName = (icons: GeneratedIcon[], name: string) => icons.find((i) => i.name === name);
const SWORD = 'items__sword__icon_2d_art.png';
const MESH = { kind: 'mesh-render', renderedFrom: '/m/sword.glb', yawDeg: 45 } as const;

describe('commitLibraryIcon -> readIconLibrary', () => {
  it('a committed icon reads back with the origin it was committed with', async () => {
    const { commitLibraryIcon, readIconLibrary } = await lib();
    await commitLibraryIcon(dir, SWORD, bytes('render-bytes'), MESH);
    const hit = byName(readIconLibrary(dir) ?? [], SWORD);
    expect(hit?.origin).toMatchObject({ kind: 'mesh-render', renderedFrom: '/m/sword.glb' });
    expect(hit?.renderedFrom).toBe('/m/sword.glb');
  });

  it('bytes rewritten out of band (no sidecar write) read as unrecorded — in the lib AND the route', async () => {
    const { commitLibraryIcon, readIconLibrary } = await lib();
    await commitLibraryIcon(dir, SWORD, bytes('render-bytes'), MESH);
    await wait(20);
    writeFileSync(join(dir, SWORD), Buffer.from('a leonardo generation of a different length')); // power-icon.mjs
    const fromLib = byName(readIconLibrary(dir) ?? [], SWORD);
    expect(fromLib?.origin).toEqual({ kind: 'unrecorded' });
    expect(fromLib && 'renderedFrom' in fromLib).toBe(false);
    const fromRoute = byName(await listed(), SWORD);
    expect(fromRoute?.origin).toEqual({ kind: 'unrecorded' });
    expect(fromRoute && 'renderedFrom' in fromRoute).toBe(false);
  });

  it('a png provenance never stamps the jpg of the same base', async () => {
    const { commitLibraryIcon, readIconLibrary } = await lib();
    await commitLibraryIcon(dir, 'x.png', bytes('render'), MESH);
    writeFileSync(join(dir, 'x.jpg'), Buffer.from('raw leonardo jpg'));
    let jpg = byName(readIconLibrary(dir) ?? [], 'x.jpg');
    expect(jpg?.origin).toEqual({ kind: 'unrecorded' });
    expect(jpg && 'renderedFrom' in jpg).toBe(false);
    // Even with a legacy extension-stripped `x.render.json` beside them, the jpg claims nothing.
    writeFileSync(join(dir, 'x.render.json'), JSON.stringify({ renderedFrom: '/m/x.glb', yawDeg: 45, at: Date.now() + 60_000 }));
    jpg = byName(readIconLibrary(dir) ?? [], 'x.jpg');
    expect(jpg?.origin).toEqual({ kind: 'unrecorded' });
    expect(jpg && 'renderedFrom' in jpg).toBe(false);
  });

  it('a legacy render sidecar counts only while it post-dates the bytes', async () => {
    const { readIconLibrary } = await lib();
    writeFileSync(join(dir, 'x.png'), Buffer.from('legacy render'));
    const mtimeMs = statSync(join(dir, 'x.png')).mtimeMs;
    // [guard] written after the render: kept.
    writeFileSync(join(dir, 'x.render.json'), JSON.stringify({ renderedFrom: '/m/x.glb', yawDeg: 45, at: Math.ceil(mtimeMs) }));
    let x = byName(readIconLibrary(dir) ?? [], 'x.png');
    expect(x?.renderedFrom).toBe('/m/x.glb');
    expect(x?.origin).toMatchObject({ kind: 'mesh-render', renderedFrom: '/m/x.glb', yawDeg: 45 });
    // bytes rewritten after the render: the claim no longer describes them.
    writeFileSync(join(dir, 'x.render.json'), JSON.stringify({ renderedFrom: '/m/x.glb', yawDeg: 45, at: Math.floor(mtimeMs) - 10_000 }));
    x = byName(readIconLibrary(dir) ?? [], 'x.png');
    expect(x?.origin).toEqual({ kind: 'unrecorded' });
    expect(x && 'renderedFrom' in x).toBe(false);
  });
});

describe('one lister for both reads', () => {
  it('bindIconsDeps.listIconLibrary and GET /api/visual-gen/icons return identical entries', async () => {
    const { commitLibraryIcon } = await lib();
    await commitLibraryIcon(dir, SWORD, bytes('render'), MESH);
    await commitLibraryIcon(dir, 'items__axe__icon_2d_art.png', bytes('cell'), {
      kind: 'contact-sheet', sheetUrl: '/api/visual-gen/image/s.png', cellIndex: 1, model: 'qwen-image',
    });
    writeFileSync(join(dir, 'items_icon_2d_art.jpg'), Buffer.from('raw step art'));
    writeFileSync(join(dir, 'legacy.png'), Buffer.from('legacy'));
    writeFileSync(join(dir, 'legacy.render.json'), JSON.stringify({ renderedFrom: '/m/l.glb', yawDeg: 45, at: Date.now() + 60_000 }));
    const { listIconLibrary } = await import('@/lib/catalog/acceptance/bindIconsDeps');
    const pick = (icons: GeneratedIcon[]) =>
      icons.map(({ name, slug, scope, entityId, origin, renderedFrom }) => ({ name, slug, scope, entityId, origin, renderedFrom }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const bind = pick(listIconLibrary());
    expect(bind).toEqual(pick(await listed()));
    expect(bind.find((i) => i.name === SWORD)?.renderedFrom).toBe('/m/sword.glb');
    expect(bind.find((i) => i.name === 'legacy.png')?.renderedFrom).toBe('/m/l.glb');
  });

  it('an in-place door commit within the listing TTL is visible on the very next GET', async () => {
    const { commitLibraryIcon } = await lib();
    await commitLibraryIcon(dir, SWORD, bytes('cell'), { kind: 'contact-sheet', sheetUrl: '/s.png', cellIndex: 0 });
    expect(byName(await listed(), SWORD)?.origin?.kind).toBe('contact-sheet'); // warm
    const stamp = statSync(dir).mtimeMs;
    await commitLibraryIcon(dir, SWORD, bytes('a mesh render of other length'), MESH);
    expect(statSync(dir).mtimeMs).toBe(stamp); // in place: the dir stamp cannot tell the cache
    const after = byName(await listed(), SWORD);
    expect(after?.origin).toMatchObject({ kind: 'mesh-render', renderedFrom: '/m/sword.glb' });
  });
});

describe('[guard] what the listing never shows, and the precedence it keeps', () => {
  it('no subdirectory and no provenance sidecar ever appears as an icon', async () => {
    mkdirSync(join(dir, '_unaddressable'));
    writeFileSync(join(dir, '_unaddressable', 'orphan.jpg'), Buffer.from('o'));
    writeFileSync(join(dir, 'a.png'), Buffer.from('a'));
    writeFileSync(join(dir, 'a.png.prov.json'), '{}');
    writeFileSync(join(dir, 'a.render.json'), '{}');
    expect(readdirSync(dir).length).toBe(4);
    expect((await listed()).map((i) => i.name)).toEqual(['a.png']);
  });

  it('entity art wins, step art is the fallback, and each entry declares its scope', async () => {
    writeFileSync(join(dir, 'items_icon_2d_art.jpg'), Buffer.from('step'));
    writeFileSync(join(dir, 'items__sword__icon_2d_art.png'), Buffer.from('entity'));
    const q = '?catalogId=items&step=Icon%202D%20Art';
    expect((await listed(`${q}&entityId=sword`)).map((i) => [i.name, i.scope])).toEqual([[SWORD, 'entity']]);
    expect((await listed(`${q}&entityId=axe`)).map((i) => [i.name, i.scope])).toEqual([['items_icon_2d_art.jpg', 'step']]);
    expect((await listed(q)).map((i) => i.scope)).toEqual(['step']);
  });
});
