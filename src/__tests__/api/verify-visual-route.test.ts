import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockGenerate, mockRecord, mockEmit } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockRecord: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerate };
  },
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

function geminiReturns(verdict: unknown) {
  mockGenerate.mockResolvedValueOnce({
    candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }],
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
    geminiReturns({
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
    geminiReturns({
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
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('returns 503 when no Gemini key is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(req(validBody) as never);
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error).toMatch(/GEMINI_API_KEY/);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await POST(req({ moduleId: 'arpg-ui' }) as never);
    expect(res.status).toBe(400);
  });

  describe('mode=texture (seamless/tileable check)', () => {
    const texBody = { mode: 'texture', moduleId: 'materials', itemId: 'tm-floor', screenshotPath: realShot };

    it('passes a seamless texture: verdict pass, anyEmpty false, issues recorded as elements', async () => {
      geminiReturns({ tileable: true, issues: [], verdict: 'pass', notes: 'no visible seam' });
      const res = await POST(req(texBody) as never);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.verdict).toBe('pass');
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'materials', itemId: 'tm-floor', verdict: 'pass', anyEmpty: false }),
      );
    });

    it('fails a non-tileable texture: a seam maps to a recorded defect (anyEmpty true)', async () => {
      geminiReturns({ tileable: false, issues: ['visible vertical seam', 'baked lighting top-left'], verdict: 'fail', notes: 'seam' });
      const res = await POST(req(texBody) as never);
      const json = await res.json();
      expect(json.data.verdict).toBe('fail');
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({ verdict: 'fail', anyEmpty: true, elements: ['visible vertical seam', 'baked lighting top-left'] }),
      );
    });

    it('uses a texture-specific prompt (mentions seamless/tileable, not HUD bars)', async () => {
      geminiReturns({ tileable: true, issues: [], verdict: 'pass', notes: '' });
      await POST(req(texBody) as never);
      const sent = mockGenerate.mock.calls[0][0];
      const promptText = JSON.stringify(sent);
      expect(promptText.toLowerCase()).toContain('seamless');
      expect(promptText.toLowerCase()).toContain('tileable');
    });
  });
});
