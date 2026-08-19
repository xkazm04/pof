/**
 * The 2D generation front, end to end through the real route handlers.
 *
 * FORCED-FAILURE SUITE: none of this could be asserted before this direction —
 * there was no prompt→image endpoint in the app, so "a provider with no key is
 * unrunnable and says why BEFORE any submit" had no surface to be true or false on.
 *
 * The one provider call is intercepted at the runner module (`runQwenImage`), which
 * the mock implements by writing a REAL file to the path the orchestration chose —
 * so the chain proven here is: POST → registry verdict → runner seam → bytes on disk
 * → GET /api/visual-gen/image/:name returns them. No paid provider is ever called.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

import { GET as caps, POST as generate } from '@/app/api/visual-gen/generate-2d/route';
import { GET as serveImage } from '@/app/api/visual-gen/image/[name]/route';
import { GENERATED_IMAGE_DIR } from '@/lib/visual-gen/image-providers';

const state = vi.hoisted(() => ({ fail: null as string | null, written: [] as string[] }));

vi.mock('@/lib/visual-gen/qwen-image-runner', () => ({
  runQwenImage: async (spec: { outputPath: string }) => {
    if (state.fail) return { ok: false, error: state.fail, durationMs: 1 };
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(spec.outputPath), { recursive: true });
    writeFileSync(spec.outputPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]));
    state.written.push(spec.outputPath);
    return {
      ok: true, imagePath: spec.outputPath, imageUrl: 'https://dashscope/test.png',
      model: 'qwen-image-2.0-pro', durationMs: 1,
    };
  },
}));

const KEYS = ['LEONARDO_API_KEY', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'SCENARIO_API_KEY'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  // A real key in the developer's shell must not make the no-key cases pass vacuously.
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  state.fail = null;
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});
afterAll(() => {
  for (const p of state.written) { try { rmSync(p); } catch { /* already gone */ } }
});

interface Envelope<T> { success: boolean; data?: T; error?: string }
interface Capability { id: string; name: string; executable: boolean; reason?: string; missingKey?: boolean }
interface GenResult { ok: boolean; url?: string; name?: string; providerName: string; model?: string }

const post = (body: unknown) =>
  generate(new NextRequest('http://localhost/api/visual-gen/generate-2d', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

const serve = (name: string) =>
  serveImage(new NextRequest(`http://localhost/api/visual-gen/image/${name}`), {
    params: Promise.resolve({ name }),
  });

describe('GET /api/visual-gen/generate-2d — capability, not a menu', () => {
  it('reports every provider unrunnable WITH its reason when the server holds no keys', async () => {
    const body = await (await caps()).json() as Envelope<{ providers: Capability[]; defaultProviderId: string | null }>;
    expect(body.success).toBe(true);
    expect(body.data!.defaultProviderId).toBeNull();
    for (const p of body.data!.providers) {
      expect(p.executable, p.id).toBe(false);
      expect(p.reason, p.id).toBeTruthy();
    }
    const leo = body.data!.providers.find((p) => p.id === 'leonardo')!;
    expect(leo.missingKey).toBe(true);
    expect(leo.reason).toContain('LEONARDO_API_KEY');
    // The unwired entry is a different sentence — a key would not help it.
    const scenario = body.data!.providers.find((p) => p.id === 'scenario')!;
    expect(scenario.missingKey).toBeUndefined();
    expect(scenario.reason).toContain('PBR TEXTURE SET');
  });

  it('turns a provider runnable — and default — the moment its key is present', async () => {
    process.env.QWEN_API_KEY = 'qwen-test';
    const body = await (await caps()).json() as Envelope<{ providers: Capability[]; defaultProviderId: string | null }>;
    expect(body.data!.defaultProviderId).toBe('qwen-image');
    expect(body.data!.providers.find((p) => p.id === 'qwen-image')!.executable).toBe(true);
    expect(body.data!.providers.find((p) => p.id === 'leonardo')!.executable).toBe(false);
  });

  it('never leaks a key value to the client', async () => {
    process.env.QWEN_API_KEY = 'qwen-super-secret';
    const raw = await (await caps()).text();
    expect(raw).not.toContain('qwen-super-secret');
  });
});

describe('POST /api/visual-gen/generate-2d — refusals carry the reason', () => {
  it('refuses a keyless provider with a 400 naming the env var, and never calls the runner', async () => {
    const res = await post({ prompt: 'a health potion icon', providerId: 'qwen-image' });
    expect(res.status).toBe(400);
    const body = await res.json() as Envelope<never>;
    expect(body.success).toBe(false);
    expect(body.error).toContain('QWEN_API_KEY');
    expect(state.written).toHaveLength(0);
  });

  it('refuses an empty prompt', async () => {
    process.env.QWEN_API_KEY = 'qwen-test';
    const res = await post({ prompt: '   ', providerId: 'qwen-image' });
    expect(res.status).toBe(400);
    expect((await res.json() as Envelope<never>).error).toContain('prompt was empty');
  });

  it('refuses the unwired registry entry even though its key is set', async () => {
    process.env.SCENARIO_API_KEY = 'sc';
    const res = await post({ prompt: 'stone wall', providerId: 'scenario' });
    expect(res.status).toBe(400);
    expect((await res.json() as Envelope<never>).error).toContain('/api/scenario');
  });

  it('reports a provider failure as 502 with the provider\'s own words', async () => {
    process.env.QWEN_API_KEY = 'qwen-test';
    state.fail = 'all Qwen-Image models exhausted. last: HTTP 429 quota';
    const res = await post({ prompt: 'a health potion icon', providerId: 'qwen-image' });
    expect(res.status).toBe(502); // asked and failed — not a refusal
    expect((await res.json() as Envelope<never>).error).toContain('HTTP 429 quota');
  });
});

describe('prompt → image → served file', () => {
  it('generates through the runner and the result is retrievable from the serve route', async () => {
    process.env.QWEN_API_KEY = 'qwen-test';
    const res = await post({ prompt: 'a weathered bronze potion icon', providerId: 'qwen-image' });
    expect(res.status).toBe(200);
    const body = await res.json() as Envelope<GenResult>;
    const data = body.data!;
    expect(data.ok).toBe(true);
    expect(data.providerName).toBe('Qwen-Image');
    expect(data.model).toBe('qwen-image-2.0-pro');
    expect(data.name).toMatch(/^qwen-image_\d+\.png$/);
    expect(data.url).toBe(`/api/visual-gen/image/${data.name}`);

    // The runner wrote where the orchestration said it would…
    expect(state.written).toContain(
      join(process.cwd(), 'generated', GENERATED_IMAGE_DIR, data.name!).replace(/\\/g, '/'),
    );
    // …and the serve route hands the same bytes back.
    const served = await serve(data.name!);
    expect(served.status).toBe(200);
    expect(served.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await served.arrayBuffer())[0]).toBe(0x89);
  });
});

describe('GET /api/visual-gen/image/:name — same discipline as the mesh routes', () => {
  it('404s a name that is well-formed but absent', async () => {
    expect((await serve('leonardo_1.png')).status).toBe(404);
  });

  for (const bad of ['../secret.png', '..%2Fsecret.png', 'a%2Fb.png', 'a\\b.png', '.env', 'x.exe', '%2e%2e%2fpackage.json']) {
    it(`refuses "${bad}"`, async () => {
      const res = await serve(bad);
      expect([400, 404]).toContain(res.status);
    });
  }
});
