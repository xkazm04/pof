/**
 * GET /api/story/findings — WP2 acceptance 6 at the HTTP seam: the envelope, the counts, 404 on
 * an unknown graph, 409 on an ambiguous id. Throwaway DB via POF_DB_PATH.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-story-findings-${process.pid}.db`;
});
import { GET } from '@/app/api/story/findings/route';
import { saveStoryGraph } from '@/lib/story/story-db-conn';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { seedStructuralDefects } from '@/lib/story/defect-fixtures';
import { storyContentHash } from '@/lib/story/canonical';
import type { StoryFinding, StoryGraph } from '@/lib/story/types';

type Envelope<T> = { success: boolean; data?: T; error?: string };
interface Body {
  graphId: string;
  project: string;
  hash: string;
  findings: StoryFinding[];
  counts: { byCode: Record<string, number>; bySeverity: Record<string, number> };
  durationMs: number;
}
const get = (qs: string) => GET(new NextRequest(`http://localhost/api/story/findings?${qs}`));
const P = `fp-${process.pid}`;

async function store(g: StoryGraph): Promise<string> {
  const hash = await storyContentHash(g);
  const r = saveStoryGraph(g, hash, []);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return hash;
}

describe('GET /api/story/findings', () => {
  it('returns the envelope with findings, counts, hash and a duration', async () => {
    const g = { ...seedStructuralDefects(generateStoryGraph({ nodes: 40 }), 1).graph, project: P, graphId: 'seeded' };
    const hash = await store(g);
    const res = await get(`graphId=seeded&project=${P}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<Body>;
    expect(body.success).toBe(true);
    const d = body.data!;
    expect(d.graphId).toBe('seeded');
    expect(d.project).toBe(P);
    expect(d.hash).toBe(hash);
    expect(d.findings).toHaveLength(26); // 15 original codes + 8 wave-4 defects (six codes; UNKNOWN_KIND and PRECEDENCE_NOT_TOTAL planted twice) + 3 wave-5 (a bare gate node, an unsupported influence, an unknown profile coreKind)
    expect(d.findings.every((f) => f.altitude === 'structural' && f.lead === undefined)).toBe(true);
    expect(Object.values(d.counts.byCode).reduce((a, b) => a + b, 0)).toBe(26);
    expect(d.counts.byCode.FALSE_CHOICE).toBe(1);
    expect(typeof d.durationMs).toBe('number');
  });

  it('a clean stored graph has zero findings', async () => {
    await store({ ...generateStoryGraph({ nodes: 60 }), project: P, graphId: 'clean' });
    const body = (await (await get(`graphId=clean&project=${P}`)).json()) as Envelope<Body>;
    expect(body.data?.findings).toEqual([]);
    expect(body.data?.counts).toEqual({ byCode: {}, bySeverity: {} });
  });

  it('404 on an unknown graph, 400 without graphId', async () => {
    const res = await get(`graphId=nope-${process.pid}`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as Envelope<Body>).success).toBe(false);
    expect((await get('')).status).toBe(400);
  });

  it('409 when the id exists in several projects and no project is given', async () => {
    const id = `shared-${process.pid}`;
    await store({ ...generateStoryGraph({ nodes: 10 }), project: `${P}-a`, graphId: id });
    await store({ ...generateStoryGraph({ nodes: 10 }), project: `${P}-b`, graphId: id });
    expect((await get(`graphId=${id}`)).status).toBe(409);
    expect((await get(`graphId=${id}&project=${P}-a`)).status).toBe(200);
  });
});
