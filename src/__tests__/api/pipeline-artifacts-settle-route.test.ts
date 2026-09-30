import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * GET|POST /api/pipeline-artifacts/settle — the catalog-scoped re-settle.
 *
 * GET previews bind-icons → verify-static → verify-packaging for ONE catalog and writes
 * NOTHING (no artifact row, no file under generated/packages/). POST re-previews, refuses
 * (409) unless `confirmDrops` equals the fresh drop count, then applies through the passes'
 * existing writers in that order. Every sweep here runs over a mocked artifact store — never
 * the operator's real database.
 */
type Row = { catalogId: string; entityId: string; step: string; status: string; tier?: string; reason?: string; data: Record<string, unknown>; ueAssets: string[] };

const m = vi.hoisted(() => ({
  db: new Map<string, unknown>(),
  order: [] as string[],
  listAllArtifacts: vi.fn(),
  getArtifact: vi.fn(),
  upsertArtifact: vi.fn(),
  getCatalogPipeline: vi.fn(),
  gradeArtifact: vi.fn(),
  staticVerdictFor: vi.fn(),
  contentVerdictFor: vi.fn(),
  staticUpsert: vi.fn(),
  ueRoot: vi.fn(),
  collectDeferred: vi.fn(),
  iconFiles: vi.fn(),
  diskFs: {
    exists: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(),
    packagesRoot: 'generated/packages', now: () => 't', ueRoot: () => null,
  },
}));

vi.mock('@/lib/pipeline-artifacts-db', () => ({
  listAllArtifacts: m.listAllArtifacts, getArtifact: m.getArtifact, upsertArtifact: m.upsertArtifact,
}));
vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));
vi.mock('@/lib/catalog/pipeline-registry', () => ({
  getCatalogPipeline: m.getCatalogPipeline, allCatalogPipelines: () => [],
}));
vi.mock('@/lib/catalog/headless', () => ({ gradeArtifact: m.gradeArtifact }));
vi.mock('@/lib/test-gate-runner', () => ({ collectDeferred: m.collectDeferred }));
vi.mock('@/lib/catalog/acceptance/staticVerify', async (orig) => ({
  ...(await orig<typeof import('@/lib/catalog/acceptance/staticVerify')>()),
  defaultStaticVerifyDeps: {
    resolveUeRoot: () => m.ueRoot(),
    listArtifacts: (f: { catalogId?: string }) => m.listAllArtifacts(f),
    getStaticChecks: (_c: string, _e: string, step: string) =>
      step === 'Stat Blocks'
        ? [(root: string | null) => (root
          ? { label: 'sym', tier: 'L2', status: 'pass', detail: 'present' }
          : { label: 'sym', tier: 'L2', status: 'deferred', detail: 'unchecked', reason: 'UE root not resolved' })]
        : null,
    upsertStatus: (c: string, e: string, s: string, res: unknown) => m.staticUpsert(c, e, s, res),
    isPackaging: (_c: string, s: string) => s === 'UE Packaging',
    getContentVerdict: () => null,
  },
  staticVerdictFor: m.staticVerdictFor,
  contentVerdictFor: m.contentVerdictFor,
}));
vi.mock('@/lib/catalog/packaging/packageArtifacts', async (orig) => ({
  ...(await orig<typeof import('@/lib/catalog/packaging/packageArtifacts')>()),
  defaultPackagingFsDeps: () => m.diskFs,
}));
vi.mock('node:fs', async (orig) => {
  const actual = await orig<typeof import('node:fs')>();
  const isIcons = (p: unknown) => String(p).replace(/\\/g, '/').includes('generated/icons');
  const readdirSync = (p: unknown, ...rest: unknown[]) =>
    isIcons(p) ? m.iconFiles() : (actual.readdirSync as (...a: unknown[]) => unknown)(p, ...rest);
  const statSync = (p: unknown, ...rest: unknown[]) =>
    isIcons(p) ? { isFile: () => true, mtimeMs: 1 } : (actual.statSync as (...a: unknown[]) => unknown)(p, ...rest);
  return { ...actual, default: { ...actual, readdirSync, statSync }, readdirSync, statSync };
});

