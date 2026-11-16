/** However many hosts are mounted, one client message is bridged into the store exactly once. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useLiveStateSync bridge', () => {
  it('two mounted hosts: one client message calls setLiveState once; the last unmount unsubscribes', () => {
    const handlers = new Set<(s: ReturnType<typeof ue5LiveState.getState>) => void>();
    let unsubs = 0;
    vi.spyOn(ue5LiveState, 'onStateChange').mockImplementation((h) => {
      handlers.add(h as never);
      return () => { unsubs += 1; handlers.delete(h as never); };
    });
    const setLiveState = vi.fn();
    useUE5BridgeStore.setState({ setLiveState });

    const a = renderHook(() => useLiveStateSync());
    const b = renderHook(() => useLiveStateSync());
    setLiveState.mockClear();

    for (const h of [...handlers]) h(ue5LiveState.getState());
    expect(setLiveState).toHaveBeenCalledTimes(1);

    a.unmount();
    expect(handlers.size).toBe(1);
    b.unmount();
    expect(handlers.size).toBe(0);
    expect(unsubs).toBe(1);
  });
});
