/**
 * /api/story/walk + /api/story/walk/:jobId — WP3 acceptance 8: POST is a 202 with a job id and
 * never walks inside the request; the status route progresses to `done` with a report whose
 * findings are leads; an unknown job and an unknown graph are 404; the POST is operator-guarded
 * (cross-origin 403). Throwaway DB: POF_DB_PATH is set before the import graph opens SQLite.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-story-walk-${process.pid}.db`;
});
import { POST } from '@/app/api/story/walk/route';
import { GET as STATUS } from '@/app/api/story/walk/[jobId]/route';
import { saveStoryGraph } from '@/lib/story/story-db-conn';
import { storyContentHash } from '@/lib/story/canonical';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { softlockGraph } from '@/lib/story/walker-fixtures';
import type { WalkJob } from '@/lib/story/walk-jobs';
import type { StoryGraph } from '@/lib/story/types';

const BASE = 'http://localhost/api/story/walk';
type Envelope<T = unknown> = { success: boolean; data?: T; error?: string };
const json = async <T>(res: Response) => (await res.json()) as Envelope<T>;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const status = (jobId: string) => STATUS(new NextRequest(`${BASE}/${jobId}`), { params: Promise.resolve({ jobId }) });

const PROJECT = `walk-${process.pid}`;
async function store(g: StoryGraph): Promise<{ graphId: string; hash: string }> {
  const graph = { ...g, project: PROJECT };
  const hash = await storyContentHash(graph);
  const saved = saveStoryGraph(graph, hash, []);
  if (!saved.ok) throw new Error(saved.error.message);
  return { graphId: graph.graphId, hash };
}

async function waitDone(jobId: string): Promise<{ states: string[]; job: WalkJob & { jobId: string } }> {
  const states: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const body = await json<WalkJob & { jobId: string }>(await status(jobId));
    states.push(body.data!.state);
    if (body.data!.state === 'done' || body.data!.state === 'failed') return { states, job: body.data! };
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('walk job never finished');
}

afterEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
});

describe('POST /api/story/walk', () => {
  it('returns 202 + jobId at once, and the job progresses to done with a report of leads', async () => {
    const { graphId, hash } = await store(softlockGraph());
    const res = await POST(post({ graphId, project: PROJECT, seed: 3, samples: 400 }));
    expect(res.status).toBe(202);
    const body = await json<{ jobId: string; state: string; progress: { done: number; total: number }; hash: string }>(res);
    expect(body.success).toBe(true);
    expect(body.data!.state).toBe('queued');
    expect(body.data!.progress).toEqual({ done: 0, total: 400 });
    expect(body.data!.hash).toBe(hash);

    const { states, job } = await waitDone(body.data!.jobId);
    expect(job.state).toBe('done');
    expect(states[0]).not.toBe('done'); // the request did not walk synchronously
    expect(job.progress).toEqual({ done: 400, total: 400 });
    const report = job.report!;
    expect(report.evidence.runs[0].graphHash).toBe(hash); // pinned: the evidence is verified
    const lock = report.findings.find((f) => f.code === 'SOFTLOCK_LEAD')!;
    expect(lock.altitude).toBe('state');
    expect(lock.lead).toMatchObject({ seed: 3, samples: 400, state: { coins: 1 }, path: ['START', 'CHOOSE', 'COUNT'] });
    expect(lock.detail).toContain('not a proven defect');
    // E.rich is covered and never reached: a MEASURED zero in the report, beside its NODE_NEVER_REACHED lead.
    expect(report.evidence.reach['E.rich']).toEqual({ uniform: 0 });
    expect(report.findings.some((f) => f.code === 'NODE_NEVER_REACHED' && f.nodes[0] === 'E.rich')).toBe(true);
  });

  it('progress advances in chunks on a larger graph', async () => {
    const { graphId } = await store({ ...generateStoryGraph({ nodes: 2000, seed: 4 }), graphId: 'walk-big' });
    const res = await POST(post({ graphId, project: PROJECT, samples: 300 }));
    const { states, job } = await waitDone((await json<{ jobId: string }>(res)).data!.jobId);
    expect(job.state).toBe('done');
    expect(states).toContain('running');
  });

  it('an unknown graph is 404; a bad body is 400', async () => {
    expect((await POST(post({ graphId: 'no-such-graph', project: PROJECT }))).status).toBe(404);
    expect((await POST(post({ graphId: 'x', samples: 0 }))).status).toBe(400);
    expect((await POST(post({ graphId: 'x', extra: 1 }))).status).toBe(400);
  });

  it('is requireOperator-guarded: a cross-site browser request is refused', async () => {
    const res = await POST(post({ graphId: 'x' }, { origin: 'http://evil.example', host: 'localhost' }));
    expect(res.status).toBe(403);
  });

  it('is requireOperator-guarded: a configured token must be presented', async () => {
    process.env.POF_OPERATOR_TOKEN = 'tok-walk';
    expect((await POST(post({ graphId: 'x' }))).status).toBe(401);
  });
});

describe('GET /api/story/walk/:jobId', () => {
  it('an unknown job is 404', async () => {
    const res = await status('walk-does-not-exist');
    expect(res.status).toBe(404);
    expect((await json(res)).success).toBe(false);
  });
});