import { GET, POST } from '@/app/api/pipeline-artifacts/settle/route';
import { GET as bindIconsGET } from '@/app/api/pipeline-artifacts/bind-icons/route';

const key = (c: string, e: string, s: string) => `${c}|${e}|${s}`;
const SWATCH = 'linear-gradient(red, blue)'; // a placeholder swatch — no real asset
const EMBEDDED = 'data:image/png;base64,iVBORw0KGgo='; // materialized by packaging → a disk write
const gallery = () => ({
  thumb: EMBEDDED,
  genHistory: { batches: [{ id: 'b0', at: 't', direction: '', prompt: '', candidates: [{ id: 'b0-c0', swatch: SWATCH }] }], selectedId: 'b0-c0' },
});
const seed = (): Row[] => [
  { catalogId: 'bestiary', entityId: 'e1', step: 'Concept 2D Art', status: 'deferred', data: gallery(), ueAssets: [] },
  { catalogId: 'bestiary', entityId: 'e1', step: 'UE Packaging', status: 'deferred', data: {}, ueAssets: [] },
  ...Array.from({ length: 8 }, (_, i): Row => ({ catalogId: 'bestiary', entityId: `e${i + 1}`, step: 'Stat Blocks', status: 'pass', data: {}, ueAssets: [] })),
  { catalogId: 'items', entityId: 'x1', step: 'Stat Blocks', status: 'pass', data: {}, ueAssets: [] },
  { catalogId: 'bestiary', entityId: 'e2', step: 'Python Import', status: 'deferred', data: { python: { module: 'm', function: 'f' } }, ueAssets: [] },
];
const rows = () => [...m.db.values()] as Row[];
const statuses = () => rows().map((r) => `${key(r.catalogId, r.entityId, r.step)}=${r.status}`).sort();

const get = (qs: string) => new NextRequest(`http://localhost:3000/api/pipeline-artifacts/settle${qs}`);
const post = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost:3000/api/pipeline-artifacts/settle', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  m.db.clear();
  m.order.length = 0;
  for (const r of seed()) m.db.set(key(r.catalogId, r.entityId, r.step), r);
  for (const f of [m.listAllArtifacts, m.getArtifact, m.upsertArtifact, m.getCatalogPipeline, m.gradeArtifact, m.staticVerdictFor,
    m.contentVerdictFor, m.staticUpsert, m.ueRoot, m.collectDeferred, m.iconFiles, ...Object.values(m.diskFs).filter((v) => typeof v === 'function' && 'mockReset' in v)]) {
    (f as ReturnType<typeof vi.fn>).mockReset();
  }
  m.listAllArtifacts.mockImplementation((f: { catalogId?: string; entityId?: string } = {}) => {
    if (f.entityId) m.order.push(`read:${f.entityId}`);
    return rows().filter((r) => (!f.catalogId || r.catalogId === f.catalogId) && (!f.entityId || r.entityId === f.entityId));
  });
  m.getArtifact.mockImplementation((c: string, e: string, s: string) => m.db.get(key(c, e, s)) ?? null);
  m.upsertArtifact.mockImplementation((a: Row) => {
    m.order.push(`write:${a.step}`);
    const prev = m.db.get(key(a.catalogId, a.entityId, a.step)) as Row | undefined;
    m.db.set(key(a.catalogId, a.entityId, a.step), { ...prev, ...a });
  });
  m.staticUpsert.mockImplementation((c: string, e: string, s: string, res: { status: string }) => {
    m.order.push('static:upsert');
    const prev = m.db.get(key(c, e, s)) as Row;
    m.db.set(key(c, e, s), { ...prev, status: res.status });
  });
  m.getCatalogPipeline.mockReturnValue({
    catalogId: 'bestiary',
    steps: [{ label: 'Concept 2D Art' }, { label: 'Stat Blocks' }, { label: 'Python Import' }, { label: 'UE Packaging', packaging: true }],
  });
  m.gradeArtifact.mockImplementation((_c: string, step: string, data: Record<string, unknown>) =>
    step === 'Concept 2D Art'
      ? { graded: true, raw: { label: step, tier: 'L0', status: data.iconBinding ? 'pass' : 'deferred', detail: '' }, result: null }
      : { graded: false, raw: null, result: null });
  m.staticVerdictFor.mockImplementation(() => { m.order.push('pkg:getStaticVerdict'); return null; });
  m.contentVerdictFor.mockReturnValue(null);
  m.ueRoot.mockReturnValue(null);
  m.collectDeferred.mockReturnValue([{}, {}, {}, {}, {}]);
  m.iconFiles.mockReturnValue(['bestiary_concept_2d_art.png']);
  m.diskFs.exists.mockImplementation((p: string) => p.startsWith('generated/icons/'));
  m.diskFs.readFile.mockReturnValue(Buffer.from('png-bytes'));
});

