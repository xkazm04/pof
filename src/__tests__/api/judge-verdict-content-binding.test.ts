/**
 * The REAL write path against the REAL lab read path.
 *
 * This is the exact gap that let a silent bug ship: every unit test on either side passed,
 * because each side hashed with its own rule and nothing ever ran the two together.
 *
 *   WRITE — `POST /api/pipeline-artifacts` stamps `data._provenance` (`stampPromptVersion`
 *           always writes the key), then `POST /api/judge-verdicts` derives the verdict's
 *           `contentHash` from that PERSISTED row.
 *   READ  — the lab (`useStepAcceptance` → `resolveStepAcceptance`) hashes the LOCAL artifact
 *           the browser produced, which never carried `_provenance`.
 *
 * So for every step produced in a browser the two hashes could not agree: a CURRENT judge fail
 * classified `stale`, stopped condemning, and the strip claimed the step had been "re-produced
 * since" about byte-identical content — while `/status` still showed the fail.
 *
 * The headless seam had the OPPOSITE polarity: `submitStepArtifact` (the MCP
 * `pof_submit_artifact` path) and the L3/L4 gate re-persists write `data` WITHOUT the stamp, so
 * those rows agreed by accident. Both polarities are asserted below.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Throwaway DB — the live one carries a judging campaign's verdicts (see the note in
// pipeline-artifacts-post.test.ts).
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-verdict-binding-${process.pid}.db`;
});
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { POST as postArtifact } from '@/app/api/pipeline-artifacts/route';
import { POST as postVerdict, GET as getVerdicts } from '@/app/api/judge-verdicts/route';
import type { StandingVerdict } from '@/lib/judge/verdictStanding';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';
import { listVerdicts } from '@/lib/status/judge-verdicts-db';
import { submitStepArtifact, listCatalogSummaries } from '@/lib/catalog/headless';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { seededEntities } from '@/lib/catalog/seed';
import { resolveStepAcceptance } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';

const CATALOG = 'loot-filter'; // synthetic catalog: no server checker, so the write is verbatim
const STEP = 'Binding Probe';
const PASS: AcceptanceResult = { label: STEP, status: 'pass', tier: 'L0', detail: '' };

/** First registered pipeline with a seeded entity — the real MCP submit seam needs both. */
function firstRegisteredStep(): { catalogId: string; entityId: string; step: string } {
  for (const c of listCatalogSummaries()) {
    if (!c.registered || !c.entityCount) continue;
    const step = getCatalogPipeline(c.catalogId)?.steps[0];
    const entity = seededEntities(c.catalogId)[0];
    if (step && entity) return { catalogId: c.catalogId, entityId: entity.id, step: step.label };
  }
  throw new Error('fixture gap: no registered pipeline with a seeded entity');
}

