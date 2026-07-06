import { describe, it, expect } from 'vitest';
import {
  buildCreateTaskBody,
  parseTaskCreate,
  parseTaskStatus,
  parseUpload,
  runTripo,
  type TripoHttp,
} from '@/lib/visual-gen/tripo-runner';

describe('buildCreateTaskBody', () => {
  it('builds a text_to_model body with the prompt', () => {
    const b = buildCreateTaskBody({ mode: 'text-to-3d', prompt: 'a hero', outputPath: 'o.glb' });
    expect(b.type).toBe('text_to_model');
    expect(b.prompt).toBe('a hero');
  });

  it('builds an image_to_model body referencing the uploaded file token', () => {
    const b = buildCreateTaskBody({ mode: 'image-to-3d', imageToken: 'tok123', imageType: 'png', outputPath: 'o.glb' });
    expect(b.type).toBe('image_to_model');
    expect(b.file).toEqual({ type: 'png', file_token: 'tok123' });
  });

  it('uses a public image url when given (no upload)', () => {
    const b = buildCreateTaskBody({ mode: 'image-to-3d', imageUrl: 'https://x/y.jpg', imageType: 'jpg', outputPath: 'o.glb' });
    expect((b.file as Record<string, unknown>).url).toBe('https://x/y.jpg');
  });

  it('passes optional generation params through', () => {
    const b = buildCreateTaskBody({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', modelVersion: 'v2.5-20250123', faceLimit: 40000, texture: true, pbr: true, quad: false });
    expect(b.model_version).toBe('v2.5-20250123');
    expect(b.face_limit).toBe(40000);
    expect(b.texture).toBe(true);
    expect(b.pbr).toBe(true);
    expect(b.quad).toBe(false);
  });
});

describe('parseTaskCreate', () => {
  it('extracts the task id on success', () => {
    expect(parseTaskCreate({ code: 0, data: { task_id: 'abc' } })).toEqual({ ok: true, taskId: 'abc' });
  });
  it('surfaces the Tripo error message + suggestion', () => {
    const r = parseTaskCreate({ code: 2010, message: "You don't have enough credit", suggestion: 'Please purchase more credit' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/2010/);
    expect(r.error).toMatch(/enough credit/);
    expect(r.error).toMatch(/purchase/);
  });
});

describe('parseTaskStatus', () => {
  it('reports pending with progress while running', () => {
    const r = parseTaskStatus({ code: 0, data: { status: 'running', progress: 42 } });
    expect(r.state).toBe('pending');
    expect(r.progress).toBe(42);
  });
  it('prefers the pbr_model url on success', () => {
    const r = parseTaskStatus({ code: 0, data: { status: 'success', output: { model: 'a.glb', pbr_model: 'b.glb' } } });
    expect(r.state).toBe('success');
    expect(r.modelUrl).toBe('b.glb');
  });
  it('falls back to model then base_model', () => {
    expect(parseTaskStatus({ code: 0, data: { status: 'success', output: { model: 'm.glb' } } }).modelUrl).toBe('m.glb');
    expect(parseTaskStatus({ code: 0, data: { status: 'success', output: { base_model: 'base.glb' } } }).modelUrl).toBe('base.glb');
  });
  it('classifies terminal failure states', () => {
    for (const s of ['failed', 'cancelled', 'banned', 'expired', 'unknown']) {
      expect(parseTaskStatus({ code: 0, data: { status: s } }).state).toBe('failed');
    }
  });
});

describe('parseUpload', () => {
  it('extracts the image token', () => {
    expect(parseUpload({ code: 0, data: { image_token: 'img_tok' } })).toEqual({ ok: true, imageToken: 'img_tok' });
  });
  it('fails cleanly on a bad response', () => {
    expect(parseUpload({ code: 1002, message: 'Authentication failed' }).ok).toBe(false);
  });
});

// ── orchestration (injectable HTTP seam — no network / no credits) ────────────
function http(overrides: Partial<TripoHttp> = {}): TripoHttp {
  return {
    postJson: async () => ({ status: 200, json: { code: 0, data: { task_id: 'task-1' } } }),
    getJson: async () => ({ status: 200, json: { code: 0, data: { status: 'success', output: { model: 'https://cdn/model.glb' } } } }),
    uploadImage: async () => ({ status: 200, json: { code: 0, data: { image_token: 'img_tok' } } }),
    download: async () => true,
    ...overrides,
  };
}
const ENV = { TRIPO_API_KEY: 'tsk_test' };

describe('runTripo (orchestration)', () => {
  it('text-to-3d: creates a task, polls to success, downloads the glb', async () => {
    const seen: string[] = [];
    const res = await runTripo(
      { mode: 'text-to-3d', prompt: 'a stylized warrior', outputPath: 'out/hero.glb' },
      { http: http({ postJson: async (url) => { seen.push(url); return { status: 200, json: { code: 0, data: { task_id: 'task-1' } } }; } }), env: ENV, fileExists: () => true, now: () => 1, sleep: async () => {} },
    );
    expect(res.ok).toBe(true);
    expect(res.meshPath).toBe('out/hero.glb');
    expect(res.taskId).toBe('task-1');
    expect(seen[0]).toMatch(/\/task$/);
  });

  it('image-to-3d: uploads the image first, then references the returned token', async () => {
    let uploaded = false;
    let body: Record<string, unknown> | undefined;
    const res = await runTripo(
      { mode: 'image-to-3d', imagePath: 'C:/tmp/ref.png', outputPath: 'out/m.glb' },
      {
        http: http({
          uploadImage: async () => { uploaded = true; return { status: 200, json: { code: 0, data: { image_token: 'IMG' } } }; },
          postJson: async (_u, _h, b) => { body = b as Record<string, unknown>; return { status: 200, json: { code: 0, data: { task_id: 't2' } } }; },
        }),
        env: ENV, fileExists: () => true, now: () => 1, sleep: async () => {},
      },
    );
    expect(uploaded).toBe(true);
    expect(res.ok).toBe(true);
    expect((body!.file as Record<string, unknown>).file_token).toBe('IMG');
  });

  it('errors when TRIPO_API_KEY is missing', async () => {
    const res = await runTripo({ mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' }, { http: http(), env: {}, now: () => 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/TRIPO_API_KEY/);
  });

  it('surfaces an insufficient-credit error from task creation (real free-tier case)', async () => {
    const res = await runTripo(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' },
      { http: http({ postJson: async () => ({ status: 200, json: { code: 2010, message: "You don't have enough credit", suggestion: 'Please purchase more credit' } }) }), env: ENV, now: () => 1, sleep: async () => {} },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/enough credit/);
  });

  it('polls repeatedly while pending, then succeeds', async () => {
    const statuses = [
      { code: 0, data: { status: 'queued' } },
      { code: 0, data: { status: 'running', progress: 50 } },
      { code: 0, data: { status: 'success', output: { model: 'https://cdn/m.glb' } } },
    ];
    let i = 0;
    const res = await runTripo(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', pollIntervalMs: 10 },
      { http: http({ getJson: async () => ({ status: 200, json: statuses[i++] }) }), env: ENV, fileExists: () => true, now: () => 1, sleep: async () => {} },
    );
    expect(res.ok).toBe(true);
    expect(i).toBe(3);
  });

  it('fails when the task reports a terminal failure', async () => {
    const res = await runTripo(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' },
      { http: http({ getJson: async () => ({ status: 200, json: { code: 0, data: { status: 'failed' } } }) }), env: ENV, now: () => 1, sleep: async () => {} },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/failed/);
  });

  it('fails when the downloaded file never lands on disk', async () => {
    const res = await runTripo(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb' },
      { http: http({ download: async () => false }), env: ENV, fileExists: () => false, now: () => 1, sleep: async () => {} },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/download/i);
  });

  it('times out after maxPolls pending responses without infinite looping', async () => {
    const res = await runTripo(
      { mode: 'text-to-3d', prompt: 'x', outputPath: 'o.glb', pollIntervalMs: 10, maxPollMs: 30 },
      { http: http({ getJson: async () => ({ status: 200, json: { code: 0, data: { status: 'running' } } }) }), env: ENV, now: () => 1, sleep: async () => {} },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/tim(e|ed) out/i);
  });
});
