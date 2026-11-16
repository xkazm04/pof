/** A slow response for a previous endpoint must never land over the current one. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCRUD } from '@/hooks/useCRUD';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

function deferredFetch() {
  const pending = new Map<string, (data: string) => void>();
  globalThis.fetch = vi.fn((url: string) => new Promise((resolve) => {
    pending.set(String(url), (data) => resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
      text: () => Promise.resolve(''),
    }));
  })) as unknown as typeof fetch;
  return async (url: string, data: string) => {
    await act(async () => {
      pending.get(url)?.(data);
      await new Promise((r) => setTimeout(r, 0));
    });
  };
}

describe('useCRUD: last request wins', () => {
  it('drops an older endpoint response that resolves after the newer one', async () => {
    const answer = deferredFetch();
    const { result, rerender } = renderHook(({ url }) => useCRUD<string>(url, 'initial'), { initialProps: { url: '/a' } });
    rerender({ url: '/b' });

    await answer('/b', 'from-b');
    await answer('/a', 'from-a');

    expect(result.current.data).toBe('from-b');
  });

  it('stays loading when only the superseded request has answered', async () => {
    const answer = deferredFetch();
    const { result, rerender } = renderHook(({ url }) => useCRUD<string>(url, 'initial'), { initialProps: { url: '/a' } });
    rerender({ url: '/b' });

    await answer('/a', 'from-a');

    expect(result.current.data).toBe('initial');
    expect(result.current.isLoading).toBe(true);
  });
});
