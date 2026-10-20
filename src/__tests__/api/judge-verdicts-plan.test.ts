/**
 * GET /api/judge-verdicts?plan=1 - the rejudge preview. Read-only: it must not change the verdict
 * table. Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-judge-verdicts-plan-${process.pid}.db`;
});
import { GET } from '@/app/api/judge-verdicts/route';
import { listVerdicts, upsertVerdict } from '@/lib/status/judge-verdicts-db';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { stepContentHash } from '@/lib/judge/contentHash';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';

const art = (entityId: string, step: string, data: Record<string, unknown>) =>
  upsertArtifact({ catalogId: 'items', entityId, step, data, ueAssets: [], status: 'pass', tier: 'L1' });

// never judged / content changed / unchanged: all text-config steps of the items catalog.
art('plan-1', 'Concept Brief', { note: 'never judged' });
art('plan-1', 'Affixes', { note: 'rewritten after the verdict' });
art('plan-1', 'Economy', { note: 'same as judged' });
// a step with no judgeable deliverable never enters the plan
art('plan-1', 'Test Gate', { note: 'ue-runtime' });
const verdict = (step: string, judgedData: Record<string, unknown>, v: 'pass' | 'fail') => upsertVerdict({
  catalogId: 'items', entityId: 'plan-1', step, judge: 'llm-panel', verdict: v, score: v === 'pass' ? 85 : 40,
  findings: 'concrete findings for the plan test', model: 'test', rubricVersion: RUBRIC_VERSION,
  contentHash: stepContentHash(judgedData),
});
verdict('Affixes', { note: 'older content' }, 'fail');
verdict('Economy', { note: 'same as judged' }, 'pass');

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/judge-verdicts?${qs}`));

describe('GET /api/judge-verdicts?plan=1', () => {
  it('returns entries, skipped, estimatedUsd and fitsBudget, and writes nothing', async () => {
    const before = listVerdicts('items').length;
    const plan = (await (await get('plan=1&catalogId=items')).json()).data;
    expect(plan.entries.map((e: { step: string; bucket: string }) => [e.step, e.bucket])).toEqual([
      ['Affixes', 'content'],
      ['Concept Brief', 'never'],
    ]);
    expect(plan.skipped.map((s: { step: string }) => s.step)).toEqual(['Economy']);
    expect(typeof plan.estimatedUsd).toBe('number');
    expect(Array.isArray(plan.fitsBudget)).toBe(true);
    expect(listVerdicts('items').length).toBe(before);
  });

  it('force=1 plans the unchanged step too', async () => {
    const plan = (await (await get('plan=1&catalogId=items&force=1')).json()).data;
    expect(plan.skipped).toHaveLength(0);
    expect(plan.entries.map((e: { step: string }) => e.step).sort()).toEqual(['Affixes', 'Concept Brief', 'Economy']);
  });

  it('without plan=1 the standing list is unchanged', async () => {
    const body = await (await get('catalogId=items')).json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty('provenance');
  });
});
