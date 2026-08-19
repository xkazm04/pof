/**
 * `POST /api/one-shot/step` — the write path live-CLI produce takes — was the ONLY
 * artifact writer that graded without a `CheckerContext`. It called `step.accept(data)`
 * bare: no context, no `safeAccept`, and a hardcoded `pass` fallback.
 *
 * That matters most for `linksResolve()`, which explicitly self-reports that it cannot
 * resolve without a context and returns `pass` — 63 step specs compose it, and 118 of the
 * 817 persisted rows carry `data.links`. So a live-produced step's cross-catalog links got
 * a verdict the checker itself disclaims, where the same payload through
 * `/api/pipeline-artifacts` came back `deferred` naming the unresolved targets.
 *
 * HONEST SCOPE: this path is opt-in and has never been exercised against the real DB
 * (0 `draft-%` rows, 0 rows carrying `produceDirection` when measured 2026-08-19). This is
 * a trap disarmed before first real use, not a bug anyone is currently hitting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-oneshot-parity-${process.pid}.db`;
});

import { NextRequest } from 'next/server';
import { linksResolve } from '@/lib/catalog/acceptance/linkCheckers';

const UNRESOLVABLE = { catalogId: 'items', entityId: 'no-such-entity-anywhere', role: 'ref' };

// A registry with exactly the two shapes this direction is about: a step that composes
// `linksResolve` (context-dependent), and a step whose checker THROWS.
vi.mock('@/lib/catalog/pipeline-registry', () => ({
  registerCatalogPipeline: vi.fn(),
  getCatalogPipeline: vi.fn().mockImplementation((catalogId: string) => (catalogId !== 'items' ? undefined : {
    catalogId: 'items',
    steps: [
      {
        archetype: 'brief', label: 'Linked Step',
        view: { kind: 'prose', field: 'brief', emptyText: '' },
        produce: () => ({ data: { brief: 'x', links: [UNRESOLVABLE] }, ueAssets: [] }),
        accept: linksResolve(),
      },
      {
        archetype: 'brief', label: 'Throwing Step',
        view: { kind: 'prose', field: 'brief', emptyText: '' },
        produce: () => ({ data: { brief: 'y' }, ueAssets: [] }),
        accept: () => { throw new Error('checker exploded on untrusted data'); },
      },
    ],
  })),
}));

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn().mockReturnValue([
    { id: 'e1', catalogId: 'items', name: 'Iron Sword', categoryPath: [], tags: [], lifecycle: 'planned', data: {} },
  ]),
}));

import { POST } from '@/app/api/one-shot/step/route';
import { POST as artifactsPOST } from '@/app/api/pipeline-artifacts/route';
import { listArtifacts, deleteArtifact } from '@/lib/pipeline-artifacts-db';

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/one-shot/step', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function runStep(stepLabel: string, entityId = 'e1') {
  const res = await POST(makePost({ catalogId: 'items', entityId, stepLabel, mode: 'deterministic' }));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  for (const a of listArtifacts('items')) deleteArtifact('items', a.entityId, a.step);
});

describe('one-shot step grading parity', () => {
  it('grades cross-catalog links WITH a CheckerContext (deferred), not the disclaimed pass', async () => {
    const { status, body } = await runStep('Linked Step');
    expect(status).toBe(200);
    expect(body.data.status).toBe('deferred');
    expect(body.data.tier).toBe('L2');
    // the reason NAMES the unresolved target instead of "resolution needs catalog context"
    expect(body.data.reason).toContain('no-such-entity-anywhere');
    expect(body.data.reason).not.toMatch(/needs catalog context/);

    const row = listArtifacts('items', 'e1').find((a) => a.step === 'Linked Step');
    expect(row?.status).toBe('deferred');
    expect(row?.tier).toBe('L2');
  });

  it('persists the SAME status/tier/reason the /api/pipeline-artifacts path would', async () => {
    const { body } = await runStep('Linked Step');
    const oneShotRow = listArtifacts('items', 'e1').find((a) => a.step === 'Linked Step')!;

    const res = await artifactsPOST(new NextRequest('http://localhost/api/pipeline-artifacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        catalogId: 'items', entityId: 'e2', step: 'Linked Step',
        data: body.data.artifactData, ueAssets: [], status: 'pass',
      }),
    }));
    expect(res.status).toBe(200);
    const other = (await res.json()).data;

    expect(oneShotRow.status).toBe(other.status);
    expect(oneShotRow.tier).toBe(other.tier);
    expect(oneShotRow.reason).toBe(other.reason);
  });

  it('a THROWING checker degrades to a persisted `pending` with the thrown reason — not a 500 with no row', async () => {
    const { status, body } = await runStep('Throwing Step');
    expect(status).toBe(200);
    expect(body.data.status).toBe('pending');
    expect(body.data.reason).toContain('checker exploded');

    const row = listArtifacts('items', 'e1').find((a) => a.step === 'Throwing Step');
    expect(row).toBeTruthy();
    expect(row?.status).toBe('pending');
    expect(row?.reason).toContain('checker exploded');
  });

  it('reports a legal deferral as `deferred` to the run log, never as `fail`', async () => {
    const { body } = await runStep('Linked Step');
    expect(body.data.outcome).toBe('deferred');
    expect(body.data.outcome).not.toBe('fail');
  });

  it('stamps `_provenance.promptVersion` so a live-produced artifact joins prompt-fitness', async () => {
    await runStep('Linked Step');
    const row = listArtifacts('items', 'e1').find((a) => a.step === 'Linked Step')!;
    const prov = (row.data as { _provenance?: { promptVersion?: string } })._provenance;
    expect(prov?.promptVersion).toBeTruthy();
  });
});
