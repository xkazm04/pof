/**
 * Direction 2 — "experiment visual verification actually runs".
 *
 * **This is the joint, not each half.** Both halves were individually green for the whole life
 * of the bug: the runner's test injected a fake `verifyVisual`, and the route's test posted a
 * correct payload. Nobody ever drove the REAL `postVerifyVisual` seam against the REAL route
 * handler — so nobody saw that the seam omitted `moduleId`/`itemId`, took the route's 400, and
 * returned its own literal `{ status: 'fail', detail: 'verify call failed' }`. Every visual
 * verification the Experiment Lab ever produced was a fabricated fail.
 *
 * Only the vision model is mocked. `fetchImpl` hands the seam's real Request straight to the
 * real route handler, so a payload contract mismatch between them CANNOT hide again.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockRecognize, mockRecord, mockEmit } = vi.hoisted(() => ({
  mockRecognize: vi.fn(),
  mockRecord: vi.fn(),
  mockEmit: vi.fn(),
}));

// Mocked at the CHOKEPOINT: the route asks `@/lib/vision` for the `recognize` capability
// and the plan picks the eye, so a vendor-SDK mock no longer intercepts anything.
vi.mock('@/lib/vision/router', async (orig) => ({
  ...(await orig<typeof import('@/lib/vision/router')>()),
  recognize: mockRecognize,
}));
vi.mock('@/lib/visual-verification-db', () => ({ recordVisualVerification: mockRecord }));
vi.mock('@/lib/event-bus', () => ({ eventBus: { emit: mockEmit } }));

import { POST } from '@/app/api/verify/visual/route';
import { postVerifyVisual, EXPERIMENT_MODULE_ID } from '@/lib/ue-experiment/runner';

const shot = join(tmpdir(), `pof-exp-joint-${process.pid}.png`);
const missingShot = join(tmpdir(), `pof-exp-joint-${process.pid}-gone.png`);

beforeAll(() => writeFileSync(shot, Buffer.from('fake-png-bytes')));
afterAll(() => { try { rmSync(shot); } catch { /* noop */ } });

/** The REAL route handler, reached through a fetch-shaped seam. Nothing between them is faked. */
const routeFetch: typeof fetch = async (url, init) =>
  POST(new Request(String(url), init as RequestInit) as never) as unknown as Response;

const ENV = { POF_APP_ORIGIN: 'http://127.0.0.1:3001' };

function geminiReturns(verdict: unknown) {
  mockRecognize.mockResolvedValueOnce({
    text: JSON.stringify(verdict), model: 'gemini-3.8-flash', attribution: 'answered',
    fellBackFrom: [], provider: 'gemini', trail: [], effortDowngraded: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
});
afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
});

