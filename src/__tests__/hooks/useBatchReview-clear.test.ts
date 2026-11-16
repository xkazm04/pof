/** A Clear that the server refuses leaves the old batch on screen, so it has to say why. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useBatchReview } from '@/hooks/useBatchReview';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

const reply = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

describe('useBatchReview.clear', () => {
  it('reports a refused clear on error and clears it after a later success', async () => {
    let refuse = true;
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => Promise.resolve(
      init?.method === 'DELETE' && refuse
        ? reply({ success: false, error: 'batch is running' }, 409)
        : reply({ success: true, data: { batch: null } }),
    )) as unknown as typeof fetch;

    const { result } = renderHook(() => useBatchReview());
    await waitFor(() => expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled());

    await act(async () => { await result.current.clear(); });
    expect(result.current.error).toBe('batch is running');

    refuse = false;
    await act(async () => { await result.current.clear(); });
    expect(result.current.error).toBeNull();
  });
});
