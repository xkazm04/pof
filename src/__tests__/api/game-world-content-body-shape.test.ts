import { afterEach, describe, expect, it, vi } from 'vitest';

// Own throwaway DB: every case here must be refused before a row is read or written, and
// on an unfixed route some of them would have written.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/game-world-content-body-shape-${process.pid}/pof.db`;
});
import { NextRequest } from 'next/server';
import * as audioGen from '@/app/api/audio-gen/route';

/**
 * game-world-content-api request-body shape: malformed or non-object JSON is a 400 with
 * the error envelope (house shape: pipeline-artifacts/_lib/sweepBody.ts), never a TypeError
 * 500 from destructuring `null`. No provider is ever called: these are refused first.
 */

afterEach(() => { vi.restoreAllMocks(); });

function req(url: string, method: string, raw: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: raw,
  });
}

async function expect400(res: Response) {
  expect(res.status).toBe(400);
  expect((await res.json()).success).toBe(false);
}

describe('/api/audio-gen body shape', () => {
  it.each(['null', '"sfx"', '[]'])('POST refuses non-object JSON %s', async (raw) => {
    await expect400(await audioGen.POST(req('/api/audio-gen', 'POST', raw)));
  });
  it.each(['null', '"x"'])('PATCH refuses non-object JSON %s', async (raw) => {
    await expect400(await audioGen.PATCH(req('/api/audio-gen', 'PATCH', raw)));
  });
});

describe('/api/audio/import-result body shape', () => {
  it.each(['null', '"set"'])('POST refuses non-object JSON %s', async (raw) => {
    const { POST } = await import('@/app/api/audio/import-result/route');
    await expect400(await POST(req('/api/audio/import-result', 'POST', raw)));
  });
});

describe('/api/spatial-audio-generate body shape', () => {
  it.each(['{"action":', 'null', '[]'])('POST refuses malformed or non-object JSON %s', async (raw) => {
    const { POST } = await import('@/app/api/spatial-audio-generate/route');
    await expect400(await POST(req('/api/spatial-audio-generate', 'POST', raw)));
  });
});

describe('/api/audio-codegen body shape', () => {
  it.each(['{"sceneId":', 'null'])('POST refuses malformed or non-object JSON %s', async (raw) => {
    const { POST } = await import('@/app/api/audio-codegen/route');
    await expect400(await POST(req('/api/audio-codegen', 'POST', raw)));
  });
});

describe('/api/level-design body shape', () => {
  it.each(['{"name":', 'null', '[]'])('POST refuses malformed or non-object JSON %s', async (raw) => {
    const { POST } = await import('@/app/api/level-design/route');
    await expect400(await POST(req('/api/level-design', 'POST', raw)));
  });
  it('POST refuses a non-string name', async () => {
    const { POST } = await import('@/app/api/level-design/route');
    await expect400(await POST(req('/api/level-design', 'POST', JSON.stringify({ name: 42 }))));
  });
  it.each(['{"id":1,', 'null'])('PUT refuses malformed or non-object JSON %s', async (raw) => {
    const { PUT } = await import('@/app/api/level-design/route');
    await expect400(await PUT(req('/api/level-design', 'PUT', raw)));
  });
  it.each(['rooms', 'connections', 'difficultyArc', 'syncReport'])('PUT refuses a non-array %s and names it', async (field) => {
    const { PUT } = await import('@/app/api/level-design/route');
    const res = await PUT(req('/api/level-design', 'PUT', JSON.stringify({ id: 1, [field]: { not: 'an array' } })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(field);
  });
});

describe('/api/procgen/zone-pins request shape', () => {
  it.each(['', '?id=', '?id=%20'])('DELETE without an id (%s) is a 400, not a reported delete of pin 0', async (qs) => {
    const { DELETE } = await import('@/app/api/procgen/zone-pins/route');
    await expect400(await DELETE(new NextRequest(`http://localhost/api/procgen/zone-pins${qs}`, { method: 'DELETE' })));
  });
  it.each(['{"seed":', 'null'])('POST refuses malformed or non-object JSON %s', async (raw) => {
    const { POST } = await import('@/app/api/procgen/zone-pins/route');
    await expect400(await POST(req('/api/procgen/zone-pins', 'POST', raw)));
  });
});

describe('/api/animations/mixamo-result body shape', () => {
  it.each(['{"importedCount":', 'null'])('POST refuses malformed or non-object JSON %s', async (raw) => {
    const { POST } = await import('@/app/api/animations/mixamo-result/route');
    await expect400(await POST(req('/api/animations/mixamo-result', 'POST', raw)));
  });
  it.each([null, '', ' ', -1, 2.5, true])('POST refuses importedCount %j instead of recording it as a run', async (importedCount) => {
    const { POST } = await import('@/app/api/animations/mixamo-result/route');
    await expect400(await POST(req('/api/animations/mixamo-result', 'POST', JSON.stringify({ importedCount, importDir: 'x' }))));
  });
  it.each([[4, 4], ['3', 3], [0, 0]])('control: importedCount %j is recorded as %d', async (importedCount, stored) => {
    const { POST } = await import('@/app/api/animations/mixamo-result/route');
    const res = await POST(req('/api/animations/mixamo-result', 'POST', JSON.stringify({ importedCount, importDir: 'x' })));
    expect(res.status).toBe(201);
    expect((await res.json()).data.importedCount).toBe(stored);
  });
});

describe('/api/pattern-library body shape', () => {
  it.each(['{"action":', 'null'])('POST refuses malformed or non-object JSON %s', async (raw) => {
    const { POST } = await import('@/app/api/pattern-library/route');
    await expect400(await POST(req('/api/pattern-library', 'POST', raw)));
  });
  it('POST update refuses an array patch', async () => {
    const { POST } = await import('@/app/api/pattern-library/route');
    await expect400(await POST(req('/api/pattern-library', 'POST', JSON.stringify({ action: 'update', id: 'p1', patch: ['title'] }))));
  });
});
