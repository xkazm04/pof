/**
 * POST /api/catalog {action:'transition'} — the generation @@CALLBACK target.
 *
 * Acceptance for scan-sweep --challenge card catalog-core-infrastructure/A
 * (run challenge-2026-09-29d): the callback RECORDS evidence (ueAssets) and the
 * lifecycle is the derivation's — one writer. No hand ladder (no 409 for a
 * recipe that skips a rung), and a session-REPORTED test result never reaches
 * 'verified' (only a drained L3/L4 gate does, lifecycle.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-catalog-transition-${process.pid}.db`;
});

const { recordTrial } = vi.hoisted(() => ({ recordTrial: vi.fn() }));
vi.mock('@/lib/prompt-evolution/engine', async (orig) => ({
  ...(await orig<typeof import('@/lib/prompt-evolution/engine')>()),
  recordTrialForVariantId: recordTrial,
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/catalog/route';
import { seededEntities } from '@/lib/catalog/seed';
import { deriveCatalogLifecycle, syncEntityLifecycle } from '@/lib/catalog/headless';
import { getLifecycle, upsertLifecycle } from '@/lib/catalog-db';

function post(body: Record<string, unknown>) {
  return POST(new NextRequest('http://localhost/api/catalog', {
    method: 'POST', body: JSON.stringify({ action: 'transition', ...body }),
    headers: { 'content-type': 'application/json' },
  }));
}

const firstSeed = (catalogId: string) => seededEntities(catalogId)[0].id;

describe('POST /api/catalog transition - one lifecycle writer', () => {
  beforeEach(() => { recordTrial.mockReset(); });

  it('case 4: a recipe whose first step skips a rung is recorded, not 409d; the row is the derivation', async () => {
    const entityId = firstSeed('loot-tables');
    expect(getLifecycle('loot-tables', entityId)).toBeNull();
    const res = await post({
      catalogId: 'loot-tables', entityId, nextLifecycle: 'generated', ueAssets: ['/Game/Loot/LT_Probe'],
    });
    expect(res.status).toBe(200);
    const row = getLifecycle('loot-tables', entityId)!;
    expect(row.lifecycle).toBe(deriveCatalogLifecycle('loot-tables', entityId)[0].lifecycle);
    expect(row.ueAssets).toContain('/Game/Loot/LT_Probe');
    const json = await res.json();
    expect(json.data.requested).toBe('generated');
  });

  it('case 5: a session-reported testResult pass never writes verified or lastVerifiedAt', async () => {
    const entityId = firstSeed('spellbook');
    upsertLifecycle({ catalogId: 'spellbook', entityId, lifecycle: 'wired', ueAssets: [] });
    const res = await post({ catalogId: 'spellbook', entityId, nextLifecycle: 'verified', testResult: 'pass' });
    expect(res.status).toBe(200);
    const row = getLifecycle('spellbook', entityId)!;
    expect(row.lifecycle).not.toBe('verified');
    expect(row.lastVerifiedAt).toBeUndefined();
    const json = await res.json();
    expect(json.data.held).toMatch(/drained L3\/L4 gate/);
  });

  it('case 6: after any transition POST the derivation has nothing left to overwrite', async () => {
    for (const [catalogId, next] of [['combat-map', 'wired'], ['state-graph', 'generated'], ['items', 'verified']] as const) {
      const entityId = firstSeed(catalogId);
      const res = await post({ catalogId, entityId, nextLifecycle: next, testResult: next === 'verified' ? 'pass' : undefined });
      expect(res.status, catalogId).toBe(200);
      expect(syncEntityLifecycle(catalogId, entityId).changed, catalogId).toBe(false);
    }
  });

  it('case 7 [guard]: a non-static promptVariantId still books its A/B trial', async () => {
    recordTrial.mockReturnValue({ id: 'trial-1' });
    const entityId = firstSeed('bestiary');
    const res = await post({
      catalogId: 'bestiary', entityId, nextLifecycle: 'generated', promptVariantId: 'variant-probe',
    });
    expect(res.status).toBe(200);
    expect(recordTrial).toHaveBeenCalledWith('variant-probe', true);
    const json = await res.json();
    expect(json.data.trialRecorded).toBe(true);
  });
});
