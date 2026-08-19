/**
 * Entity lifecycle DERIVED from pipeline truth.
 *
 * `catalog_lifecycle` held ZERO rows (measured 2026-08-19 against 817 persisted
 * artifacts / 736 `pass`), every seed hardcodes `lifecycle: 'planned'`, and the only
 * writer was the legacy generation callback — so every entity in the product rendered
 * the `pending ○` glyph no matter what the pipeline had proven.
 *
 * The load-bearing assertion in here is the NEGATIVE one: a config-complete entity whose
 * evidence is only L0/L1/L2 shape checks must NOT reach `verified`. Deriving a green dot
 * from shape checks is the exact lie this derivation exists to refuse; `verified` stays
 * gated on a DRAINED L3/L4 gate, through the already-tested `resolveTransition`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-entity-lifecycle-${process.pid}.db`;
});

import { NextRequest } from 'next/server';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { deriveEntityLifecycle, resolveTransition } from '@/lib/catalog/lifecycle';
import { deriveCatalogLifecycle, syncEntityLifecycle } from '@/lib/catalog/headless';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { seededEntities } from '@/lib/catalog/seed';
import { listLifecycle } from '@/lib/catalog-db';
import { upsertArtifact, listArtifacts, deleteArtifact } from '@/lib/pipeline-artifacts-db';
import { GET as lifecycleGET, POST as lifecyclePOST } from '@/app/api/catalog/lifecycle/route';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

type Art = Pick<PipelineArtifact, 'status' | 'tier'>;
const art = (status: Art['status'], tier: Art['tier']): Art => ({ status, tier });

describe('deriveEntityLifecycle — pure derivation', () => {
  it('no artifacts → planned', () => {
    const d = deriveEntityLifecycle([], 4);
    expect(d.lifecycle).toBe('planned');
    expect(d.testResult).toBeUndefined();
  });

  it('a step still pending / never produced → scaffolded', () => {
    const d = deriveEntityLifecycle([art('pass', 'L0'), art('pending', 'L0')], 4);
    expect(d.lifecycle).toBe('scaffolded');
    expect(d.evidence.pending).toBeGreaterThan(0);
  });

  it('every step produced but an EARLY-tier deferral holds it → generated', () => {
    const d = deriveEntityLifecycle([art('pass', 'L0'), art('deferred', 'L2')], 2);
    expect(d.evidence.configComplete).toBe(false);
    expect(d.lifecycle).toBe('generated');
  });

  it('any failing step → failed', () => {
    const d = deriveEntityLifecycle([art('pass', 'L3'), art('fail', 'L0')], 2);
    expect(d.lifecycle).toBe('failed');
  });

  // ── The negative assertion this whole direction turns on ────────────────────
  it('SHAPE-ONLY: a config-complete entity with only L0/L1/L2 passes does NOT reach verified', () => {
    const d = deriveEntityLifecycle([art('pass', 'L0'), art('pass', 'L1'), art('pass', 'L2')], 3);
    expect(d.evidence.configComplete).toBe(true);
    expect(d.evidence.gatePasses).toBe(0);
    expect(d.lifecycle).toBe('wired');
    expect(d.lifecycle).not.toBe('verified');
    expect(d.testResult).toBeUndefined();
    // and the tree is TOLD which, rather than being left to read `wired` as "done"
    expect(d.evidence.summary).toMatch(/UNPROVEN/);
  });

  it('an UNDRAINED L3/L4 gate (deferred) still stops at wired, and says so', () => {
    const d = deriveEntityLifecycle([art('pass', 'L0'), art('deferred', 'L3'), art('deferred', 'L4')], 3);
    expect(d.evidence.configComplete).toBe(true);
    expect(d.evidence.gatesUndrained).toBe(2);
    expect(d.lifecycle).toBe('wired');
    expect(d.evidence.summary).toMatch(/runtime\/visual gate/);
  });

  it('config-complete + a DRAINED L3 gate that passes → verified', () => {
    const d = deriveEntityLifecycle([art('pass', 'L0'), art('pass', 'L2'), art('pass', 'L3')], 3);
    expect(d.evidence.gatePasses).toBe(1);
    expect(d.lifecycle).toBe('verified');
    expect(d.testResult).toBe('pass');
    // the `verified` rung is produced BY the tested gate, not beside it
    expect(resolveTransition('wired', 'verified', d.testResult)).toBe('verified');
    expect(resolveTransition('wired', 'verified', undefined)).toBeNull();
  });

  it('configComplete comes from summarizeEntity, not a second copy of the rule', () => {
    // an L3 deferral is config-complete; an L2 deferral is not — exactly rollup.ts's rule
    expect(deriveEntityLifecycle([art('deferred', 'L3')], 1).evidence.configComplete).toBe(true);
    expect(deriveEntityLifecycle([art('deferred', 'L2')], 1).evidence.configComplete).toBe(false);
  });
});

// ── DB-backed: the table that held zero rows ─────────────────────────────────
// A registered catalog with a seeded entity, driven against a THROWAWAY DB.
function fixture() {
  for (const c of ['items', 'spellbook', 'bestiary']) {
    const pipeline = getCatalogPipeline(c);
    const entity = seededEntities(c)[0];
    if (pipeline?.steps.length && entity) return { catalogId: c, steps: pipeline.steps.map((s) => s.label), entityId: entity.id };
  }
  throw new Error('fixture gap: no registered catalog with a seeded entity');
}

function writeSteps(catalogId: string, entityId: string, steps: string[], mk: (i: number) => Art) {
  steps.forEach((step, i) => {
    const a = mk(i);
    upsertArtifact({ catalogId, entityId, step, data: { seeded: i }, ueAssets: [`/Game/Test/${i}`], status: a.status, tier: a.tier ?? 'L0' });
  });
}

describe('lifecycle persistence — derived, never toggled', () => {
  const { catalogId, steps, entityId } = fixture();
  const testEntity = `test-lifecycle-${entityId}`;

  beforeEach(() => {
    for (const a of listArtifacts(catalogId, testEntity)) deleteArtifact(catalogId, testEntity, a.step);
  });

  it('a shape-only all-pass entity syncs to wired — NOT verified — with no lastVerifiedAt', () => {
    writeSteps(catalogId, testEntity, steps, () => art('pass', 'L0'));
    const { record, derived } = syncEntityLifecycle(catalogId, testEntity);
    expect(record.lifecycle).toBe('wired');
    expect(record.lastVerifiedAt).toBeUndefined();
    expect(derived.evidence.gatePasses).toBe(0);
  });

  it('a drained L3 gate promotes the same entity to verified AND persists lastVerifiedAt', () => {
    writeSteps(catalogId, testEntity, steps, (i) => (i === 0 ? art('pass', 'L3') : art('pass', 'L0')));
    const { record } = syncEntityLifecycle(catalogId, testEntity);
    expect(record.lifecycle).toBe('verified');
    expect(record.lastVerifiedAt).toBeTruthy();
    expect(record.lastTestResult).toBe('pass');
    // the row is really in the table the product reads (it held 0 rows before this)
    expect(listLifecycle(catalogId).some((r) => r.entityId === testEntity && r.lifecycle === 'verified')).toBe(true);
    // re-syncing is idempotent and does not re-stamp the verification time
    const again = syncEntityLifecycle(catalogId, testEntity);
    expect(again.record.lastVerifiedAt).toBe(record.lastVerifiedAt);
    expect(again.changed).toBe(false);
  });

  it('deriveCatalogLifecycle reports the derived state next to what is persisted', () => {
    writeSteps(catalogId, testEntity, steps, () => art('pass', 'L0'));
    const view = deriveCatalogLifecycle(catalogId, testEntity)[0];
    expect(view.entityId).toBe(testEntity);
    expect(view.lifecycle).toBe('wired');
    expect(view.evidence.summary).toContain('UNPROVEN');
  });
});

describe('GET/POST /api/catalog/lifecycle', () => {
  const { catalogId, steps, entityId } = fixture();
  const testEntity = `test-lifecycle-route-${entityId}`;

  it('GET derives without writing; POST sync persists it', async () => {
    for (const a of listArtifacts(catalogId, testEntity)) deleteArtifact(catalogId, testEntity, a.step);
    writeSteps(catalogId, testEntity, steps, (i) => (i === 0 ? art('pass', 'L4') : art('pass', 'L0')));

    const before = listLifecycle(catalogId).find((r) => r.entityId === testEntity);
    const getRes = await lifecycleGET(new NextRequest(
      `http://localhost/api/catalog/lifecycle?catalogId=${catalogId}&entityId=${testEntity}`,
    ));
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);
    expect(getBody.data[0].lifecycle).toBe('verified');
    // READ-ONLY: a display read must never mutate state
    const after = listLifecycle(catalogId).find((r) => r.entityId === testEntity);
    expect(after?.lifecycle).toBe(before?.lifecycle);

    const postRes = await lifecyclePOST(new NextRequest('http://localhost/api/catalog/lifecycle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', catalogId, entityId: testEntity }),
    }));
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.data.records[0].lifecycle).toBe('verified');
    expect(postBody.data.records[0].evidence).toBeTruthy();
    expect(listLifecycle(catalogId).find((r) => r.entityId === testEntity)?.lifecycle).toBe('verified');
  });

  it('rejects an unknown action and a missing catalogId', async () => {
    const bad = await lifecyclePOST(new NextRequest('http://localhost/api/catalog/lifecycle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', catalogId, entityId: 'x', lifecycle: 'verified' }),
    }));
    expect(bad.status).toBe(400);
    const noCat = await lifecycleGET(new NextRequest('http://localhost/api/catalog/lifecycle'));
    expect(noCat.status).toBe(400);
  });
});
