import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wiring guard for the model pin on the generate route.
 *
 * The pure `hunyuanModelFor` unit test cannot see whether anything CALLS it — and a
 * resolver with no caller is the exact no-op this repo has shipped before (the
 * "the wiring IS the finding" lesson). This test asserts the route actually threads a
 * stated model into the job spec, which is the half that changes real generations.
 *
 * The Tier-0 input gate is opted out (`gateInput: false`) so the test exercises the
 * dispatch wiring rather than the VLM seam.
 */

const startHunyuanJob = vi.fn<(...a: unknown[]) => string>(() => 'hy3d-test');
const startTriposrJob = vi.fn<(...a: unknown[]) => string>(() => 'tsr-test');
const startTripoJob = vi.fn<(...a: unknown[]) => string>(() => 'tripo-test');

vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ startHunyuanJob: (...a: unknown[]) => startHunyuanJob(...a) }));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ startTriposrJob: (...a: unknown[]) => startTriposrJob(...a) }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ startTripoJob: (...a: unknown[]) => startTripoJob(...a) }));

// A 1x1 PNG — enough for `parseImageDataUrl` to accept and write a temp file.
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function post(body: unknown) {
  const { POST } = await import('@/app/api/visual-gen/generate/route');
  const req = new Request('http://localhost/api/visual-gen/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return POST(req as never);
}

describe('POST /api/visual-gen/generate — model pin wiring', () => {
  beforeEach(() => {
    startHunyuanJob.mockClear();
    startTriposrJob.mockClear();
    startTripoJob.mockClear();
  });

  it('passes a stated, non-empty model to the Hunyuan job spec', async () => {
    await post({
      mode: 'image-to-3d',
      providerId: 'hunyuan3d',
      imageDataUrl: PNG_1X1,
      assetClass: 'character',
      gateInput: false,
    });

    expect(startHunyuanJob).toHaveBeenCalledTimes(1);
    const spec = startHunyuanJob.mock.calls[0][0] as { model?: string };
    // The defect this closes: before the pin, `model` was absent here and the tier was
    // decided by an argparse default inside pof_hunyuan.py.
    expect(spec.model).toBeTruthy();
    expect(spec.model).toBe('tencent/Hunyuan3D-2');
  });

  it('states a model even when no asset class is supplied', async () => {
    await post({
      mode: 'image-to-3d',
      providerId: 'hunyuan3d',
      imageDataUrl: PNG_1X1,
      gateInput: false,
    });

    expect(startHunyuanJob).toHaveBeenCalledTimes(1);
    const spec = startHunyuanJob.mock.calls[0][0] as { model?: string };
    expect(spec.model).toBe('tencent/Hunyuan3D-2');
  });

  // TripoSR is MIT and is the commercial-safe fallback; it is a different model family
  // with no HF model id to pin, so it must NOT acquire a Hunyuan model by accident.
  it('does not leak the Hunyuan model onto the TripoSR path', async () => {
    await post({
      mode: 'image-to-3d',
      providerId: 'triposr',
      imageDataUrl: PNG_1X1,
      gateInput: false,
    });

    expect(startTriposrJob).toHaveBeenCalledTimes(1);
    const spec = startTriposrJob.mock.calls[0][0] as { model?: string };
    expect(spec.model).toBeUndefined();
  });
});
