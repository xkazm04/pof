import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PaneIdContext, getPaneHolds } from '@/hooks/usePaneHold';
import { useCookProgress } from '@/components/modules/game-systems/CookProgress/useCookProgress';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const REQUEST = { profileId: 'p1', projectPath: 'C:\\PoF', projectName: 'PoF', ueVersion: '5.7.0' };

/** A fetch whose SSE body stays OPEN until the test pushes the next event. */
function openStreamFetch() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body });
  return {
    fetchMock,
    send: (ev: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)),
  };
}

const inPackagingPane = ({ children }: { children: ReactNode }) => (
  <PaneIdContext.Provider value="packaging">{children}</PaneIdContext.Provider>
);

describe('useCookProgress holds its pane while the cook is in flight', () => {
  it.each([
    ['done', { type: 'done', exePath: 'C:\\out\\PoF.exe', durationMs: 10, sizeBytes: null, status: 'success', t: 10 }],
    ['error', { type: 'error', message: 'cook broke', status: 'failed', t: 10 }],
  ])('holds "UE cook running" until the stream sends %s, then releases it', async (_name, settle) => {
    const s = openStreamFetch();
    globalThis.fetch = s.fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useCookProgress({ request: REQUEST }), { wrapper: inPackagingPane });

    // Stream open, a line flowing, no verdict yet: the pane is held.
    s.send({ type: 'log', line: 'LogCook: Display: Cooking...', t: 1 });
    await waitFor(() => expect(result.current.logs).toHaveLength(1));
    expect(getPaneHolds()).toEqual({ packaging: ['UE cook running'] });

    s.send(settle);
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(getPaneHolds()).toEqual({});
  });

  it('holds nothing when there is no request', () => {
    renderHook(() => useCookProgress({ request: null }), { wrapper: inPackagingPane });
    expect(getPaneHolds()).toEqual({});
  });
});
