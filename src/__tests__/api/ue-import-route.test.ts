/**
 * /api/visual-gen/ue-import — the production caller `importGlbToUE` never had.
 *
 * The validation here is not ceremony: every refusal below is a multi-minute editor launch
 * that would have failed, or a collision decision the caller cannot actually make.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/visual-gen/ue-import/route';
import { GET } from '@/app/api/visual-gen/ue-import/status/route';

const dir = mkdtempSync(join(tmpdir(), 'pof-ueimp-'));
const GLB = join(dir, 'chair.glb');
writeFileSync(GLB, 'not really a glb, but it exists');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/visual-gen/ue-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const status = (q: string) =>
  GET(new NextRequest(`http://localhost/api/visual-gen/ue-import/status${q}`));

describe('POST /api/visual-gen/ue-import — refusals', () => {
  it('requires glbPath', async () => {
    const res = await POST(post({ use: 'blocking' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/glbPath/);
  });

  it('refuses a non-.glb path rather than launching the editor to fail', async () => {
    const res = await POST(post({ glbPath: 'C:/gen/chair.fbx', use: 'blocking' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/\.glb/);
  });

  it('refuses a path that does not exist — the launch could only fail', async () => {
    const res = await POST(post({ glbPath: join(dir, 'missing.glb'), use: 'blocking' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no file at/);
  });

  it('REQUIRES use — collision has no safe default, so none is invented', async () => {
    const res = await POST(post({ glbPath: GLB }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatch(/use is required/);
    // The message has to say why, or the next caller just picks one at random.
    expect(error).toMatch(/decorative|blocking/);
  });

  it('rejects an unknown use instead of falling back to a default', async () => {
    const res = await POST(post({ glbPath: GLB, use: 'scenery' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/must be one of/);
  });

  it('rejects a nonsensical declared shell count', async () => {
    const res = await POST(post({ glbPath: GLB, use: 'blocking', components: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/positive integer/);
  });
});

describe('POST /api/visual-gen/ue-import — accepted', () => {
  it('starts a job and returns 202 with its id', async () => {
    const res = await POST(post({ glbPath: GLB, use: 'decorative', assetName: 'Sign' }));
    expect(res.status).toBe(202);
    const { success, data } = await res.json();
    expect(success).toBe(true);
    expect(typeof data.jobId).toBe('string');
  });
});

describe('GET /api/visual-gen/ue-import/status', () => {
  it('requires a jobId', async () => {
    const res = await status('');
    expect(res.status).toBe(400);
  });

  it('404s an unknown job rather than reporting an empty one', async () => {
    const res = await status('?jobId=nope');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/);
  });

  it('reports the request, its basis, and the observation as SEPARATE fields', async () => {
    const started = await POST(post({ glbPath: GLB, use: 'decorative', assetName: 'Sign' }));
    const { data } = await started.json();
    const res = await status(`?jobId=${data.jobId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body.use).toBe('decorative');
    expect(body.glbPath).toBe(GLB);
    // These three must remain distinguishable: what was asked, on what evidence, and what
    // was actually seen on the asset. Collapsing them is how a config change reads as proof.
    //
    // They are `null` rather than absent on purpose. JSON drops `undefined`, so an
    // unobserved `collisionElements` would leave NO KEY — indistinguishable from an API
    // that never reports collision at all, on the one field whose absence is the failure.
    expect(body).toHaveProperty('collision');
    expect(body).toHaveProperty('planBasis');
    expect(body).toHaveProperty('collisionElements');
    expect(body.collisionElements).toBeNull();
  });
});
