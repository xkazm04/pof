import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useCRUD } from '@/hooks/useCRUD';

/** Envelope-shaped fetch mock: GET succeeds; the mutation URL fails. */
function mockFetch(mutationOk: boolean) {
  const mock = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('/fail')) {
      const body = mutationOk
        ? { success: true, data: { ok: true } }
        : { success: false, error: 'Server rejected the write' };
      return Promise.resolve({ ok: mutationOk, status: mutationOk ? 200 : 500, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    }
    const body = { success: true, data: [] };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(cleanup);

describe('useCRUD — mutation error surfacing', () => {
  it('exposes the reason on mutationError instead of failing silently', async () => {
    mockFetch(false);
    const { result } = renderHook(() => useCRUD<unknown[]>('/api/things', []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returned: unknown = 'unset';
    await act(async () => { returned = await result.current.mutate('/api/things/fail', { method: 'DELETE' }); });

    expect(returned).toBeNull();
    expect(result.current.mutationError).toBe('Server rejected the write');

    act(() => result.current.clearMutationError());
    expect(result.current.mutationError).toBeNull();
  });

  it('clears any prior mutationError on a subsequent successful mutation', async () => {
    const mock = mockFetch(false);
    const { result } = renderHook(() => useCRUD<unknown[]>('/api/things', []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.mutate('/api/things/fail', { method: 'DELETE' }); });
    expect(result.current.mutationError).toBe('Server rejected the write');

    // Flip the mutation endpoint to succeed, then mutate again.
    mock.mockImplementation((url: string) => {
      const body = { success: true, data: String(url).includes('/fail') ? { ok: true } : [] };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    });
    await act(async () => { await result.current.mutate('/api/things/fail', { method: 'DELETE' }); });
    expect(result.current.mutationError).toBeNull();
  });
});
