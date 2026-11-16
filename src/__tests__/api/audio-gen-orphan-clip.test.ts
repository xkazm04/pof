import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Own throwaway DB (and so its own `<dir>/audio` clip root): this suite writes clip bytes.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/audio-gen-orphan-clip-${process.pid}/pof.db`;
});

const failInsert = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/audio-asset-db', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/audio-asset-db')>();
  return {
    ...real,
    addAsset: (...args: Parameters<typeof real.addAsset>) => {
      if (failInsert.on) throw new Error('SQLITE_BUSY: database is locked');
      return real.addAsset(...args);
    },
  };
});

import { existsSync, readdirSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/audio-gen/route';
import { resolveAudioPath } from '@/lib/audio-asset-db';

/**
 * POST wrote the clip to disk and THEN inserted its row. When the insert failed the
 * request was a 500 and the file stayed under AUDIO_DIR with no row pointing at it -
 * no DELETE can ever reach it. On insert failure the just-written file is removed.
 * The provider is never called for real: fetch is stubbed and the key is a dummy.
 */

beforeEach(() => { process.env.ELEVENLABS_API_KEY = 'sk-test'; });
afterEach(() => {
  failInsert.on = false;
  delete process.env.ELEVENLABS_API_KEY;
  vi.restoreAllMocks();
});

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/audio-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/audio-gen when the asset insert fails', () => {
  it('returns the error and leaves no clip file behind', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const setId = `orphan-${process.pid}-${Date.now()}`;
    failInsert.on = true;

    const res = await POST(post({
      provider: 'elevenlabs', kind: 'sfx', prompt: `orphan probe ${Date.now()}-${Math.random()}`, setId,
    }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('SQLITE_BUSY');
    const setDir = resolveAudioPath(setId)!;
    const left = existsSync(setDir) ? readdirSync(setDir) : [];
    expect(left).toEqual([]);
  });

  it('control: a successful insert keeps the clip it wrote', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([4, 5, 6]), { status: 200 }));
    const setId = `kept-${process.pid}-${Date.now()}`;

    const res = await POST(post({
      provider: 'elevenlabs', kind: 'sfx', prompt: `kept probe ${Date.now()}-${Math.random()}`, setId,
    }));

    expect(res.status).toBe(200);
    expect(readdirSync(resolveAudioPath(setId)!)).toHaveLength(1);
  });
});
