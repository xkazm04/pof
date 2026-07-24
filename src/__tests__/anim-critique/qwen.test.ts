/**
 * Qwen vision seam — the quota fallback chain. When the primary model hits its
 * quota (429 / quota markers), makeQwenVision transparently retries the next model;
 * a real (non-quota) error throws immediately without burning the fallbacks.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeQwenVision, parseFallbackModels } from '@/lib/anim-critique/qwen';

const imgs = [{ base64: 'AAAA', mime: 'image/png' }];
const ok = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as unknown as Response;
const err = (status: number, body: string) =>
  ({ ok: false, status, text: async () => body }) as unknown as Response;

function bodyModel(call: unknown): string {
  const init = (call as [string, RequestInit])[1];
  return JSON.parse(init.body as string).model;
}

afterEach(() => vi.unstubAllGlobals());

describe('makeQwenVision quota fallback', () => {
  it('returns the primary model result when it succeeds (no fallback call)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok('{"ok":1}'));
    vi.stubGlobal('fetch', fetchMock);
    const call = makeQwenVision({ apiKey: 'k', model: 'qwen3.7-plus' });
    expect(await call(imgs, 'p')).toBe('{"ok":1}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyModel(fetchMock.mock.calls[0])).toBe('qwen3.7-plus');
  });

  it('falls back to the next model on a 429 quota error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(429, 'Throttling: free allocated quota exceeded'))
      .mockResolvedValueOnce(ok('{"fallback":1}'));
    vi.stubGlobal('fetch', fetchMock);
    const call = makeQwenVision({ apiKey: 'k', model: 'qwen3.7-plus', fallbackModels: ['qwen3.6-flash', 'qwen3.6-plus'] });
    expect(await call(imgs, 'p')).toBe('{"fallback":1}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyModel(fetchMock.mock.calls[0])).toBe('qwen3.7-plus');
    expect(bodyModel(fetchMock.mock.calls[1])).toBe('qwen3.6-flash');
  });

  it('walks the whole chain and throws when every model is quota-exhausted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(429, 'quota exceeded'));
    vi.stubGlobal('fetch', fetchMock);
    const call = makeQwenVision({ apiKey: 'k', model: 'qwen3.7-plus', fallbackModels: ['qwen3.6-flash', 'qwen3.6-plus'] });
    await expect(call(imgs, 'p')).rejects.toThrow(/exhausted/i);
    expect(fetchMock).toHaveBeenCalledTimes(3); // primary + 2 fallbacks
  });

  it('throws immediately on a non-quota error (does not burn fallbacks)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(err(400, 'invalid request: bad image'));
    vi.stubGlobal('fetch', fetchMock);
    const call = makeQwenVision({ apiKey: 'k', model: 'qwen3.7-plus', fallbackModels: ['qwen3.6-flash'] });
    await expect(call(imgs, 'p')).rejects.toThrow(/HTTP 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('parseFallbackModels', () => {
  it('splits a comma-separated list and trims blanks', () => {
    expect(parseFallbackModels(' a , b ,, c ')).toEqual(['a', 'b', 'c']);
  });

  it('returns undefined for unset/blank so the caller keeps its default', () => {
    expect(parseFallbackModels(undefined)).toBeUndefined();
    expect(parseFallbackModels('   ')).toBeUndefined();
  });

  it('supports an explicit empty chain via "none" (primary only, no fallbacks)', () => {
    expect(parseFallbackModels('none')).toEqual([]);
  });
});

describe('QWEN_CRITIQUE_FALLBACKS env override', () => {
  it('re-tiers the chain without a code change', async () => {
    vi.stubEnv('QWEN_CRITIQUE_FALLBACKS', 'qwen3.7-flash, qwen3.6-plus');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(429, 'quota exceeded'))
      .mockResolvedValueOnce(ok('{"env":1}'));
    vi.stubGlobal('fetch', fetchMock);
    const call = makeQwenVision({ apiKey: 'k', model: 'qwen3.7-plus' });
    expect(await call(imgs, 'p')).toBe('{"env":1}');
    expect(bodyModel(fetchMock.mock.calls[1])).toBe('qwen3.7-flash');
    vi.unstubAllEnvs();
  });

  it('explicit fallbackModels beats the env override', async () => {
    vi.stubEnv('QWEN_CRITIQUE_FALLBACKS', 'qwen3.7-flash');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(err(429, 'quota exceeded'))
      .mockResolvedValueOnce(ok('{"opt":1}'));
    vi.stubGlobal('fetch', fetchMock);
    const call = makeQwenVision({ apiKey: 'k', model: 'qwen3.7-plus', fallbackModels: ['qwen3.6-plus'] });
    expect(await call(imgs, 'p')).toBe('{"opt":1}');
    expect(bodyModel(fetchMock.mock.calls[1])).toBe('qwen3.6-plus');
    vi.unstubAllEnvs();
  });
});
