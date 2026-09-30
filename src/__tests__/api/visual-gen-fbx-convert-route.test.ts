import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The FBX endpoint takes ONE operator path in (absolute, .fbx, on disk) and writes ONE
 * file out, always under the allow-listed `generated/converted/` — no caller string
 * reaches the output path. A refusal is an answer (200, converted:false), the
 * mesh-split contract; only a malformed request is an error.
 */

const runFbxConvert = vi.fn();
vi.mock('@/lib/visual-gen/fbx-convert', () => ({ runFbxConvert: (...a: unknown[]) => runFbxConvert(...a) }));

const PRESENT = new Set(['C:/in/model.fbx', 'C:/in/m.fbx']);
vi.mock('node:fs', async (orig) => {
  const real = await orig<typeof import('node:fs')>();
  const existsSync = (p: string) => PRESENT.has(String(p).replace(/\\/g, '/'));
  const mkdirSync = () => undefined;
  return { ...real, existsSync, mkdirSync, default: { ...real, existsSync, mkdirSync } };
});

async function post(body: unknown) {
  const { POST } = await import('@/app/api/visual-gen/fbx-convert/route');
  const req = new Request('http://localhost/api/visual-gen/fbx-convert', { method: 'POST', body: JSON.stringify(body) });
  return POST(req as never);
}

describe('POST /api/visual-gen/fbx-convert', () => {
  beforeEach(() => runFbxConvert.mockReset());

  it('400s a non-.fbx and a relative path, 404s a missing file — before any spawn', async () => {
    expect((await post({ inputPath: 'C:/in/model.obj' })).status).toBe(400);
    expect((await post({ inputPath: 'relative/m.fbx' })).status).toBe(400);
    expect((await post({ inputPath: 'C:/missing/m.fbx' })).status).toBe(404);
    expect(runFbxConvert).not.toHaveBeenCalled();
  });

  it('ignores a caller outputPath: the output is always generated/converted/<stem>.glb', async () => {
    runFbxConvert.mockResolvedValue({ ok: false, error: 'x', durationMs: 1 });
    await post({ inputPath: 'C:/in/model.fbx', outputPath: 'C:/Windows/x.glb' });
    const spec = runFbxConvert.mock.calls[0][0] as { inputPath: string; outputPath: string; draco?: boolean };
    expect(spec.inputPath).toBe('C:/in/model.fbx');
    expect(spec.outputPath.endsWith('generated/converted/model.glb')).toBe(true);
    expect(spec.outputPath).not.toContain('Windows');
    expect(spec.draco).toBe(false);
  });

  it('answers a converted receipt with a servable URL', async () => {
    runFbxConvert.mockResolvedValue({ ok: true, meshes: 3, tris: 12840, bytes: 4096, output: '/x/m.glb', durationMs: 5 });
    const res = await post({ inputPath: 'C:/in/m.fbx' });
    const json = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({
      converted: true, url: '/api/visual-gen/asset/m.glb?dir=converted', tris: 12840, meshes: 3, bytes: 4096,
    });
  });

  it('answers a refusal as converted:false with its reason (not an error)', async () => {
    runFbxConvert.mockResolvedValue({ ok: false, error: 'the FBX holds no mesh', durationMs: 5 });
    const res = await post({ inputPath: 'C:/in/m.fbx' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(json.data).toMatchObject({ converted: false, reason: 'the FBX holds no mesh' });
  });
});
