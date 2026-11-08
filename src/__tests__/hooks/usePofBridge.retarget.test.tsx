/**
 * A host/port/token edit while the bridge sits in error/reconnecting must retarget the
 * connection, once, even with several hook instances mounted (AppShell, NewHome, ExportPanel).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const { mgr } = vi.hoisted(() => {
  const state = { status: 'disconnected', pluginInfo: null, error: null, lastConnected: null, reconnectAttempts: 0 };
  return {
    mgr: {
      state,
      connect: vi.fn(async () => { state.status = 'error'; }),
      disconnect: vi.fn(),
      getState: () => state,
      onStateChange: () => () => {},
    },
  };
});

vi.mock('@/lib/pof-bridge/connection-manager', () => ({ pofBridgeConnection: mgr }));

import { usePofBridge } from '@/hooks/usePofBridge';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

afterEach(() => { cleanup(); });
beforeEach(() => {
  vi.clearAllMocks();
  mgr.state.status = 'disconnected';
  usePofBridgeStore.setState({ autoDetect: true, pofPort: 30010, pofAuthToken: '' });
});

describe('usePofBridge retarget on settings edit', () => {
  it('reconnects once with the new port across three mounts while in error', () => {
    for (let i = 0; i < 3; i++) renderHook(() => usePofBridge());
    expect(mgr.connect).toHaveBeenCalledTimes(1);
    expect(mgr.state.status).toBe('error');

    act(() => { usePofBridgeStore.setState({ pofPort: 30011 }); });

    expect(mgr.connect).toHaveBeenCalledTimes(2);
    expect(mgr.connect.mock.calls[1]).toEqual([expect.any(String), 30011, undefined]);
  });

  it('reconnects once with the new port when the edit lands while connected', () => {
    for (let i = 0; i < 3; i++) renderHook(() => usePofBridge());
    mgr.state.status = 'connected';
    expect(mgr.connect).toHaveBeenCalledTimes(1);

    act(() => { usePofBridgeStore.setState({ pofPort: 30011 }); });

    expect(mgr.connect).toHaveBeenCalledTimes(2);
    expect(mgr.connect.mock.calls[1]).toEqual([expect.any(String), 30011, undefined]);
  });

  it('does not reconnect when nothing changed', () => {
    for (let i = 0; i < 3; i++) renderHook(() => usePofBridge());
    act(() => { usePofBridgeStore.setState({ pofPort: 30010 }); });
    expect(mgr.connect).toHaveBeenCalledTimes(1);
  });
});
