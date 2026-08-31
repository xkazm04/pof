/**
 * POST /api/visual-gen/view-gate + its status route — the door onto the render gate.
 *
 * The gate's three modules shipped with zero production consumers; this route and the
 * job store are what make them reachable. The tests below pin what the route refuses,
 * because every refusal here is the honest answer to a caller who would otherwise wait
 * minutes for Blender to discover the same thing.
 *
 * Real files on disk, not a mocked `fs`: the route's whole job at this point is to tell
 * the truth about what exists, and a stubbed `existsSync` would test the stub.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const startMock = vi.hoisted(() =>
  vi.fn((_spec: { members: Array<{ meshPath: string; subject?: string }> }) => 'viewgate-test-1'),
);
const getMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/visual-gen/view-gate-job-store', () => ({
  startViewGateJob: startMock,
  getViewGateJob: getMock,
}));

import { POST, MAX_KIT_MEMBERS } from '@/app/api/visual-gen/view-gate/route';
import { GET } from '@/app/api/visual-gen/view-gate/status/route';

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/visual-gen/view-gate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const status = (qs: string) => new NextRequest(`http://localhost/api/visual-gen/view-gate/status${qs}`);

let dir = '';
/** A real .glb on disk. */
const mesh = (name: string) => join(dir, name).split('\\').join('/');

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pof-view-gate-'));
  for (const n of ['crate.glb', 'a.glb', 'barrel.glb']) writeFileSync(join(dir, n), 'glb');
  for (let i = 0; i <= 12; i++) writeFileSync(join(dir, `m${i}.glb`), 'glb');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
  startMock.mockReset().mockReturnValue('viewgate-test-1');
  getMock.mockReset();
});

describe('POST /api/visual-gen/view-gate', () => {
  it('accepts a single meshPath and starts a job', async () => {
    const res = await POST(post({ meshPath: mesh('crate.glb'), subject: 'a wooden crate' }));
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.success).toBe(true);
    expect(body.data.jobId).toBe('viewgate-test-1');
    expect(startMock.mock.calls[0][0].members).toEqual([
      { meshPath: mesh('crate.glb'), subject: 'a wooden crate' },
    ]);
  });

  it('accepts a kit of members', async () => {
    await POST(post({ members: [{ meshPath: mesh('a.glb') }, { meshPath: mesh('barrel.glb'), name: 'barrel' }] }));
    expect(startMock.mock.calls[0][0].members).toHaveLength(2);
  });

  it('requires at least one mesh', async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/meshPath|members/i);
  });

  it('rejects a mesh that is not on disk instead of spending a Blender run on it', async () => {
    const res = await POST(post({ meshPath: mesh('missing.glb') }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('missing.glb');
    expect(startMock).not.toHaveBeenCalled();
  });

  it('names the missing member, not just "a mesh", in a kit', async () => {
    const res = await POST(post({ members: [{ meshPath: mesh('a.glb') }, { meshPath: mesh('gone.glb') }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('gone.glb');
  });

  it('caps the kit size — every member is N Blender renders and N VLM calls', async () => {
    const members = Array.from({ length: MAX_KIT_MEMBERS + 1 }, (_, i) => ({ meshPath: mesh(`m${i}.glb`) }));
    const res = await POST(post({ members }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(String(MAX_KIT_MEMBERS));
    expect(startMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/visual-gen/view-gate/status', () => {
  it('requires a jobId', async () => {
    const res = await GET(status(''));
    expect(res.status).toBe(400);
  });

  it('404s an unknown job rather than reporting an empty one', async () => {
    getMock.mockReturnValue(undefined);
    const res = await GET(status('?jobId=nope'));
    expect(res.status).toBe(404);
  });

  it('reports the verdict, per-member gates and the advisory kit grade', async () => {
    getMock.mockReturnValue({
      id: 'viewgate-test-1',
      status: 'done',
      verdict: 'fail',
      spec: { members: [] },
      startedAt: 0,
      members: [
        {
          name: 'crate',
          meshPath: '/gen/crate.glb',
          render: { ok: true, views: [{ index: 0, yawDeg: 0, imagePath: '/v0.png' }], durationMs: 9 },
          gate: { verdict: 'fail', views: [], reason: 'view 1 scored severity 3' },
        },
        { name: 'barrel', meshPath: '/gen/barrel.glb', error: 'Blender not found' },
      ],
      kit: { verdict: 'drifting', advisory: true, caveat: 'provisional', meanDeltaE: 12.5 },
    });

    const res = await GET(status('?jobId=viewgate-test-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.verdict).toBe('fail');
    expect(body.data.members[0].gate.reason).toContain('severity 3');
    expect(body.data.members[0].views[0].imagePath).toBe('/v0.png');
    // The member that could not be rendered is reported, not dropped.
    expect(body.data.members[1].error).toBe('Blender not found');
    expect(body.data.members[1].gate).toBeUndefined();
    // Coherence stays advisory and carries its caveat wherever it is read.
    expect(body.data.kit.advisory).toBe(true);
    expect(body.data.kit.caveat).toBe('provisional');
  });
});
