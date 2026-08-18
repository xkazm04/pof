import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/audio/import-result/route';

const ORIGIN = 'http://localhost/api/audio/import-result';

function post(body: unknown): NextRequest {
  return new NextRequest(ORIGIN, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const get = (qs = '') => new NextRequest(`${ORIGIN}${qs}`);

describe('GET /api/audio/import-result — the recorded reality the Library reads', () => {
  it('exposes the per-set latest run plus the UE dependency preflight', async () => {
    const setName = `route-set-${Date.now()}-${Math.random()}`;
    await POST(post({ setName, assetsImported: 2, cuePath: '/Game/Audio/x/SC_x', wiredEvent: 'AN_X' }));

    const body = await (await GET(get())).json();
    expect(body.success).toBe(true);
    expect(body.data.bySet[setName].cuePath).toBe('/Game/Audio/x/SC_x');
    expect(body.data.bySet[setName].assetsImported).toBe(2);
    expect(typeof body.data.preflight.ok).toBe('boolean');
    expect(typeof body.data.preflight.reason).toBe('string');
    expect(body.data.preflight.scriptRelPath).toBe('Content/Python/import_audio_set.py');
  });

  it('bySet holds the LATEST run for a set, not the first', async () => {
    const setName = `route-latest-${Date.now()}-${Math.random()}`;
    await POST(post({ setName, assetsImported: 1, cuePath: null }));
    await POST(post({ setName, assetsImported: 5, cuePath: '/Game/Audio/y/SC_y' }));

    const body = await (await GET(get())).json();
    expect(body.data.bySet[setName].assetsImported).toBe(5);
    expect(body.data.bySet[setName].cuePath).toBe('/Game/Audio/y/SC_y');
  });

  it('?setName= narrows to one set; a never-imported set is null, not a fabricated pass', async () => {
    const body = await (await GET(get(`?setName=never-imported-${Date.now()}`))).json();
    expect(body.success).toBe(true);
    expect(body.data.record).toBeNull();
    expect(typeof body.data.preflight.ok).toBe('boolean');
  });
});
