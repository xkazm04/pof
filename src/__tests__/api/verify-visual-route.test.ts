import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockRecognize, mockRecord, mockEmit } = vi.hoisted(() => ({
  mockRecognize: vi.fn(),
  mockRecord: vi.fn(),
  mockEmit: vi.fn(),
}));

// Mocked at the CHOKEPOINT. The route no longer names an eye — it asks `@/lib/vision` for
// the `recognize` capability — so this stub stays valid whichever provider the plan puts
// first, which is the entire point of the layer.
vi.mock('@/lib/vision/router', async (orig) => ({
  ...(await orig<typeof import('@/lib/vision/router')>()),
  recognize: mockRecognize,
}));
vi.mock('@/lib/visual-verification-db', () => ({ recordVisualVerification: mockRecord }));
vi.mock('@/lib/event-bus', () => ({ eventBus: { emit: mockEmit } }));

import { POST } from '@/app/api/verify/visual/route';

// Use a real temp PNG so the route's fs reads succeed without mocking node:fs.
const realShot = join(tmpdir(), `pof-visual-${process.pid}.png`);
const missingShot = join(tmpdir(), `pof-visual-${process.pid}-missing.png`);

beforeAll(() => writeFileSync(realShot, Buffer.from('fake-png-bytes')));
afterAll(() => { try { rmSync(realShot); } catch { /* noop */ } });

function req(body: unknown): Request {
  return new Request('http://localhost/api/verify/visual', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** The routed answer shape the chokepoint returns. */
function visionReturns(verdict: unknown, over: Record<string, unknown> = {}) {
  mockRecognize.mockResolvedValueOnce({
    text: JSON.stringify(verdict),
    model: 'gemini-3.8-flash',
    attribution: 'answered',
    fellBackFrom: [],
    provider: 'gemini',
    trail: [],
    effortServed: 'medium',
    effortDowngraded: false,
    ...over,
  });
}

const validBody = { moduleId: 'arpg-ui', itemId: 'au-1', screenshotPath: realShot, projectPath: 'C:\\proj' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
});

describe('POST /api/verify/visual', () => {
  it('runs the Gemini check, records the verdict, emits eval.visual, returns the verdict', async () => {
    visionReturns({
      visibleElements: ['player health bar (top-left)', 'enemy bar (top-centre)'],
      anyEmptyOrZeroWidth: false,
      verdict: 'pass',
      notes: 'both bars visible',
    });

    const res = await POST(req(validBody) as never);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.verdict).toBe('pass');
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ moduleId: 'arpg-ui', itemId: 'au-1', verdict: 'pass', anyEmpty: false }),
    );
    expect(mockEmit).toHaveBeenCalledWith(
      'eval.visual',
      expect.objectContaining({ moduleId: 'arpg-ui', itemId: 'au-1', verdict: 'pass' }),
      expect.anything(),
    );
  });

  it('records a fail verdict when Gemini reports an empty element', async () => {
    visionReturns({
      visibleElements: ['empty bar (top-left)'],
      anyEmptyOrZeroWidth: true,
      verdict: 'fail',
      notes: 'top-left bar reads as empty / zero-width',
    });

    const res = await POST(req(validBody) as never);
    const json = await res.json();
    expect(json.data.verdict).toBe('fail');
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'fail', anyEmpty: true }));
  });

  it('returns 404 when the screenshot file is missing', async () => {
    const res = await POST(req({ ...validBody, screenshotPath: missingShot }) as never);
    expect(res.status).toBe(404);
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('returns 503 NAMING every eye that dropped out when no provider can serve', async () => {
    // The no-key case is now the ROUTER's finding, not the route's: an operator gets the
    // whole trail ("ollama: not-configured; gemini: not-configured") instead of one env var
    // name that may not even be the eye the plan wanted.
    mockRecognize.mockRejectedValueOnce(
      new Error('no vision provider could serve this request — ollama: not-configured; gemini: not-configured'),
    );
    const res = await POST(req(validBody) as never);
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error).toMatch(/ollama: not-configured; gemini: not-configured/);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await POST(req({ moduleId: 'arpg-ui' }) as never);
    expect(res.status).toBe(400);
  });

  describe('mode=texture (seamless/tileable check)', () => {
    const texBody = { mode: 'texture', moduleId: 'materials', itemId: 'tm-floor', screenshotPath: realShot };

    it('passes a seamless texture: verdict pass, anyEmpty false, issues recorded as elements', async () => {
      visionReturns({ tileable: true, issues: [], verdict: 'pass', notes: 'no visible seam' });
      const res = await POST(req(texBody) as never);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.verdict).toBe('pass');
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'materials', itemId: 'tm-floor', verdict: 'pass', anyEmpty: false }),
      );
    });

    it('fails a non-tileable texture: a seam maps to a recorded defect (anyEmpty true)', async () => {
      visionReturns({ tileable: false, issues: ['visible vertical seam', 'baked lighting top-left'], verdict: 'fail', notes: 'seam' });
      const res = await POST(req(texBody) as never);
      const json = await res.json();
      expect(json.data.verdict).toBe('fail');
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({ verdict: 'fail', anyEmpty: true, elements: ['visible vertical seam', 'baked lighting top-left'] }),
      );
    });

    it('uses a texture-specific prompt (mentions seamless/tileable, not HUD bars)', async () => {
      visionReturns({ tileable: true, issues: [], verdict: 'pass', notes: '' });
      await POST(req(texBody) as never);
      // Read from the CHOKEPOINT's request, not a vendor SDK's payload — the assertion
      // (this mode sends its own prompt) is unchanged; only where the prompt is observed.
      const sent = mockRecognize.mock.calls[0][0];
      const promptText = JSON.stringify(sent.prompt);
      expect(promptText.toLowerCase()).toContain('seamless');
      expect(promptText.toLowerCase()).toContain('tileable');
    });
  });
});

describe('POST /api/verify/visual — effort is a request parameter, and provenance comes back', () => {
  it('passes the requested effort through the chokepoint', async () => {
    visionReturns({ visibleElements: [], anyEmptyOrZeroWidth: false, verdict: 'pass', notes: '' }, { effortServed: 'high' });
    await POST(req({ ...validBody, effort: 'high' }) as never);
    expect(mockRecognize).toHaveBeenCalledWith(
      expect.objectContaining({ effort: 'high' }),
      expect.anything(),
    );
  });

  it('rejects an effort level the vocabulary does not contain, rather than silently defaulting', async () => {
    const res = await POST(req({ ...validBody, effort: 'ultra' }) as never);
    expect(res.status).toBe(400);
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('returns WHICH eye and WHICH effort actually served, beside the verdict', async () => {
    visionReturns(
      { visibleElements: ['bar'], anyEmptyOrZeroWidth: false, verdict: 'pass', notes: '' },
      { provider: 'ollama', model: 'qwen3.8:27b', effortServed: 'low', effortDowngraded: true,
        trail: [{ provider: 'gemini', kind: 'not-configured', detail: 'gemini is not configured on this machine' }] },
    );
    const res = await POST(req({ ...validBody, effort: 'medium' }) as never);
    const json = await res.json();
    expect(json.data.verdict).toBe('pass');
    expect(json.data.provenance).toEqual({
      provider: 'ollama',
      model: 'qwen3.8:27b',
      effortRequested: 'medium',
      effortServed: 'low',
      effortDowngraded: true,
      trail: [{ provider: 'gemini', kind: 'not-configured', detail: 'gemini is not configured on this machine' }],
    });
  });
});