function req(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function expectOk(res: Response) {
  const json = (await res.json()) as { success: boolean; error?: string };
  expect(json.error ?? null).toBeNull();
  expect(json.success).toBe(true);
}

/** Judge the step through the REAL verdict route (which derives the hash off the stored row). */
async function judgeFail(entityId: string) {
  await expectOk(await postVerdict(req('/api/judge-verdicts', {
    catalogId: CATALOG, entityId, step: STEP,
    judge: 'human', verdict: 'fail', score: 41,
    findings: 'the probe artifact contradicts its own sibling row',
    model: 'opus-judge', rubricVersion: RUBRIC_VERSION,
  })));
  return listVerdicts(CATALOG).filter((v) => v.entityId === entityId && v.step === STEP);
}

/** Read the catalog's verdicts through the REAL GET route (which attaches server standing). */
async function postVerdictsGet(): Promise<StandingVerdict[]> {
  const res = await getVerdicts(new NextRequest(`http://localhost/api/judge-verdicts?catalogId=${CATALOG}`));
  const json = (await res.json()) as { success: boolean; data: StandingVerdict[] };
  expect(json.success).toBe(true);
  return json.data;
}

/** The lab read path, given exactly what the browser holds locally. */
function labVerdict(entityId: string, local: Record<string, unknown>, verdicts: ReturnType<typeof listVerdicts>) {
  return resolveStepAcceptance({
    catalogId: CATALOG, step: STEP, local: PASS, verdicts, judgeClass: 'human', data: local,
  });
}

describe('judge verdict content binding — real write path vs real lab read path', () => {
  it('a browser-produced step (server stamps _provenance) binds its verdict as CURRENT', async () => {
    const entityId = 'probe-browser';
    const produced = { rules: ['keep unique'], threshold: 7 };

    await expectOk(await postArtifact(req('/api/pipeline-artifacts', {
      catalogId: CATALOG, entityId, step: STEP, data: produced, status: 'pass', tier: 'L0',
    })));

    // The persisted row genuinely carries the server stamp the local artifact never had —
    // this is the asymmetry, not a hypothetical.
    const stored = listArtifacts(CATALOG, entityId).find((a) => a.step === STEP);
    expect(stored?.data).toHaveProperty('_provenance');
    expect(produced).not.toHaveProperty('_provenance');

    const verdicts = await judgeFail(entityId);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].contentHash).toBeTruthy();

    const shown = labVerdict(entityId, produced, verdicts);
    expect(shown.judge?.provenance).toBe('current');
    expect(shown.status).toBe('fail'); // the condemnation actually applies
  });

  it('the same step re-produced with DIFFERENT content reads stale — binding still discriminates', async () => {
    const entityId = 'probe-browser'; // judged above, against { threshold: 7 }
    const verdicts = listVerdicts(CATALOG).filter((v) => v.entityId === entityId && v.step === STEP);
    const shown = labVerdict(entityId, { rules: ['keep unique'], threshold: 9 }, verdicts);
    expect(shown.judge?.provenance).toBe('stale');
    expect(shown.status).toBe('pass');
  });

  it('a headless/MCP-submitted step (NO _provenance stamp) also binds as CURRENT', async () => {
    // The REAL `pof_submit_artifact` seam: `submitStepArtifact` persists `data` verbatim, so
    // its rows carry no `_provenance` at all. Under the old rule these agreed by accident;
    // they must keep agreeing now that the stamp is excluded at the single hash seam.
    const target = firstRegisteredStep();
    const produced = { probe: 'headless', threshold: 3 };
    submitStepArtifact(target.catalogId, target.entityId, target.step, produced, []);

    const stored = listArtifacts(target.catalogId, target.entityId).find((a) => a.step === target.step);
    expect(stored?.data).not.toHaveProperty('_provenance');

    await expectOk(await postVerdict(req('/api/judge-verdicts', {
      catalogId: target.catalogId, entityId: target.entityId, step: target.step,
      judge: 'human', verdict: 'fail', score: 41,
      findings: 'the probe artifact contradicts its own sibling row',
      model: 'opus-judge', rubricVersion: RUBRIC_VERSION,
    })));
    const verdicts = listVerdicts(target.catalogId)
      .filter((v) => v.entityId === target.entityId && v.step === target.step);

    const shown = resolveStepAcceptance({
      catalogId: target.catalogId, step: target.step, local: { ...PASS, label: target.step },
      verdicts, judgeClass: 'human', data: produced,
    });
    expect(shown.judge?.provenance).toBe('current');
    expect(shown.status).toBe('fail');
  });

  it('GET enriches each row with the standing the server computed', async () => {
    // Only the server holds the artifacts the hash is compared against, so a reporting surface
    // (the Evaluator Verdicts tab) cannot derive this — and guessing would restate a quality
    // number acceptance does not hold.
    const res = await postVerdictsGet();
    const rows = res.filter((r) => r.entityId === 'probe-browser' && r.step === STEP);
    expect(rows).toHaveLength(1);
    expect(rows[0].provenance).toBe('current');
  });

  it('browsing gallery candidates is still not a content change', async () => {
    const entityId = 'probe-browser';
    const verdicts = listVerdicts(CATALOG).filter((v) => v.entityId === entityId && v.step === STEP);
    const shown = labVerdict(entityId, {
      rules: ['keep unique'], threshold: 7, genHistory: { batches: [1, 2, 3] },
    }, verdicts);
    expect(shown.judge?.provenance).toBe('current');
  });
});
