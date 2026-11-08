/**
 * The four disk-truth sweep POSTs (bind-icons, verify-static, verify-packaging, drain-python)
 * scope their WRITE by `{ catalogId?, entityId? }`, where an absent scope means every catalog.
 * A malformed body must therefore be refused, never read as `{}` — parity with the drain
 * route's fix (f62f5e06). An empty body stays the explicit global sweep.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { bindIconsAll, verifyStaticAll, verifyPackagingAll, drainPythonAll } = vi.hoisted(() => ({
  bindIconsAll: vi.fn<(filter: unknown) => { results: never[] }>(() => ({ results: [] })),
  verifyStaticAll: vi.fn<(filter: unknown) => { results: never[] }>(() => ({ results: [] })),
  verifyPackagingAll: vi.fn<(filter: unknown) => { results: never[] }>(() => ({ results: [] })),
  drainPythonAll: vi.fn<(filter: unknown) => Promise<{ results: never[] }>>(async () => ({ results: [] })),
}));

vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));
vi.mock('@/lib/catalog/acceptance/bindIconsAll', () => ({ bindIconsAll }));
vi.mock('@/lib/catalog/acceptance/bindIconsDeps', () => ({
  listIconLibrary: () => [],
  makeBindIconsDeps: () => ({ flushLifecycle: () => {} }),
}));
vi.mock('@/lib/catalog/acceptance/staticVerify', () => ({ verifyStaticAll, defaultStaticVerifyDeps: {} }));
vi.mock('@/lib/catalog/acceptance/packagingVerify', () => ({ verifyPackagingAll, defaultPackagingVerifyDeps: () => ({}) }));
vi.mock('@/lib/catalog/acceptance/pythonDrain', () => ({ drainPythonAll, readDispatch: () => null, hasResult: () => false }));
vi.mock('@/lib/pipeline-artifacts-db', () => ({ listAllArtifacts: () => [] }));
vi.mock('@/lib/catalog/headless', () => ({ gradeArtifact: () => ({ graded: false, raw: null }) }));
vi.mock('@/lib/catalog/pipeline-registry', () => ({ getCatalogPipeline: () => undefined }));
vi.mock('@/lib/bridge/run-python', () => ({ runPython: vi.fn() }));
vi.mock('@/lib/catalog/acceptance/regrade', () => ({
  persistRegrade: vi.fn(),
  realArtifactIO: { syncLifecycle: vi.fn() },
  createTouched: () => ({ add: vi.fn(), flush: vi.fn() }),
  // Faithful copy of the real (pure) parser so the scope assertions mean something.
  parseSweepFilter: (input: Record<string, unknown> | URLSearchParams | null | undefined) => {
    const read = (k: string): unknown => (input instanceof URLSearchParams ? input.get(k) : input?.[k]);
    const catalogId = read('catalogId');
    const entityId = read('entityId');
    return {
      ...(typeof catalogId === 'string' && catalogId ? { catalogId } : {}),
      ...(typeof entityId === 'string' && entityId ? { entityId } : {}),
    };
  },
}));

import { POST as bindIconsPOST } from '@/app/api/pipeline-artifacts/bind-icons/route';
import { POST as verifyStaticPOST } from '@/app/api/pipeline-artifacts/verify-static/route';
import { POST as verifyPackagingPOST } from '@/app/api/pipeline-artifacts/verify-packaging/route';
import { POST as drainPythonPOST } from '@/app/api/pipeline-artifacts/drain-python/route';

const ROUTES = [
  { name: 'bind-icons', post: bindIconsPOST, sweep: bindIconsAll },
  { name: 'verify-static', post: verifyStaticPOST, sweep: verifyStaticAll },
  { name: 'verify-packaging', post: verifyPackagingPOST, sweep: verifyPackagingAll },
  { name: 'drain-python', post: drainPythonPOST, sweep: drainPythonAll },
] as const;

const req = (name: string, body: string) =>
  new NextRequest(`http://localhost/api/pipeline-artifacts/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });

beforeEach(() => {
  for (const r of ROUTES) r.sweep.mockClear();
});

describe.each(ROUTES)('POST /api/pipeline-artifacts/$name — body scope', ({ name, post, sweep }) => {
  it('refuses a truncated body with 400 instead of sweeping every catalog', async () => {
    const res = await post(req(name, '{"catalogId":"items","entityId":"swo'));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
    expect(sweep).not.toHaveBeenCalled();
  });

  it('refuses a non-object JSON body (array, null) with 400', async () => {
    for (const body of ['["items"]', 'null']) {
      const res = await post(req(name, body));
      expect(res.status).toBe(400);
    }
    expect(sweep).not.toHaveBeenCalled();
  });

  it('keeps the empty body as the explicit global sweep, and scopes a valid body', async () => {
    expect((await post(req(name, ''))).status).toBe(200);
    expect(sweep.mock.calls[0][0]).toEqual({});
    expect((await post(req(name, '{"catalogId":"items","entityId":"sword"}'))).status).toBe(200);
    expect(sweep.mock.calls[1][0]).toEqual({ catalogId: 'items', entityId: 'sword' });
  });
});
