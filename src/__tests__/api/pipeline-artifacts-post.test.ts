/**
 * Ship-loop Milestone 1 (pipeline truth-seam): POST /api/pipeline-artifacts must
 * SERVER-grade a submitted artifact for any registered pipeline step — the caller's
 * `status` is never trusted (closes the fabricated-truth hole where any client could
 * POST `status:'pass'` with empty data). Catalogs with no server checker (bespoke
 * Items specs, the synthetic loot-filter catalog) keep the caller status, since the
 * server genuinely can't re-derive them.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Isolate from the user's real ~/.pof/pof.db: live judge_verdicts rows are overlaid onto
// every grade by the judge-acceptance bridge, so a fresh submit that SHOULD pass gets
// re-graded against whatever verdicts a judging campaign left behind (this test failed
// deterministically after the green-loop campaign for exactly that reason). vi.hoisted
// runs before the import graph, so src/lib/db.ts picks the throwaway path up at init.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifacts-post-${process.pid}.db`;
});
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { seededEntities } from '@/lib/catalog/seed';
import { listCatalogSummaries, gradeArtifact, serverCheckerFor } from '@/lib/catalog/headless';
import { POST } from '@/app/api/pipeline-artifacts/route';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';

const safeStatus = (accept: (d: Record<string, unknown>) => { status: string }, d: Record<string, unknown>) => {
  try { return accept(d).status; } catch { return null; }
};

/** First registered pipeline that has a seeded entity + a step whose empty-data verdict is NOT `pass`. */
function pickFalsePassCase() {
  for (const c of listCatalogSummaries()) {
    if (!c.registered || !c.entityCount) continue;
    const pipeline = getCatalogPipeline(c.catalogId);
    const step = pipeline?.steps.find((s) => {
      const st = safeStatus(s.accept, {});
      return st !== null && st !== 'pass';
    });
    if (pipeline && step) return { catalogId: c.catalogId, pipeline, step, entity: seededEntities(c.catalogId)[0] };
  }
  throw new Error('fixture gap: no registered step with a non-pass empty verdict');
}

function postReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/pipeline-artifacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('gradeArtifact — server-side acceptance grading', () => {
  it('grades a registered step via its own checker (graded:true)', () => {
    const { catalogId, step } = pickFalsePassCase();
    const g = gradeArtifact(catalogId, step.label, {});
    expect(g.graded).toBe(true);
    expect(g.result?.status).toBe(safeStatus(step.accept, {}));
    expect(g.result?.status).not.toBe('pass');
  });

  it('returns graded:false when no server checker exists (unregistered catalog)', () => {
    const g = gradeArtifact('___no_such_catalog___', 'whatever', {});
    expect(g.graded).toBe(false);
    expect(g.result).toBeNull();
    expect(serverCheckerFor('___no_such_catalog___', 'x')).toBeNull();
  });
});

describe('POST /api/pipeline-artifacts — re-grades server-side (no fabricated pass)', () => {
  it('overrides a client-claimed pass with the server verdict for a registered step', async () => {
    const { catalogId, step, entity } = pickFalsePassCase();
    const serverStatus = safeStatus(step.accept, {});

    const res = await POST(postReq({
      catalogId, entityId: entity.id, step: step.label,
      data: {}, ueAssets: [], status: 'pass', tier: 'L0',
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(serverStatus); // server re-derived
    expect(body.data.status).not.toBe('pass');    // the fabricated pass was rejected

    const persisted = listArtifacts(catalogId, entity.id).find((a) => a.step === step.label);
    expect(persisted?.status).toBe(serverStatus);
  });

  it('persists a real pass/deferred when the produced data actually satisfies the checker', async () => {
    const { catalogId, pipeline, entity } = pickFalsePassCase();
    const step = pipeline.steps[0];
    const labEntity = { id: entity.id, name: entity.name, lifecycle: entity.lifecycle, data: entity.data };
    const good = step.produce(labEntity).data ?? {};
    const expected = safeStatus(step.accept, good); // pass | deferred per Rule 5

    const res = await POST(postReq({
      catalogId, entityId: entity.id, step: step.label,
      data: good, ueAssets: [], status: 'pending', // caller understates; server should override
    }));
    const body = await res.json();
    expect(body.data.status).toBe(expected);
  });

  // The reason a rejection gives has to survive the `{ success:false, error }` envelope:
  // the standard client (`tryApiFetch`) surfaces `error` and drops `details`, so a bare
  // "Invalid artifact payload" left the operator with a red step and no way to fix it.
  it('names the offending fields IN THE ERROR STRING when the payload is invalid', async () => {
    const res = await POST(postReq({ catalogId: 'items', step: 'Economy' })); // no entityId, no data
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('entityId'); // the missing field, named
    expect(body.error).toContain('status'); // ...and every other one, not just the first
    // `details` is still there for machine consumers.
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('trusts the caller status for a synthetic catalog with no server checker (loot-filter compat)', async () => {
    const res = await POST(postReq({
      catalogId: 'loot-filter-synthetic-shiploop-test', entityId: 'e1', step: 'Generate',
      data: {}, ueAssets: [], status: 'pass', tier: 'L1',
    }));
    const body = await res.json();
    expect(body.data.status).toBe('pass'); // preserved — the server cannot re-derive it
  });
});
