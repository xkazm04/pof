import { describe, it, expect, beforeEach } from 'vitest';
import { mockFetch } from '../setup';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';

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
