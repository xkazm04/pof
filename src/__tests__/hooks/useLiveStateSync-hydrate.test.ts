/** The store is only written by this hook, so a fresh mount must read the client's current state. */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';

afterEach(cleanup);

describe('useLiveStateSync mount', () => {
  it('replaces a status left over from before the last unmount with the client state', () => {
    expect(ue5LiveState.getState().wsStatus).toBe('disconnected');
    useUE5BridgeStore.setState({ wsStatus: 'connected' });

    const { result } = renderHook(() => useLiveStateSync());

    expect(result.current.wsStatus).toBe('disconnected');
    expect(result.current.isLive).toBe(false);
  });
});
