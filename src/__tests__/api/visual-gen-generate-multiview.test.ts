import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wiring guard for multiview dispatch on the generate route.
 *
 * `tripo-runner` gained a `multiview-to-3d` mode, but a mode no route can request is a
 * capability that does not exist (the standing "consumer census" lesson — a module is
 * delivered when a production file reaches it, not when its unit tests go green). This
 * test asserts the route decodes the supplied view images and threads them into the job
 * spec as `views`, positionally.
 */

const startTripoJob = vi.fn<(...a: unknown[]) => string>(() => 'tripo-mv-test');

vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ startHunyuanJob: () => 'hy' }));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ startTriposrJob: () => 'tsr' }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ startTripoJob: (...a: unknown[]) => startTripoJob(...a) }));

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

type ViewSpec = { views?: Record<string, { path?: string } | undefined> };

describe('POST /api/visual-gen/generate — multiview dispatch', () => {
  beforeEach(() => startTripoJob.mockClear());

  it('threads every supplied view into the Tripo job spec as a decoded local path', async () => {
    const res = await post({
      mode: 'multiview-to-3d',
      providerId: 'tripo3d',
      viewDataUrls: { front: PNG_1X1, left: PNG_1X1, back: PNG_1X1, right: PNG_1X1 },
      assetClass: 'character',
      gateInput: false,
    });

    expect(res.status).toBe(202);
    expect(startTripoJob).toHaveBeenCalledTimes(1);
    const spec = startTripoJob.mock.calls[0][0] as ViewSpec & { mode?: string };
    expect(spec.mode).toBe('multiview-to-3d');
    for (const slot of ['front', 'left', 'back', 'right']) {
      expect(spec.views?.[slot]?.path, `${slot} view`).toMatch(/\.png$/);
    }
    // Distinct files per slot — writing all four views to one temp path would silently
    // generate from a single view while reporting a multiview run.
    const paths = ['front', 'left', 'back', 'right'].map((s) => spec.views?.[s]?.path);
    expect(new Set(paths).size).toBe(4);
  });

  it('omits the slots that were not supplied', async () => {
    await post({
      mode: 'multiview-to-3d',
      providerId: 'tripo3d',
      viewDataUrls: { front: PNG_1X1, back: PNG_1X1 },
      gateInput: false,
    });
    const spec = startTripoJob.mock.calls[0][0] as ViewSpec;
    expect(spec.views?.front?.path).toBeTruthy();
    expect(spec.views?.back?.path).toBeTruthy();
    expect(spec.views?.left).toBeUndefined();
    expect(spec.views?.right).toBeUndefined();
  });

  it('rejects a multiview request with no front view', async () => {
    const res = await post({
      mode: 'multiview-to-3d',
      providerId: 'tripo3d',
      viewDataUrls: { left: PNG_1X1 },
      gateInput: false,
    });
    expect(res.status).toBe(400);
    expect(startTripoJob).not.toHaveBeenCalled();
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/front/i);
  });

  it('refuses multiview on the local providers, which take a single image', async () => {
    const res = await post({
      mode: 'multiview-to-3d',
      providerId: 'triposr',
      viewDataUrls: { front: PNG_1X1 },
      gateInput: false,
    });
    expect(res.status).toBe(400);
  });
});
