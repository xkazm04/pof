/**
 * The quality-evaluation API's body-reading writes answer a body that is not a JSON object
 * with a 400 BEFORE any spawn, write or paid call. They used to throw into the 500 path:
 * truncated JSON was a SyntaxError and a literal `null` was a TypeError on the first field.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

const spawned = vi.hoisted(() => ({ count: 0 }));
const bump = () => { spawned.count += 1; throw new Error('must not be reached'); };

vi.mock('@/lib/harness', () => ({
  createHarnessOrchestrator: bump,
  createDefaultConfig: bump,
  rehydrateHarnessOrchestrator: bump,
  resolveRunIdentity: bump,
}));
vi.mock('@/lib/harness/guide-generator', () => ({ renderGuideMarkdown: () => '', loadGuide: () => null }));
vi.mock('@/lib/harness/orchestrator', () => ({
  readHarnessPlan: () => null, readHarnessCost: () => null, readCheckpoints: () => null,
  readRunMeta: () => null, isResumableStatus: () => false,
}));
vi.mock('@/lib/ue-experiment/job-store', () => ({ startExperimentJob: bump }));
vi.mock('@/lib/evaluator/deep-eval-job', () => ({
  startDeepEvalJob: bump, getDeepEvalJob: () => null, cancelDeepEvalJob: async () => null,
}));
vi.mock('@/lib/evaluator/git-attribution', () => ({ attributeFilesSince: bump }));
vi.mock('@/lib/vision/router', () => ({ recognize: bump }));

type Handler = (req: NextRequest) => Promise<Response>;

const ROUTES: [string, () => Promise<{ POST: Handler }>][] = [
  ['harness', () => import('@/app/api/harness/route') as Promise<{ POST: Handler }>],
  ['experiment/run', () => import('@/app/api/experiment/run/route') as Promise<{ POST: Handler }>],
  ['regression-tracker', () => import('@/app/api/regression-tracker/route') as Promise<{ POST: Handler }>],
  ['performance-profiling', () => import('@/app/api/performance-profiling/route') as Promise<{ POST: Handler }>],
  ['evaluator/results', () => import('@/app/api/evaluator/results/route') as Promise<{ POST: Handler }>],
  ['evaluator/git-attribution', () => import('@/app/api/evaluator/git-attribution/route') as Promise<{ POST: Handler }>],
  ['evaluator/deep-eval', () => import('@/app/api/evaluator/deep-eval/route') as Promise<{ POST: Handler }>],
  ['judge-verdicts', () => import('@/app/api/judge-verdicts/route') as Promise<{ POST: Handler }>],
  ['craft-verdicts', () => import('@/app/api/craft-verdicts/route') as Promise<{ POST: Handler }>],
  ['verify/animation', () => import('@/app/api/verify/animation/route') as Promise<{ POST: Handler }>],
  ['verify/visual', () => import('@/app/api/verify/visual/route') as Promise<{ POST: Handler }>],
];

const BODIES = ['{not json', 'null', '[]', '42', '"text"'];

function post(name: string, raw: string) {
  return new NextRequest(`http://localhost/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
}

afterEach(() => { spawned.count = 0; });

describe('quality-evaluation API refuses a body that is not a JSON object', () => {
  for (const [name, load] of ROUTES) {
    for (const raw of BODIES) {
      it(`${name} answers ${raw} with 400`, async () => {
        const { POST } = await load();
        const res = await POST(post(name, raw));
        expect(res.status).toBe(400);
        expect((await res.json()).success).toBe(false);
        expect(spawned.count).toBe(0);
      });
    }
  }
});
