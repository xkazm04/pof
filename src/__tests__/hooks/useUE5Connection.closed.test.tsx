/**
 * EventSource only retries network drops. A non-200 answer (a server error, or a
 * route mid-recompile) ends it with readyState CLOSED and no retry, so the tab
 * stayed on 'reconnecting' until a reload.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useUE5Connection } from '@/hooks/useUE5Connection';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { UI_TIMEOUTS } from '@/lib/constants';

class FakeES {
  static all: FakeES[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  closed = false;
  constructor(public url: string) { FakeES.all.push(this); }
  close() { this.closed = true; this.readyState = 2; }
  failFatally() { this.readyState = 2; this.onerror?.(); }
  failTransiently() { this.readyState = 0; this.onerror?.(); }
}

const DISCONNECTED = { status: 'disconnected', info: null, error: null, lastConnected: null, reconnectAttempts: 0 } as const;

beforeEach(() => {
  vi.useFakeTimers();
  FakeES.all = [];
  (globalThis as { EventSource?: unknown }).EventSource = FakeES;
  useUE5BridgeStore.setState({ connectionState: { ...DISCONNECTED }, autoConnect: false, host: '127.0.0.1', httpPort: 30010 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useUE5Connection stream recovery', () => {
  it('reopens the stream after a permanent close', () => {
    renderHook(() => useUE5Connection());
    act(() => FakeES.all[0].failFatally());
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.ue5ReconnectBase); });
    expect(FakeES.all).toHaveLength(2);
  });

  it('leaves a transient error to the browser retry', () => {
    renderHook(() => useUE5Connection());
    act(() => FakeES.all[0].failTransiently());
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.ue5ReconnectMax); });
    expect(FakeES.all).toHaveLength(1);
  });

  it('does not reopen after the last holder unmounts', () => {
    const { unmount } = renderHook(() => useUE5Connection());
    act(() => FakeES.all[0].failFatally());
    unmount();
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.ue5ReconnectMax); });
    expect(FakeES.all).toHaveLength(1);
  });
});
