/**
 * The Tier-0 INPUT gate, wired into the paid path.
 *
 * `gateInputImage` used to have ZERO callers: the forge posted the raw image straight to
 * /api/visual-gen/generate, and the lib's own header claimed "a bad input caught here
 * saves the generation credits" — a saving that was never realized on the path it named.
 *
 * These tests pin the two halves of the fix that actually matter:
 *  - a FAILING input is refused with its reason BEFORE any provider job is started
 *    (the credit saving is real, asserted against the `start*Job` spies);
 *  - a gate that CANNOT RUN is reported as unavailable and the image proceeds stamped as
 *    ungated — never silently waved through, and never used to condemn an image nothing
 *    measured (the same rule wave 12 gave the mesh critique).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type StartJob = (opts: unknown) => string;
const startTriposrJob = vi.fn<StartJob>();
const startHunyuanJob = vi.fn<StartJob>();
const startTripoJob = vi.fn<StartJob>();

vi.mock('@/lib/visual-gen/triposr-job-store', () => ({ startTriposrJob: (a: unknown) => startTriposrJob(a) }));
vi.mock('@/lib/visual-gen/hunyuan-job-store', () => ({ startHunyuanJob: (a: unknown) => startHunyuanJob(a) }));
vi.mock('@/lib/visual-gen/tripo-job-store', () => ({ startTripoJob: (a: unknown) => startTripoJob(a) }));

const gateInputImage = vi.fn();
vi.mock('@/lib/visual-gen/input-gate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/visual-gen/input-gate')>();
  return { ...actual, gateInputImage: (...args: unknown[]) => gateInputImage(...args) };
});

import { POST } from '@/app/api/visual-gen/generate/route';
import {
  summarizeInputGate,
  inputGateRefusal,
  inputGateUnavailable,
  inputGateSkipped,
  inputGateOverridden,
} from '@/lib/visual-gen/input-gate';
import { NextRequest } from 'next/server';

const PNG = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/visual-gen/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
const started = () =>
  startTriposrJob.mock.calls.length + startHunyuanJob.mock.calls.length + startTripoJob.mock.calls.length;

const card = (verdict: 'pass' | 'warn' | 'fail', score: number, reasons: string[] = []) => ({
  ok: true as const, verdict, score, reasons, raw: `SCORE=${score / 10}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  startTriposrJob.mockReturnValue('job-triposr');
  startHunyuanJob.mockReturnValue('job-hunyuan');
  startTripoJob.mockReturnValue('job-tripo');
  gateInputImage.mockResolvedValue(card('pass', 80));
});

// ---------------------------------------------------------------------------
// The pure decision layer
// ---------------------------------------------------------------------------

describe('input-gate outcome vocabulary', () => {
  it('a fail is the ONLY outcome that refuses', () => {
    expect(inputGateRefusal(summarizeInputGate(card('fail', 30, ['two subjects'])))).toMatch(/two subjects/);
    expect(inputGateRefusal(summarizeInputGate(card('warn', 60)))).toBeNull();
    expect(inputGateRefusal(summarizeInputGate(card('pass', 90)))).toBeNull();
  });

  it('an unavailable gate reports the reason and CANNOT refuse — it measured nothing', () => {
    const out = summarizeInputGate({ ok: false, error: 'QWEN_API_KEY not set' });
    expect(out.ran).toBe(false);
    expect(out).toMatchObject({ unavailable: true });
    expect(out.note).toContain('QWEN_API_KEY not set');
    expect(out.note).toMatch(/ungated/);
    expect(inputGateRefusal(out)).toBeNull();
  });

  it('a skip is stated, and is not the same word as unavailable', () => {
    expect(inputGateSkipped().note).toMatch(/skipped/);
    expect(inputGateSkipped().note).not.toMatch(/unavailable/);
    expect(inputGateUnavailable('no key').note).toMatch(/unavailable/);
  });

  it('an override keeps the failing verdict visible instead of rewriting it to a pass', () => {
    const out = inputGateOverridden(summarizeInputGate(card('fail', 20, ['cropped'])));
    expect(out).toMatchObject({ ran: true, verdict: 'fail', overridden: true });
    expect(out.note).toMatch(/cropped/);
    expect(out.note).toMatch(/OVERRIDDEN/);
  });
});

// ---------------------------------------------------------------------------
// The wiring: refusal happens BEFORE the provider call
// ---------------------------------------------------------------------------

describe('POST /api/visual-gen/generate — Tier-0 input gate', () => {
  it('refuses a failing input with its reason and starts NO provider job', async () => {
    gateInputImage.mockResolvedValue(card('fail', 20, ['two subjects in frame', 'heavy motion blur']));
    const res = await POST(req({ mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('two subjects in frame');
    expect(json.error).toMatch(/no generation was spent/i);
    // The credit saving, asserted rather than claimed.
    expect(started()).toBe(0);
  });

  it('the gate runs BEFORE the job starts (ordering, not just outcome)', async () => {
    const order: string[] = [];
    gateInputImage.mockImplementation(async () => { order.push('gate'); return card('pass', 90); });
    startTripoJob.mockImplementation(() => { order.push('job'); return 'job-tripo'; });

    await POST(req({ mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG }));
    expect(order).toEqual(['gate', 'job']);
  });

  it('a passing input generates and the 202 carries the verdict', async () => {
    const res = await POST(req({ mode: 'image-to-3d', providerId: 'triposr', imageDataUrl: PNG }));
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(json.data.jobId).toBe('job-triposr');
    expect(json.data.inputGate).toMatchObject({ ran: true, verdict: 'pass' });
    expect(json.data.inputGate.note).toMatch(/input gate PASS/);
  });

  it('a WARN generates — warn-first, as the route documents — and says so', async () => {
    gateInputImage.mockResolvedValue(card('warn', 60, ['background is busy']));
    const res = await POST(req({ mode: 'image-to-3d', providerId: 'hunyuan3d', imageDataUrl: PNG }));
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(startHunyuanJob).toHaveBeenCalledTimes(1);
    expect(json.data.inputGate.note).toMatch(/WARN.*background is busy/);
  });

  it('a gate that cannot run is REPORTED, not silently skipped, and the job still starts', async () => {
    gateInputImage.mockResolvedValue({ ok: false, error: 'QWEN_API_KEY not set' });
    const res = await POST(req({ mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG }));
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(startTripoJob).toHaveBeenCalledTimes(1);
    expect(json.data.inputGate).toMatchObject({ ran: false, unavailable: true });
    expect(json.data.inputGate.note).toContain('QWEN_API_KEY not set');
    expect(json.data.inputGate.note).toMatch(/ungated/);
  });

  it('a vision failure never masquerades as a verdict that could refuse', async () => {
    gateInputImage.mockResolvedValue({ ok: false, error: 'DashScope 500' });
    const res = await POST(req({ mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG }));
    expect(res.status).toBe(202);
    expect(started()).toBe(1);
  });

  it('overrideInputGate generates through a fail, with the fail still on the record', async () => {
    gateInputImage.mockResolvedValue(card('fail', 20, ['cropped subject']));
    const res = await POST(req({
      mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG, overrideInputGate: true,
    }));
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(json.data.inputGate).toMatchObject({ verdict: 'fail', overridden: true });
    expect(json.data.inputGate.note).toMatch(/cropped subject/);
  });

  it('gateInput:false opts out — stated on the 202, and no vision call is made', async () => {
    const res = await POST(req({
      mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG, gateInput: false,
    }));
    const json = await res.json();

    expect(gateInputImage).not.toHaveBeenCalled();
    expect(json.data.inputGate.note).toMatch(/skipped/);
    expect(started()).toBe(1);
  });

  it('text-to-3d is not gated — there is no input image to check', async () => {
    const res = await POST(req({ mode: 'text-to-3d', providerId: 'tripo3d', prompt: 'a battle axe' }));
    const json = await res.json();

    expect(gateInputImage).not.toHaveBeenCalled();
    expect(json.data.inputGate).toBeUndefined();
    expect(startTripoJob).toHaveBeenCalledTimes(1);
  });

  it('the gate is told the subject, capped so a style-laden prompt is not resent whole', async () => {
    await POST(req({
      mode: 'image-to-3d', providerId: 'tripo3d', imageDataUrl: PNG, prompt: 'a battle axe. ' + 'x'.repeat(500),
    }));
    const deps = gateInputImage.mock.calls[0][1] as { subject?: string };
    expect(deps.subject?.startsWith('a battle axe')).toBe(true);
    expect(deps.subject!.length).toBeLessThanOrEqual(120);
  });
});
