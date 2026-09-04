/**
 * `data._provenance.engine` — who produced this artifact — on the two write paths a
 * client uses: the lab's write-through (`postArtifact` → POST /api/pipeline-artifacts)
 * and, by comparison, the deterministic one-shot route.
 *
 * Two rules, and they pull against each other:
 *  - EVERY artifact is stamped, deterministic authors included (an unstamped row reads as
 *    "nobody knows", which is exactly the 100%-unknown state measured on 2026-09-04).
 *  - A client may only declare an engine the server is willing to accept from a client.
 *    'Claude' is an attestation about a dispatch the server ran; a browser claiming it
 *    would be a fabricated-provenance hole of the same shape as a fabricated `pass`.
 *
 * Standard: catalog-pipeline-authoring / direction-is-an-input-not-a-text-box.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifacts-provenance-${process.pid}.db`;
});

import { POST } from '@/app/api/pipeline-artifacts/route';
import { listArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { postArtifact } from '@/components/layout-lab/labArtifactClient';
import { readProvenance, LAB_PRODUCE_ENGINE, CLIENT_DECLARABLE_ENGINES } from '@/lib/provenance';

const CAT = 'prov-test-catalog';
const ENT = 'prov-test-entity';

const postReq = (body: Record<string, unknown>) => new NextRequest('http://localhost/api/pipeline-artifacts', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

function stored(step: string) {
  const row = listArtifacts(CAT, ENT).find((a) => a.step === step);
  return readProvenance(row?.data as Record<string, unknown> | undefined);
}

describe('POST /api/pipeline-artifacts — a declared engine is persisted, an unverifiable one is not', () => {
  it('persists a client-declared Code engine (the deterministic browser produce)', async () => {
    const res = await POST(postReq({
      catalogId: CAT, entityId: ENT, step: 'Declared Code', data: { brief: 'x' },
      ueAssets: [], status: 'pass', engine: 'Code',
    }));
    expect(res.status).toBe(200);
    expect(stored('Declared Code')?.engine).toBe('Code');
  });

  it('refuses or downgrades a client-declared Claude — a browser cannot attest a dispatch', async () => {
    const res = await POST(postReq({
      catalogId: CAT, entityId: ENT, step: 'Declared Claude', data: { brief: 'x' },
      ueAssets: [], status: 'pass', engine: 'Claude',
    }));
    if (res.status === 200) {
      expect(stored('Declared Claude')?.engine).not.toBe('Claude');
    } else {
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(String(body.error)).toMatch(/engine/i);
    }
    expect(CLIENT_DECLARABLE_ENGINES).not.toContain('Claude');
  });

  it('downgrades an unverifiable engine smuggled inside data._provenance', async () => {
    const res = await POST(postReq({
      catalogId: CAT, entityId: ENT, step: 'Smuggled Claude', data: { brief: 'x', _provenance: { engine: 'Claude', model: 'opus' } },
      ueAssets: [], status: 'pass',
    }));
    expect(res.status).toBe(200);
    expect(stored('Smuggled Claude')?.engine).toBe('unknown');
  });

  it('PRESERVES an engine the server itself already recorded for that row (a re-POST is not a new claim)', async () => {
    // The lab's write-through re-POSTs what `POST /api/one-shot/step` persisted after a live
    // CLI produce. That row's Claude stamp is server-attested; sanitising it on the round trip
    // would destroy real provenance to defend against a claim that was never made.
    upsertArtifact({
      catalogId: CAT, entityId: ENT, step: 'Round Trip', data: { brief: 'x', _provenance: { engine: 'Claude', model: 'sonnet' } },
      ueAssets: [], status: 'pass', tier: 'L0',
    });
    const res = await POST(postReq({
      catalogId: CAT, entityId: ENT, step: 'Round Trip', data: { brief: 'x', _provenance: { engine: 'Claude', model: 'sonnet' } },
      ueAssets: [], status: 'pass',
    }));
    expect(res.status).toBe(200);
    expect(stored('Round Trip')?.engine).toBe('Claude');
  });

  it('records an unstamped, undeclared write as unknown rather than inventing a producer', async () => {
    const res = await POST(postReq({
      catalogId: CAT, entityId: ENT, step: 'Bare', data: { brief: 'x' }, ueAssets: [], status: 'pass',
    }));
    expect(res.status).toBe(200);
    expect(stored('Bare')?.engine).toBe('unknown');
  });
});

describe('the lab write-through and the deterministic route agree on the engine', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('postArtifact declares the deterministic produce engine', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true, data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await postArtifact({ catalogId: CAT, entityId: ENT, step: 'S', data: { brief: 'x' }, ueAssets: [], status: 'pass' });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.engine).toBe(LAB_PRODUCE_ENGINE);
    expect(LAB_PRODUCE_ENGINE).toBe('Code');
    vi.unstubAllGlobals();
  });

  it('postArtifact declares NOTHING when the payload already carries a producer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true, data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await postArtifact({
      catalogId: CAT, entityId: ENT, step: 'S', ueAssets: [], status: 'pass',
      data: { brief: 'x', _provenance: { engine: 'Claude', model: 'sonnet' } },
    });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.engine).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
