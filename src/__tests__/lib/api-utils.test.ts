import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockFetch } from '../setup';
import { apiFetch, tryApiFetch, apiSuccess, withRoute, respondFromResult } from '@/lib/api-utils';
import { ok, err, mapResult } from '@/types/result';
import { logger } from '@/lib/logger';

describe('apiFetch', () => {
  beforeEach(() => {
    mockFetch(); // default: { success: true, data: {} }
  });

  it('returns unwrapped data on success', async () => {
    mockFetch({ body: { success: true, data: { id: 1, name: 'test' } } });
    const result = await apiFetch<{ id: number; name: string }>('/api/test');
    expect(result).toEqual({ id: 1, name: 'test' });
  });

  it('throws on error response', async () => {
    mockFetch({ body: { success: false, error: 'Not found' }, status: 404 });
    await expect(apiFetch('/api/test')).rejects.toThrow('Not found');
  });

  it('passes RequestInit options to fetch', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: null } });
    await apiFetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"x":1}',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      body: '{"x":1}',
    }));
  });

  it('throws when fetch itself rejects', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('Network failure'))) as unknown as typeof fetch;
    await expect(apiFetch('/api/test')).rejects.toThrow('Network failure');
  });
});

describe('tryApiFetch', () => {
  it('returns ok result on success', async () => {
    mockFetch({ body: { success: true, data: [1, 2, 3] } });
    const result = await tryApiFetch<number[]>('/api/test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([1, 2, 3]);
    }
  });

  it('returns err result on API error', async () => {
    mockFetch({ body: { success: false, error: 'Bad request' }, status: 400 });
    const result = await tryApiFetch('/api/test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Bad request');
    }
  });

  it('returns err result on network error', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('Timeout'))) as unknown as typeof fetch;
    const result = await tryApiFetch('/api/test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Timeout');
    }
  });

  it('returns err with generic message for non-Error throws', async () => {
    globalThis.fetch = (() => Promise.reject('string error')) as unknown as typeof fetch;
    const result = await tryApiFetch('/api/test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Network error');
    }
  });
});

describe('respondFromResult', () => {
  it('returns a 200 success envelope for an ok result by default', async () => {
    const res = respondFromResult(ok({ id: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 1 } });
  });

  it('honors a custom ok status code', async () => {
    const res = respondFromResult(ok({ created: true }), 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { created: true } });
  });

  it('returns a 502 error envelope for an err result by default', async () => {
    const res = respondFromResult(err('upstream down'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: 'upstream down' });
  });

  it('honors a custom error status code', async () => {
    const res = respondFromResult(err('not found'), 200, 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'not found' });
  });

  it('composes with mapResult to shape the success payload', async () => {
    const res = respondFromResult(mapResult(ok([1, 2]), (assets) => ({ assets })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { assets: [1, 2] } });
  });
});

describe('withRoute', () => {
  it('passes through the handler response and forwards its arguments on success', async () => {
    const handler = vi.fn(async (a: number, b: number) => apiSuccess({ sum: a + b }));
    const wrapped = withRoute(handler, 'Should not be used');

    const res = await wrapped(2, 3);

    expect(handler).toHaveBeenCalledWith(2, 3);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { sum: 5 } });
  });

  it('catches a thrown Error and returns a 500 envelope with its message', async () => {
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const wrapped = withRoute(async () => { throw new Error('boom'); }, 'Fallback message');

    const res = await wrapped();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'boom' });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('falls back to the provided message for non-Error throws', async () => {
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const wrapped = withRoute(async () => { throw 'plain string failure'; }, 'Failed to do the thing');

    const res = await wrapped();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Failed to do the thing' });
    errSpy.mockRestore();
  });
});
