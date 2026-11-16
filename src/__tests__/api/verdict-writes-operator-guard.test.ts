/**
 * A judge or craft verdict moves what the acceptance and status layers believe, so a forged one
 * is a forged quality result. Both writes sit behind `requireOperator`, like the artifact writes
 * they grade; a same-origin desk and a header-less judge script are still admitted.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const stored = vi.hoisted(() => ({ judge: 0, craft: 0 }));

vi.mock('@/lib/status/judge-verdicts-db', () => ({
  listVerdicts: () => [],
  upsertVerdict: () => { stored.judge += 1; return {}; },
}));
vi.mock('@/lib/pipeline-artifacts-db', () => ({ listAllArtifacts: () => [] }));
vi.mock('@/lib/judge/stepBinding', () => ({ currentStepBinding: () => null }));
vi.mock('@/lib/judge/admission', () => ({ admitJudgeVerdict: (v: unknown) => ({ ok: true, data: v }) }));
vi.mock('@/lib/craft/admission', () => ({ admitCraftGauge: () => ({ ok: true, data: {} }) }));
vi.mock('@/lib/craft/craft-verdicts-db', () => ({
  listCraftVerdicts: () => [], listCraftVerdictHistory: () => [], craftHistoryIndex: () => new Map(),
  craftVerdictKey: () => '', upsertCraftVerdict: () => { stored.craft += 1; return {}; },
  PROCESS_ENTITY: '__process__', PROCESS_STEP: '__process__',
}));
vi.mock('@/lib/craft/craft-coverage-gaps-db', () => ({ listCoverageGaps: () => [], replaceCoverageGaps: () => [] }));

import { POST as postJudge } from '@/app/api/judge-verdicts/route';
import { POST as postCraft } from '@/app/api/craft-verdicts/route';

const JUDGE = {
  catalogId: 'c', entityId: 'e', step: 's', judge: 'human', verdict: 'pass', score: 90,
  findings: 'long enough to audit', model: 'm',
};
const CRAFT = { catalogId: 'c', entityId: 'e', step: 's', aLevel: 'A4', findings: [], model: 'm' };

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3001/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  stored.judge = 0;
  stored.craft = 0;
});

describe('verdict writes are operator-guarded', () => {
  it('refuses a cross-site judge verdict', async () => {
    expect((await postJudge(req(JUDGE, { origin: 'https://evil.example' }))).status).toBe(403);
    expect(stored.judge).toBe(0);
  });

  it('refuses a cross-site craft gauge', async () => {
    expect((await postCraft(req(CRAFT, { origin: 'https://evil.example' }))).status).toBe(403);
    expect(stored.craft).toBe(0);
  });

  it('requires a configured token on both writes', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', 'secret');
    expect((await postJudge(req(JUDGE))).status).toBe(401);
    expect((await postCraft(req(CRAFT))).status).toBe(401);
    expect(stored.judge + stored.craft).toBe(0);
  });

  it('still admits the same-origin desk and a header-less judge script', async () => {
    expect((await postJudge(req(JUDGE, { origin: 'http://localhost:3001' }))).status).toBe(200);
    expect((await postJudge(req(JUDGE))).status).toBe(200);
    expect((await postCraft(req(CRAFT))).status).toBe(200);
    expect(stored.judge).toBe(2);
    expect(stored.craft).toBe(1);
  });
});