describe('GET /api/pipeline-artifacts/settle — the preview', () => {
  it('scopes every pass to the catalog, reports what the editor still owes, and writes NOTHING (acceptance 2 + revision)', async () => {
    const before = statuses();
    const res = await GET(get('?catalogId=bestiary'));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.plan.passes.map((p: { pass: string }) => p.pass)).toEqual(['bind-icons', 'verify-static', 'verify-packaging']);
    const allRows = data.plan.passes.flatMap((p: { rows: { catalogId: string }[] }) => p.rows);
    expect(allRows.length).toBeGreaterThan(0);
    for (const r of allRows) expect(r.catalogId).toBe('bestiary');
    expect(data.plan.passes[1]).toMatchObject({ drops: 8, cause: 'UE root not resolved' });

    expect(m.collectDeferred).toHaveBeenCalledWith(expect.objectContaining({ catalogId: 'bestiary' }));
    expect(data.remaining).toContainEqual(expect.objectContaining({ drain: 5, needs: 'running UE editor (bridge)' }));
    expect(data.remaining).toContainEqual(expect.objectContaining({ drainPython: 1, needs: 'editor open with PoF bridge' }));

    // Nothing written: no artifact row, no status writer, no file or dir on disk.
    expect(m.upsertArtifact).not.toHaveBeenCalled();
    expect(m.staticUpsert).not.toHaveBeenCalled();
    expect(m.diskFs.writeFile).not.toHaveBeenCalled();
    expect(m.diskFs.mkdir).not.toHaveBeenCalled();
    expect(statuses()).toEqual(before);
  });

  it('chains the preview: packaging sees the icon bind-icons would bind', async () => {
    await GET(get('?catalogId=bestiary'));
    expect(m.diskFs.exists).toHaveBeenCalledWith('generated/icons/bestiary_concept_2d_art.png');
  });

  it('refuses an unscoped preview', async () => {
    expect((await GET(get(''))).status).toBe(400);
  });
});

