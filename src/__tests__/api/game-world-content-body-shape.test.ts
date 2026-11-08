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
