import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Call-site guard for the per-class generation strategy.
 *
 * `generationPlanFor` is a data table, and a data table is inert unless the wired route
 * reads it: this route previously handed EVERY class its budget as Tripo `face_limit`,
 * including the bake-quality classes the `ai-lowpoly-generation-not-final` rule says
 * must be generated dense and finished afterwards. The pure unit test cannot see that.
 * These assert the argument that actually reaches the provider.
 */

const startTripoJob = vi.fn<(...a: unknown[]) => string>(() => 'tripo-test');
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ startTripoJob: (...a: unknown[]) => startTripoJob(...a) }));
vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ startHunyuanJob: () => 'hy' }));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ startTriposrJob: () => 'tsr' }));

async function post(body: unknown) {
  const { POST } = await import('@/app/api/visual-gen/generate/route');
  const req = new Request('http://localhost/api/visual-gen/generate', { method: 'POST', body: JSON.stringify(body) });
  return POST(req as never);
}

const textJob = (assetClass: string) =>
  post({ mode: 'text-to-3d', providerId: 'tripo3d', prompt: 'a stone cottage', assetClass, gateInput: false });

describe('POST /api/visual-gen/generate — budget strategy reaches the provider', () => {
  beforeEach(() => startTripoJob.mockClear());

  it('sends NO face_limit for a max-then-finish class', async () => {
    await textJob('environment');
    const spec = startTripoJob.mock.calls[0][0] as { faceLimit?: number };
    expect(spec.faceLimit).toBeUndefined();
  });

  it('still sends the class budget for a budgeted class', async () => {
    await textJob('prop');
    const spec = startTripoJob.mock.calls[0][0] as { faceLimit?: number };
    expect(spec.faceLimit).toBe(10_000);
  });

  it('reports which strategy the generation used, so a deferred budget is never silent', async () => {
    const res = await textJob('environment');
    const json = (await res.json()) as { data: { generationPlan?: { strategy: string; rationale: string } } };
    expect(json.data.generationPlan?.strategy).toBe('max-then-finish');
    expect(json.data.generationPlan?.rationale).toMatch(/mesh-finish/);
  });
});
