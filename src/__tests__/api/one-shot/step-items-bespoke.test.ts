/**
 * The one-shot step route is the only live/headless produce seam, and it 404'd on the 7
 * bespoke-owned Items labels (`step 'Animations' not found in catalog 'items'`) — so the TEMPLATE
 * reason's own instruction ("produce this step live for <entity>") could not be followed there.
 * The route now resolves an items label through `itemsStepSpec` (registered first, then the
 * bespoke adapter). Deterministic mode only: a real CLI is never spawned in a test.
 * Real registry, throwaway DB.
 */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-oneshot-items-bespoke-${process.pid}.db`;
});

import { POST } from '@/app/api/one-shot/step/route';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';

const post = (body: unknown) => new NextRequest('http://localhost/api/one-shot/step', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/one-shot/step — bespoke Items labels', () => {
  it('produces Animations for item-2 (200) and persists the row', async () => {
    const res = await POST(post({ catalogId: 'items', entityId: 'item-2', stepLabel: 'Animations', mode: 'deterministic' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.stepName).toBe('Animations');
    const row = listArtifacts('items', 'item-2').find((a) => a.step === 'Animations');
    expect(row).toBeTruthy();
  });

  it('the data-blind stub for non-exemplar item-2 persists pending, TEMPLATE naming item-1', async () => {
    const res = await POST(post({ catalogId: 'items', entityId: 'item-2', stepLabel: 'Animations', mode: 'deterministic' }));
    const body = await res.json();
    expect(body.data.status).toBe('pending');
    expect(String(body.data.reason)).toMatch(/^TEMPLATE: item-1 template/);
    const row = listArtifacts('items', 'item-2').find((a) => a.step === 'Animations');
    expect(row?.status).toBe('pending');
    expect(String(row?.reason)).toMatch(/^TEMPLATE:/);
    expect((row?.data as { template?: unknown }).template).toEqual({ exemplar: 'item-1', entity: 'item-2' });
  });

  it('the exemplar item-1 grades its own stub pass (walker path unchanged)', async () => {
    const res = await POST(post({ catalogId: 'items', entityId: 'item-1', stepLabel: 'SFX', mode: 'deterministic' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe('pass');
    expect((body.data.artifactData as { template?: unknown }).template).toBeUndefined();
  });

  it('[guard] a label neither items spec declares still 404s', async () => {
    const res = await POST(post({ catalogId: 'items', entityId: 'item-2', stepLabel: 'Not A Real Step', mode: 'deterministic' }));
    expect(res.status).toBe(404);
  });
});
