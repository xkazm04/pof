/**
 * /api/story/graphs + /api/story/graphs/:graphId — WP1 acceptance 5 (validated, operator-guarded,
 * envelope-shaped) and 6 at the HTTP seam (an unknown kind is stored and reported).
 * Throwaway DB: POF_DB_PATH is set before the import graph opens better-sqlite3.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-story-graphs-${process.pid}.db`;
});
import { GET as LIST, POST } from '@/app/api/story/graphs/route';
import { GET as GET_ONE, DELETE } from '@/app/api/story/graphs/[graphId]/route';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { storyContentHash } from '@/lib/story/canonical';

const BASE = 'http://localhost/api/story/graphs';
type Envelope<T = unknown> = { success: boolean; data?: T; error?: string };

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const ctx = (graphId: string) => ({ params: Promise.resolve({ graphId }) });
const json = async <T>(res: Response) => (await res.json()) as Envelope<T>;

let seq = 0;
/** A fresh, valid graph per test so tests never share a row. */
function graph(extra: Record<string, unknown> = {}) {
  seq += 1;
  return { ...generateStoryGraph({ nodes: 12, seed: seq }), project: `p-${process.pid}`, graphId: `g-${seq}`, ...extra };
}

afterEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
});

describe('POST /api/story/graphs', () => {
  it('imports a valid graph with the {success,data} envelope and 201', async () => {
    const g = graph();
    const res = await POST(post(g));
    expect(res.status).toBe(201);
    const body = await json<{ status: string; graph: { graphId: string; nodeCount: number; hash: string }; unknownKinds: unknown[] }>(res);
    expect(body.success).toBe(true);
    expect(body.data?.status).toBe('created');
    expect(body.data?.graph.graphId).toBe(g.graphId);
    expect(body.data?.graph.nodeCount).toBe(12);
    expect(body.data?.graph.hash).toBe(await storyContentHash(g));
    expect(body.data?.unknownKinds).toEqual([]);
  });

  it('refuses an invalid document with {success:false,error} and 400 — variables failure is loud', async () => {
    const g = graph();
    (g.variables[0] as unknown as Record<string, unknown>).domain = undefined;
    const res = await POST(post(g));
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/^variables block failed to parse/);
    expect(body.data).toBeUndefined();
  });

  it('refuses a non-JSON body', async () => {
    const res = await POST(post('{nope'));
    expect(res.status).toBe(400);
    expect((await json(res)).success).toBe(false);
  });

  it('is requireOperator-guarded: a configured token must be presented', async () => {
    process.env.POF_OPERATOR_TOKEN = 'tok-story';
    const g = graph();
    const denied = await POST(post(g));
    expect(denied.status).toBe(401);
    expect((await json(denied)).success).toBe(false);
    const allowed = await POST(post(g, { authorization: 'Bearer tok-story' }));
    expect(allowed.status).toBe(201);
  });

  it('is requireOperator-guarded: a cross-site browser request is refused', async () => {
    const res = await POST(post(graph(), { origin: 'http://evil.example', host: 'localhost' }));
    expect(res.status).toBe(403);
  });

  it('stores an unknown kind as written and reports it', async () => {
    const g = graph();
    g.nodes = [...g.nodes, { id: 'X', kind: 'pool' as never, title: 'unknown' }];
    const res = await POST(post(g));
    const body = await json<{ unknownKinds: unknown[]; graph: { unknownKinds: unknown[] } }>(res);
    expect(body.success).toBe(true);
    expect(body.data?.unknownKinds).toEqual([{ where: 'node', id: 'X', kind: 'pool' }]);
    const one = await json<{ graph: { nodes: { id: string; kind: string }[] }; unknownKinds: unknown[] }>(
      await GET_ONE(new NextRequest(`${BASE}/${g.graphId}`), ctx(g.graphId)),
    );
    expect(one.data?.graph.nodes.find((n) => n.id === 'X')?.kind).toBe('pool');
    expect(one.data?.unknownKinds).toEqual([{ where: 'node', id: 'X', kind: 'pool' }]);
  });

  it('enforces revision monotonicity and hash identity', async () => {
    const g = graph({ revision: 3 });
    expect((await POST(post(g))).status).toBe(201);
    const same = await json<{ status: string }>(await POST(post(g)));
    expect(same.data?.status).toBe('unchanged');
    const older = await POST(post({ ...g, revision: 2 }));
    expect(older.status).toBe(409);
    const reused = await POST(post({ ...g, budgets: { ...g.budgets, basis: 'changed' } }));
    expect(reused.status).toBe(409);
    const newer = await json<{ status: string; graph: { revision: number } }>(await POST(post({ ...g, revision: 4 })));
    expect(newer.data?.status).toBe('replaced');
    expect(newer.data?.graph.revision).toBe(4);
  });

  it('refuses a declared contentHash that does not match the content', async () => {
    const res = await POST(post(graph({ contentHash: 'sha256:00' })));
    expect(res.status).toBe(400);
    const ok = graph();
    const res2 = await POST(post({ ...ok, contentHash: await storyContentHash(ok) }));
    expect(res2.status).toBe(201);
  });
});

describe('GET / DELETE', () => {
  it('lists summaries without bodies, scoped by ?project=', async () => {
    const g = graph({ project: `list-${process.pid}` });
    await POST(post(g));
    const body = await json<Record<string, unknown>[]>(await LIST(new NextRequest(`${BASE}?project=list-${process.pid}`)));
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data?.[0].graphId).toBe(g.graphId);
    expect(body.data?.[0]).not.toHaveProperty('json');
    expect(body.data?.[0]).not.toHaveProperty('graph');
  });

  it('404s an unknown graph, 409s a graphId shared by two projects until ?project= narrows it', async () => {
    expect((await GET_ONE(new NextRequest(`${BASE}/nope`), ctx('nope'))).status).toBe(404);
    const shared = `shared-${process.pid}`;
    await POST(post(graph({ graphId: shared, project: 'a' })));
    await POST(post(graph({ graphId: shared, project: 'b' })));
    expect((await GET_ONE(new NextRequest(`${BASE}/${shared}`), ctx(shared))).status).toBe(409);
    const one = await json<{ project: string }>(await GET_ONE(new NextRequest(`${BASE}/${shared}?project=b`), ctx(shared)));
    expect(one.data?.project).toBe('b');
  });

  it('DELETE is guarded and removes the row', async () => {
    const g = graph();
    await POST(post(g));
    process.env.POF_OPERATOR_TOKEN = 'tok-del';
    expect((await DELETE(new NextRequest(`${BASE}/${g.graphId}`, { method: 'DELETE' }), ctx(g.graphId))).status).toBe(401);
    const del = await DELETE(
      new NextRequest(`${BASE}/${g.graphId}`, { method: 'DELETE', headers: { 'x-operator-token': 'tok-del' } }),
      ctx(g.graphId),
    );
    expect((await json<{ deleted: boolean }>(del)).data?.deleted).toBe(true);
    expect((await GET_ONE(new NextRequest(`${BASE}/${g.graphId}`), ctx(g.graphId))).status).toBe(404);
  });
});
