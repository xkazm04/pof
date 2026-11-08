/**
 * A submit no runner can start must be refused BEFORE the Tier-0 input gate: that gate is a
 * paid vision call, and it used to run first, so an unknown provider or a mode the provider
 * cannot serve still spent one call to reach a refusal that needed none.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { gateInputImage } = vi.hoisted(() => ({ gateInputImage: vi.fn() }));
vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ startTriposrJob: vi.fn(() => 'job-1') }));
vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ startHunyuanJob: vi.fn(() => 'job-2') }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ startTripoJob: vi.fn(() => 'job-3') }));
vi.mock('@/lib/visual-gen/input-gate', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/input-gate')>()),
  gateInputImage,
}));

const { POST } = await import('@/app/api/visual-gen/generate/route');

const PNG = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;
const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/visual-gen/generate', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  gateInputImage.mockResolvedValue({ ok: true, verdict: 'pass', score: 80, reasons: [], raw: 'SCORE=8', thresholdsFrom: 'default' });
});

describe('POST /api/visual-gen/generate — refusal order', () => {
  it('an unknown provider is refused without a vision call', async () => {
    const res = await post({ mode: 'image-to-3d', providerId: 'no-such-runner', imageDataUrl: PNG });
    expect(res.status).toBe(400);
    expect(gateInputImage).not.toHaveBeenCalled();
  });

  it('[guard] a startable image-to-3d submit still passes through the gate', async () => {
    const res = await post({ mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG });
    expect(res.status).toBe(202);
    expect(gateInputImage).toHaveBeenCalledTimes(1);
  });
});
