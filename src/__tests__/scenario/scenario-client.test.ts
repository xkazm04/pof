import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTexture, classifyPbrMap } from '@/lib/scenario';

const BASE = 'https://api.cloud.scenario.com/v1';

interface Call { url: string; method: string; auth?: string; body?: unknown }

function installFetch(handler: (url: string, method: string) => { ok?: boolean; status?: number; body?: unknown }): { calls: Call[] } {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const method = init?.method ?? 'GET';
    const auth = init?.headers?.Authorization;
    calls.push({ url, method, auth, body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body });
    const r = handler(url, method);
    return { ok: r.ok ?? true, status: r.status ?? 200, json: () => Promise.resolve(r.body ?? {}), text: () => Promise.resolve(JSON.stringify(r.body ?? {})) };
  }) as unknown as typeof fetch;
  return { calls };
}

beforeEach(() => { process.env.SCENARIO_API_KEY = 'key123'; process.env.SCENARIO_API_SECRET = 'secret456'; });
afterEach(() => { vi.restoreAllMocks(); });

function installTextureFlow(): { calls: Call[] } {
  return installFetch((url, method) => {
    if (method === 'POST' && url.endsWith('/generate/txt2img-texture')) {
      return { body: { job: { jobId: 'job-1', status: 'queued', metadata: {} } } };
    }
    if (method === 'GET' && url.includes('/jobs/job-1')) {
      return { body: { job: { jobId: 'job-1', status: 'success', metadata: { assetIds: ['a-alb', 'a-nrm', 'a-rgh'] } } } };
    }
    if (method === 'GET' && url.includes('/assets/a-alb')) return { body: { asset: { id: 'a-alb', url: 'https://cdn.scenario/albedo.png', metadata: { type: 'albedo' } } } };
    if (method === 'GET' && url.includes('/assets/a-nrm')) return { body: { asset: { id: 'a-nrm', url: 'https://cdn.scenario/normal.png', metadata: { type: 'normal-map' } } } };
    if (method === 'GET' && url.includes('/assets/a-rgh')) return { body: { asset: { id: 'a-rgh', url: 'https://cdn.scenario/rough.png', metadata: { type: 'roughness' } } } };
    return { body: {} };
  });
}

describe('classifyPbrMap', () => {
  it('buckets common Scenario map type strings', () => {
    expect(classifyPbrMap('albedo')).toBe('albedo');
    expect(classifyPbrMap('basecolor')).toBe('albedo');
    expect(classifyPbrMap('normal-map')).toBe('normal');
    expect(classifyPbrMap('roughness')).toBe('roughness');
    expect(classifyPbrMap('metallic')).toBe('metallic');
    expect(classifyPbrMap('height/displacement')).toBe('height');
    expect(classifyPbrMap('ambient occlusion')).toBe('ao');
    expect(classifyPbrMap('mystery')).toBe('unknown');
  });
});

describe('generateTexture', () => {
  it('uses Basic auth (base64 key:secret)', async () => {
    const { calls } = installTextureFlow();
    await generateTexture({ prompt: 'dungeon stone', pollIntervalMs: 1 });
    const post = calls.find((c) => c.method === 'POST');
    const expected = 'Basic ' + Buffer.from('key123:secret456').toString('base64');
    expect(post!.auth).toBe(expected);
  });

  it('POSTs the prompt + opts to /generate/txt2img-texture', async () => {
    const { calls } = installTextureFlow();
    await generateTexture({ prompt: 'dungeon stone', modelId: 'flux.1', width: 1024, height: 1024, pollIntervalMs: 1 });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generate/txt2img-texture'));
    expect(post!.url).toBe(`${BASE}/generate/txt2img-texture`);
    expect(post!.body).toMatchObject({ prompt: 'dungeon stone', modelId: 'flux.1', width: 1024, height: 1024 });
  });

  it('polls the job then resolves + classifies the PBR map assets', async () => {
    await generateTexture({ prompt: 'stone', pollIntervalMs: 1 }).then((res) => {
      expect(res.jobId).toBe('job-1');
      expect(res.albedoUrl).toBe('https://cdn.scenario/albedo.png');
      expect(res.normalUrl).toBe('https://cdn.scenario/normal.png');
      expect(res.roughnessUrl).toBe('https://cdn.scenario/rough.png');
      expect(res.maps).toHaveLength(3);
      expect(res.maps.find((m) => m.type === 'normal')!.assetId).toBe('a-nrm');
    });
  });

  it('throws when the job fails', async () => {
    installFetch((url, method) => {
      if (method === 'POST') return { body: { job: { jobId: 'job-x', status: 'queued' } } };
      if (url.includes('/jobs/job-x')) return { body: { job: { jobId: 'job-x', status: 'failure' } } };
      return { body: {} };
    });
    await expect(generateTexture({ prompt: 'x', pollIntervalMs: 1 })).rejects.toThrow(/fail/i);
  });

  it('throws a clear error when the API key is missing', async () => {
    delete process.env.SCENARIO_API_KEY;
    await expect(generateTexture({ prompt: 'x', pollIntervalMs: 1 })).rejects.toThrow(/SCENARIO_API_KEY/);
  });
});
