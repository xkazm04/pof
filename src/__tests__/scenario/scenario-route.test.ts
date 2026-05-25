import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scenario', () => ({
  generateTexture: vi.fn(async () => ({
    jobId: 'job-1',
    maps: [{ assetId: 'a', url: 'https://cdn/albedo.png', type: 'albedo' }],
    albedoUrl: 'https://cdn/albedo.png',
    normalUrl: 'https://cdn/normal.png',
    roughnessUrl: 'https://cdn/rough.png',
  })),
}));

vi.mock('@/lib/visual-gen/seam-check', () => ({
  detectSeamsFromUrl: vi.fn(async () => ({
    horizontal: { axis: 'left', delta: 0.3, seam: true },
    vertical: { axis: 'top', delta: 0.01, seam: false },
    hasSeam: true,
    threshold: 0.08,
    worstEdge: 'left edge',
  })),
}));

import { POST } from '@/app/api/scenario/route';
import * as scenario from '@/lib/scenario';
import { detectSeamsFromUrl } from '@/lib/visual-gen/seam-check';

function req(body: unknown): Request {
  return new Request('http://localhost/api/scenario', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => { process.env.SCENARIO_API_KEY = 'k'; process.env.SCENARIO_API_SECRET = 's'; vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/scenario', () => {
  it('generates a PBR set from a prompt', async () => {
    const res = await POST(req({ prompt: 'dungeon stone', modelId: 'flux.1' }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.albedoUrl).toBe('https://cdn/albedo.png');
    expect(json.data.normalUrl).toBe('https://cdn/normal.png');
    expect(scenario.generateTexture).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'dungeon stone', modelId: 'flux.1' }),
    );
  });

  it('attaches a seam check run on the generated albedo', async () => {
    const res = await POST(req({ prompt: 'dungeon stone' }));
    const json = await res.json();
    expect(detectSeamsFromUrl).toHaveBeenCalledWith('https://cdn/albedo.png');
    expect(json.data.seam).toMatchObject({ hasSeam: true, worstEdge: 'left edge' });
  });

  it('rejects a missing prompt', async () => {
    const res = await POST(req({ modelId: 'flux.1' }));
    expect(res.status).toBe(400);
  });

  it('errors clearly when the Scenario key is not configured', async () => {
    delete process.env.SCENARIO_API_KEY;
    const res = await POST(req({ prompt: 'stone' }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.error).toMatch(/SCENARIO_API_KEY/);
  });
});
