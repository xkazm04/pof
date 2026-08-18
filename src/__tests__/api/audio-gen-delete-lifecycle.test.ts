import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DELETE, GET, POST } from '@/app/api/audio-gen/route';
import { AUDIO_DIR } from '@/lib/audio-asset-db';

beforeEach(() => { process.env.ELEVENLABS_API_KEY = 'sk-test'; });
afterEach(() => { vi.restoreAllMocks(); });

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/audio-gen', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const del = (qs: string) => new NextRequest(`http://localhost/api/audio-gen?${qs}`, { method: 'DELETE' });

/** Generate one real asset (real bytes on disk) via the route's own POST path. */
async function generateOne(setName: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200 }));
  const body = await (await POST(makePost({
    provider: 'elevenlabs', kind: 'sfx', prompt: `lifecycle ${setName} ${Math.random()}`, setName,
  }))).json();
  expect(body.success).toBe(true);
  return body.data as { asset: { id: string; relPath: string }; set: { id: string } };
}

describe('DELETE /api/audio-gen — deleting removes the bytes, not just the row', () => {
  it('deleting a variation unlinks its real file', async () => {
    const { asset } = await generateOne(`lc-asset-${Date.now()}`);
    const abs = join(AUDIO_DIR, asset.relPath);
    expect(existsSync(abs)).toBe(true);

    const res = await (await DELETE(del(`assetId=${asset.id}`))).json();

    expect(res.success).toBe(true);
    expect(res.data.dbRowDeleted).toBe(true);
    expect(res.data.fileRemoval.ok).toBe(true);
    expect(res.data.fileRemoval.removed).toBe(1);
    expect(existsSync(abs)).toBe(false);
  });

  it('deleting a set removes its whole ~/.pof/audio/<setId> directory', async () => {
    const { set, asset } = await generateOne(`lc-set-${Date.now()}`);
    const dir = join(AUDIO_DIR, set.id);
    expect(existsSync(join(AUDIO_DIR, asset.relPath))).toBe(true);

    const res = await (await DELETE(del(`setId=${set.id}`))).json();

    expect(res.success).toBe(true);
    expect(res.data.dbRowDeleted).toBe(true);
    expect(res.data.fileRemoval.ok).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });

  it('a FAILED unlink is reported alongside the DB row outcome (never half-silent)', async () => {
    const { asset } = await generateOne(`lc-fail-${Date.now()}`);
    const abs = join(AUDIO_DIR, asset.relPath);
    // Replace the file with a directory of the same name: unlink() then fails
    // for real, so the route must report the failure AND that the row went.
    rmSync(abs, { force: true });
    mkdirSync(abs, { recursive: true });

    const res = await (await DELETE(del(`assetId=${asset.id}`))).json();

    expect(res.success).toBe(true);
    expect(res.data.fileRemoval.ok).toBe(false);
    expect(typeof res.data.fileRemoval.reason).toBe('string');
    expect(res.data.fileRemoval.path).toBe(abs);
    // The DB row's fate is stated, not implied.
    expect(res.data.dbRowDeleted).toBe(true);

    rmSync(abs, { recursive: true, force: true });
  });

  it('deleting an unknown asset id reports there was nothing on disk', async () => {
    const res = await (await DELETE(del('assetId=does-not-exist'))).json();
    expect(res.success).toBe(true);
    expect(res.data.fileRemoval.ok).toBe(true);
    expect(res.data.fileRemoval.reason).toMatch(/nothing on disk/i);
  });
});

describe('GET /api/audio-gen — the module states its real footprint', () => {
  it('reports bytes + file count under AUDIO_DIR', async () => {
    const body = await (await GET()).json();
    expect(typeof body.data.disk.bytes).toBe('number');
    expect(typeof body.data.disk.files).toBe('number');
    expect(typeof body.data.audioDir).toBe('string');
  });
});
