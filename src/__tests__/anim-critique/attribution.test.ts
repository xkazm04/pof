/**
 * A critique must name the model that actually wrote it. The Qwen seam walks a
 * five-model fallback chain on any quota signal, so "provider: qwen" attributes the
 * score to a family, not a writer — and a fallback-produced score used to be
 * indistinguishable from a primary one.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeQwenVisionAttributed } from '@/lib/anim-critique/qwen';
import { critiqueAnimation } from '@/lib/anim-critique/critique';
import { UNREPORTED_MODEL, describeVisionAnswer, normalizeVisionAnswer } from '@/lib/anim-critique/vision';

const imgs = [{ base64: 'AAAA', mime: 'image/png' }];
const CARD = JSON.stringify({
  dimensions: { anticipation: 80, weight: 80, timing: 80, followThrough: 80, silhouette: 80, believability: 80 },
  reasons: ['clear windup'],
  topFix: 'nothing major',
});
const ok = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as unknown as Response;
const err = (status: number, body: string) =>
  ({ ok: false, status, text: async () => body }) as unknown as Response;

const CTX = { name: 'AM_SwordSlashC', intent: 'overhead slash', frameCount: 2 };
const fakeRead = async () => Buffer.from('PNGDATA');

afterEach(() => vi.unstubAllGlobals());

describe('the vision seam reports which model answered', () => {
  it('names the primary when the primary answers, with no fallback recorded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok(CARD)));
    const call = makeQwenVisionAttributed({ apiKey: 'k', model: 'qwen3.7-flash', fallbackModels: ['qwen3.8-27b'] });
    const answer = await call(imgs, 'p');
    expect(answer.text).toBe(CARD);
    expect(answer.model).toBe('qwen3.7-flash');
    expect(answer.attribution).toBe('answered');
    expect(answer.fellBackFrom).toEqual([]);
  });

  it('names the FALLBACK that answered after the primary is quota-throttled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(err(429, 'Throttling: free allocated quota exceeded'))
        .mockResolvedValueOnce(ok(CARD)),
    );
    const call = makeQwenVisionAttributed({ apiKey: 'k', model: 'qwen3.7-flash', fallbackModels: ['qwen3.8-27b'] });
    const answer = await call(imgs, 'p');
    expect(answer.model).toBe('qwen3.8-27b');
    expect(answer.fellBackFrom).toEqual(['qwen3.7-flash']);
    expect(describeVisionAnswer(answer)).toContain('fallback');
  });

  it('carries the answering model all the way up to the critique result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(err(429, 'quota exceeded'))
        .mockResolvedValueOnce(ok(CARD)),
    );
    const callVision = makeQwenVisionAttributed({
      apiKey: 'k', model: 'qwen3.7-flash', fallbackModels: ['qwen3.8-27b'],
    });
    const r = await critiqueAnimation(['a.png', 'b.png'], CTX, { callVision, readFile: fakeRead });
    expect(r.ok).toBe(true);
    expect(r.vision?.model).toBe('qwen3.8-27b');
    expect(r.vision?.fellBackFrom).toEqual(['qwen3.7-flash']);
  });

  it('reports "unreported" — never a defaulted model name — for a seam that cannot know', async () => {
    const r = await critiqueAnimation(['a.png'], CTX, { callVision: async () => CARD, readFile: fakeRead });
    expect(r.ok).toBe(true);
    expect(r.vision?.model).toBe(UNREPORTED_MODEL);
    expect(r.vision?.attribution).toBe('unreported');
  });

  it('normalizes both seam shapes', () => {
    expect(normalizeVisionAnswer('raw').attribution).toBe('unreported');
    expect(
      normalizeVisionAnswer({ text: 'x', model: 'm', attribution: 'answered', fellBackFrom: [] }).model,
    ).toBe('m');
  });
});
