/**
 * React StrictMode runs mount -> cleanup -> mount. usePofBridge's mount guard was
 * cleared by that cleanup and never set back, so every later connection change
 * was dropped: the store stayed at its default in dev.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, configure } from '@testing-library/react';
import type { PofConnectionState } from '@/types/pof-bridge';

const { handlers, base } = vi.hoisted(() => ({
  handlers: new Set<(s: unknown) => void>(),
  base: { status: 'disconnected', pluginInfo: null, error: null, lastConnected: null, reconnectAttempts: 0 },
}));

vi.mock('@/lib/pof-bridge/connection-manager', () => ({
  pofBridgeConnection: {
    getState: () => base,
    connect: vi.fn(),
    disconnect: vi.fn(),
    onStateChange: (h: (s: unknown) => void) => { handlers.add(h); return () => { handlers.delete(h); }; },
  },
}));

import { usePofBridge } from '@/hooks/usePofBridge';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

afterEach(() => { cleanup(); configure({ reactStrictMode: false }); });
beforeEach(() => {
  configure({ reactStrictMode: true });
  handlers.clear();
  usePofBridgeStore.setState({ autoDetect: false, connectionStatus: 'disconnected' });
});

describe('usePofBridge under StrictMode', () => {
  it('still applies a live connection change after the double mount', () => {
    const { result } = renderHook(() => usePofBridge());
    act(() => {
      for (const h of handlers) h({ ...base, status: 'connected' } as PofConnectionState);
    });
    expect(result.current.isConnected).toBe(true);
    expect(usePofBridgeStore.getState().connectionStatus).toBe('connected');
  });
});
