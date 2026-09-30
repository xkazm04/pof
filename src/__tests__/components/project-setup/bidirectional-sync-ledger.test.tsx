/**
 * The Bidirectional State Sync panel reads the write ledger from the WS
 * client instead of scanning its own display log.
 *
 * Before: every outbound handler logged `info` / counted the write as sent
 * even when `send()` had dropped the frame, and the conflict lane fired on
 * every confirmed write (previousValue !== value while a SET log line with the
 * same name prefix existed), rendering a truncated log string as "Sent".
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render, screen, cleanup } from '@testing-library/react';
import { useBidirectionalStateSyncPanel } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/useBidirectionalStateSyncPanel';
import { ConflictSection } from '@/components/modules/project-setup/BidirectionalStateSyncPanel/ConflictSection';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';

// ── Fake WebSocket (jsdom's is a real network client) ───────────────────────

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState: number = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = FakeWebSocket.CLOSED; }
  fireOpen() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(); }
  push(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}

function health(ws: FakeWebSocket, value: number) {
  ws.push({ type: 'property.update', payload: { watchId: 'w1', objectPath: '/Game/A', propertyName: 'Health', value } });
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
});

afterEach(() => {
  cleanup();
  ue5LiveState.disconnect('test-teardown');
});

describe('useBidirectionalStateSyncPanel reads the ledger', () => {
  it('case 8: a push over a socket that is not OPEN logs warn/dropped and is not counted as outbound', () => {
    ue5LiveState.connect('127.0.0.1', 30041); // still CONNECTING
    const { result } = renderHook(() => useBidirectionalStateSyncPanel());

    act(() => { result.current.handleWatchedPush('/Game/A', 'Health', 100); });

    const entry = result.current.syncLog.at(-1)!;
    expect(entry.level).toBe('warn');
    expect(entry.detail).toContain('dropped');
    expect(result.current.outboundCount).toBe(0);
  });

  it('a delivered push is logged info and counted', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    FakeWebSocket.instances.at(-1)!.fireOpen();
    const { result } = renderHook(() => useBidirectionalStateSyncPanel());

    act(() => { result.current.handleWatchedPush('/Game/A', 'Health', 100); });

    expect(result.current.syncLog.at(-1)!.level).toBe('info');
    expect(result.current.outboundCount).toBe(1);
  });

  it('a confirmed write raises no conflict; a diverged one raises one typed conflict', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    const ws = FakeWebSocket.instances.at(-1)!;
    ws.fireOpen();
    const { result } = renderHook(() => useBidirectionalStateSyncPanel());

    act(() => { health(ws, 50); });
    act(() => { result.current.handleWatchedPush('/Game/A', 'Health', 100); });
    act(() => { health(ws, 100); });
    expect(result.current.conflicts).toEqual([]);

    act(() => { result.current.handleWatchedPush('/Game/A', 'Health', 120); });
    act(() => { health(ws, 80); });
    expect(result.current.conflicts).toEqual([
      { key: '/Game/A::Health', objectPath: '/Game/A', propertyName: 'Health', base: 100, written: 120, inbound: 80 },
    ]);
  });
});

describe('ConflictSection', () => {
  it('renders base, written and inbound as typed values, keyed by object and property', () => {
    render(
      <ConflictSection
        showConflicts
        setShowConflicts={() => {}}
        conflicts={[{ key: '/Game/A::Health', objectPath: '/Game/A', propertyName: 'Health', base: 50, written: 100, inbound: 80 }]}
      />,
    );
    const row = screen.getByTestId('sync-conflict-/Game/A::Health');
    expect(row.textContent).toContain('Health');
    expect(row.textContent).toContain('/Game/A');
    expect(screen.getByTestId('sync-conflict-base').textContent).toBe('50');
    expect(screen.getByTestId('sync-conflict-written').textContent).toBe('100');
    expect(screen.getByTestId('sync-conflict-inbound').textContent).toBe('80');
  });
});
