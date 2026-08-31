/**
 * The shape route, wired into the PAID path.
 *
 * `routeShape` decided — correctly, and with a live-graded artifact behind it — that a
 * rope must never be sent to a 3D generator. It then shipped with ZERO production
 * importers, so every rope prompt still reached Tripo and still bought back a ~1 m blob.
 * These tests pin the two halves that make the decision real:
 *
 *  - a prompt that IS a linear prop is refused BEFORE any `start*Job` call (asserted
 *    against the job spies, so the credit saving is a fact rather than a claim), and the
 *    refusal names the endpoint that computes it instead;
 *  - a prompt that merely MENTIONS one still generates, carrying an advisory — because
 *    refusing "a pirate captain holding a coiled rope" over a single word would be the
 *    gate's worst failure, and a gate that over-refuses gets turned off.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type StartJob = (opts: unknown) => string;
const startTriposrJob = vi.fn<StartJob>();
const startHunyuanJob = vi.fn<StartJob>();
const startTripoJob = vi.fn<StartJob>();

vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ startTriposrJob: (a: unknown) => startTriposrJob(a) }));
vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ startHunyuanJob: (a: unknown) => startHunyuanJob(a) }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ startTripoJob: (a: unknown) => startTripoJob(a) }));

import { POST } from '@/app/api/visual-gen/generate/route';

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/visual-gen/generate', { method: 'POST', body: JSON.stringify(body) });

const started = () =>
  startTripoJob.mock.calls.length + startTriposrJob.mock.calls.length + startHunyuanJob.mock.calls.length;

beforeEach(() => {
  startTripoJob.mockReset().mockReturnValue('job-1');
  startTriposrJob.mockReset().mockReturnValue('job-1');
  startHunyuanJob.mockReset().mockReturnValue('job-1');
});

describe('shape route on /api/visual-gen/generate', () => {
  it('refuses a rope before spending a provider call, and names the alternative', async () => {
    const res = await POST(req({ mode: 'text-to-3d', providerId: 'tripo3d', prompt: 'a coiled rope' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(started()).toBe(0);
    expect(body.error).toContain('/api/visual-gen/linear-prop');
    expect(body.error).toContain('overrideShapeRoute');
  });

  it('generates anyway when the caller overrides, and says the route was overridden', async () => {
    const res = await POST(
      req({ mode: 'text-to-3d', providerId: 'tripo3d', prompt: 'a coiled rope', overrideShapeRoute: true }),
    );
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(started()).toBe(1);
    expect(body.data.shapeRoute.overridden).toBe(true);
  });

  it('generates a subject that merely mentions a rope, with an advisory attached', async () => {
    const res = await POST(
      req({
        mode: 'text-to-3d',
        providerId: 'tripo3d',
        prompt: 'a grizzled pirate captain in a long coat holding a coiled rope',
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(started()).toBe(1);
    expect(body.data.shapeRoute.route).toBe('advise');
    expect(body.data.shapeRoute.keyword).toBe('rope');
  });

  it('says nothing at all about a subject with no linear part', async () => {
    const res = await POST(
      req({ mode: 'text-to-3d', providerId: 'tripo3d', prompt: 'a wooden treasure chest' }),
    );
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(started()).toBe(1);
    // No noise on the happy path — the field is absent, not a "route: generate" stamp.
    expect(body.data.shapeRoute).toBeUndefined();
  });

  it('applies to the image-to-3d path too, where the prompt is the subject hint', async () => {
    const res = await POST(
      req({
        mode: 'image-to-3d',
        providerId: 'tripo3d',
        prompt: 'a rope',
        imageDataUrl: `data:image/png;base64,${Buffer.from('x').toString('base64')}`,
        gateInput: false,
      }),
    );
    expect(res.status).toBe(400);
    expect(started()).toBe(0);
  });
});