describe('POST /api/pipeline-artifacts/settle — confirmed apply', () => {
  it('409s unconfirmed drops and leaves every status unchanged (acceptance 3)', async () => {
    const before = statuses();
    const res = await POST(post({ catalogId: 'bestiary' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/\b8\b/);
    expect(statuses()).toEqual(before);
    expect(m.upsertArtifact).not.toHaveBeenCalled();
    expect(m.diskFs.writeFile).not.toHaveBeenCalled();
  });

  it('409s a stale confirmation naming both counts, nothing written (acceptance 5)', async () => {
    const before = statuses();
    const res = await POST(post({ catalogId: 'bestiary', confirmDrops: 3 }));
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error).toMatch(/\b3\b/);
    expect(error).toMatch(/\b8\b/);
    expect(statuses()).toEqual(before);
  });

  it('applies bind-icons → verify-static → verify-packaging through the existing writers (acceptance 4)', async () => {
    const res = await POST(post({ catalogId: 'bestiary', confirmDrops: 8 }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.ran).toEqual(['bind-icons', 'verify-static', 'verify-packaging']);
    // The preview inside the POST writes nothing, so the apply begins at the first write.
    const applyStart = m.order.indexOf('write:Concept 2D Art');
    expect(applyStart).toBeGreaterThanOrEqual(0);
    const applied = m.order.slice(applyStart);
    const at = (s: string) => applied.indexOf(s);
    expect(at('static:upsert')).toBeGreaterThan(0);
    expect(at('pkg:getStaticVerdict')).toBeGreaterThan(applied.lastIndexOf('static:upsert'));
    // The order that matters: packaging reads the siblings AFTER bind-icons rewrote them.
    expect(at('read:e1')).toBeGreaterThan(0);
    // The applied figures are reported, and the writes landed only in this catalog.
    expect(data.plan.totals.drops).toBe(8);
    expect((m.db.get(key('bestiary', 'e1', 'Stat Blocks')) as Row).status).toBe('deferred');
    expect((m.db.get(key('items', 'x1', 'Stat Blocks')) as Row).status).toBe('pass');
    expect((m.db.get(key('bestiary', 'e1', 'Concept 2D Art')) as Row).status).toBe('pass');
  });

  it('403s a cross-origin browser request before any sweep (acceptance 6)', async () => {
    const res = await POST(post({ catalogId: 'bestiary', confirmDrops: 8 }, { origin: 'http://evil.test', host: 'localhost:3000' }));
    expect(res.status).toBe(403);
    expect(m.upsertArtifact).not.toHaveBeenCalled();
    expect(m.staticUpsert).not.toHaveBeenCalled();
  });
});

describe('[guard] GET /api/pipeline-artifacts/bind-icons — unchanged by the deps extraction', () => {
  it('returns the same BindIconsSummary (acceptance 8)', async () => {
    const res = await bindIconsGET(new NextRequest('http://localhost:3000/api/pipeline-artifacts/bind-icons?catalogId=bestiary'));
    const { data } = await res.json();
    expect(data).toEqual({
      library: 1, examined: 1, bound: 1, changed: 1, skipped: 10,
      results: [{
        catalogId: 'bestiary', entityId: 'e1', step: 'Concept 2D Art', from: 'deferred', to: 'pass',
        detail: '/api/visual-gen/icon/bestiary_concept_2d_art.png', scope: 'step', changed: true,
      }],
    });
    expect(m.upsertArtifact).not.toHaveBeenCalled();
  });
});

describe('settle scoped to ONE entity (optional entityId)', () => {
  it('GET ?catalogId=&entityId= previews only that entity, and remaining is scoped the same way', async () => {
    const res = await GET(get('?catalogId=bestiary&entityId=e1'));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const allRows = data.plan.passes.flatMap((p: { rows: { entityId: string }[] }) => p.rows);
    expect(allRows.length).toBeGreaterThan(0);
    for (const r of allRows) expect(r.entityId).toBe('e1');
    expect(data.plan.passes[1]).toMatchObject({ drops: 1 });
    expect(m.collectDeferred).toHaveBeenCalledWith(expect.objectContaining({ catalogId: 'bestiary', entityId: 'e1' }));
    expect(data.remaining).toContainEqual(expect.objectContaining({ drainPython: 0 }));
    expect(m.upsertArtifact).not.toHaveBeenCalled();
  });

  it('POST { catalogId, entityId } applies to that entity only', async () => {
    const res = await POST(post({ catalogId: 'bestiary', entityId: 'e1', confirmDrops: 1 }));
    expect(res.status).toBe(200);
    expect((m.db.get(key('bestiary', 'e1', 'Stat Blocks')) as Row).status).toBe('deferred');
    expect((m.db.get(key('bestiary', 'e2', 'Stat Blocks')) as Row).status).toBe('pass');
  });
});