describe('postVerifyVisual ↔ /api/verify/visual (the joint)', () => {
  it('a passing judge produces a pass — the call actually reaches the model', async () => {
    geminiReturns({ humanoidVisible: true, tPosed: false, distinct: true, verdict: 'pass', notes: 'idle pose' });
    const verdict = await postVerifyVisual(ENV, 'exp-1', routeFetch)(shot, 'character');
    expect(mockRecognize).toHaveBeenCalledTimes(1);
    expect(verdict.status).toBe('pass');
    expect(verdict.detail).toMatch(/idle pose/);
  });

  it('files the verdict under the experiment identity so it is in the eval trail', async () => {
    geminiReturns({ humanoidVisible: true, tPosed: false, distinct: true, verdict: 'pass', notes: '' });
    await postVerifyVisual(ENV, 'exp-42', routeFetch)(shot, 'character');
    // listVisualVerifications('experiment') can now find it — the Lab used to write NOTHING here.
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ moduleId: EXPERIMENT_MODULE_ID, itemId: 'exp-42', verdict: 'pass' }),
    );
  });

  it('an observed defect is a real fail (deferred must not swallow genuine failures)', async () => {
    geminiReturns({ humanoidVisible: true, tPosed: true, distinct: true, verdict: 'fail', notes: 'T-posed' });
    const verdict = await postVerifyVisual(ENV, 'exp-2', routeFetch)(shot, 'character');
    expect(verdict.status).toBe('fail');
    expect(verdict.detail).toMatch(/T-posed/);
  });

  it('honours the chosen mode end-to-end — the route runs THAT check, not always character', async () => {
    geminiReturns({ lit: true, shadowed: true, verdict: 'pass', notes: 'scene lit' });
    const verdict = await postVerifyVisual(ENV, 'exp-3', routeFetch)(shot, 'lighting');
    const promptText = JSON.stringify(mockRecognize.mock.calls[0][0].prompt).toLowerCase();
    expect(promptText).toContain('un-lit');
    expect(promptText).not.toContain('t-pose');
    expect(verdict.detail).toMatch(/^visual lighting:/);
  });

  it('NO CONFIGURED EYE is DEFERRED naming every eye that dropped out, never a fail', async () => {
    // Was "a missing judge key ... /GEMINI_API_KEY/". Since the route went through the
    // vision chokepoint the unavailability is the ROUTER's finding, so the reason names the
    // whole trail rather than one env var — strictly more actionable, and it no longer
    // implies Gemini is the only eye that could have served.
    mockRecognize.mockRejectedValueOnce(
      new Error('no vision provider could serve this request — ollama: not-configured; gemini: not-configured'),
    );
    const verdict = await postVerifyVisual(ENV, 'exp-4', routeFetch)(shot, 'character');
    expect(verdict.status).toBe('deferred');
    expect(verdict.detail).toMatch(/ollama: not-configured; gemini: not-configured/);
    expect(verdict.detail).toContain(shot);
  });

  it('a judge API error is DEFERRED with the reason', async () => {
    mockRecognize.mockRejectedValueOnce(new Error('502 upstream exploded'));
    const verdict = await postVerifyVisual(ENV, 'exp-5', routeFetch)(shot, 'character');
    expect(verdict.status).toBe('deferred');
    expect(verdict.detail).toMatch(/upstream exploded/);
  });

  it('an unparseable judge reply is DEFERRED, not a fail', async () => {
    mockRecognize.mockResolvedValueOnce({
    text: 'not json at all', model: 'm', attribution: 'answered', fellBackFrom: [],
    provider: 'gemini', trail: [], effortDowngraded: false,
  });
    const verdict = await postVerifyVisual(ENV, 'exp-6', routeFetch)(shot, 'character');
    expect(verdict.status).toBe('deferred');
  });

  it('a 404 (frame gone before the judge read it) is DEFERRED with the reason', async () => {
    const verdict = await postVerifyVisual(ENV, 'exp-7', routeFetch)(missingShot, 'character');
    expect(verdict.status).toBe('deferred');
    expect(verdict.detail).toMatch(/Screenshot not found/);
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('a transport failure is DEFERRED with the reason', async () => {
    const dead: typeof fetch = async () => { throw new Error('ECONNREFUSED'); };
    const verdict = await postVerifyVisual(ENV, 'exp-8', dead)(shot, 'character');
    expect(verdict.status).toBe('deferred');
    expect(verdict.detail).toMatch(/ECONNREFUSED/);
  });

  it('sends every field the route requires (the omission that broke it)', async () => {
    geminiReturns({ humanoidVisible: true, tPosed: false, distinct: true, verdict: 'pass', notes: '' });
    const seen: unknown[] = [];
    const spyFetch: typeof fetch = async (url, init) => {
      seen.push(JSON.parse(String((init as RequestInit).body)));
      return routeFetch(url, init);
    };
    await postVerifyVisual(ENV, 'exp-9', spyFetch)(shot, 'texture');
    expect(seen[0]).toEqual({
      moduleId: EXPERIMENT_MODULE_ID,
      itemId: 'exp-9',
      screenshotPath: shot,
      mode: 'texture',
    });
  });
});
