/**
 * `ue5LiveState.setProperty` reports what actually happened to the frame and
 * records the write in the client's ledger, keyed `objectPath::propertyName`.
 *
 * Before: `send()` silently no-oped unless the socket was OPEN and
 * `setProperty` returned void, so no caller could know a write was dropped.
 * The wire frame the UE plugin consumes must stay byte-identical (guard).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { deriveConflicts } from '@/lib/ue5-bridge/sync-ledger';

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

function openSocket(): FakeWebSocket {
  ue5LiveState.connect('127.0.0.1', 30041);
  const ws = FakeWebSocket.instances.at(-1)!;
  ws.fireOpen();
  return ws;
}

function watchUpdate(ws: FakeWebSocket, watchId: string, objectPath: string, propertyName: string, value: unknown) {
  ws.push({ type: 'property.update', payload: { watchId, objectPath, propertyName, value } });
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
});

afterEach(() => {
  ue5LiveState.disconnect('test-teardown');
});

describe('setProperty delivery receipt', () => {
  it('case 1: socket still CONNECTING -> { sent: false } and the ledger records it as dropped', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    const receipt = ue5LiveState.setProperty('/Game/A', 'Health', 100);
    expect(receipt).toMatchObject({ sent: false, key: '/Game/A::Health' });
    expect(ue5LiveState.getState().writes.get('/Game/A::Health')?.outcome).toBe('dropped');
  });

  it('case 2 [guard]: socket OPEN -> exactly the unchanged set.property frame goes out', () => {
    const ws = openSocket();
    const before = ws.sent.length;
    ue5LiveState.setProperty('/Game/A', 'Health', 100);
    expect(ws.sent.slice(before)).toEqual([
      '{"type":"set.property","payload":{"objectPath":"/Game/A","propertyName":"Health","value":100}}',
    ]);
  });

  it('an OPEN socket yields { sent: true } and an unobserved ledger entry', () => {
    openSocket();
    expect(ue5LiveState.setProperty('/Game/A', 'Health', 100)).toMatchObject({ sent: true });
    expect(ue5LiveState.getState().writes.get('/Game/A::Health')?.outcome).toBe('unobserved');
  });

  it('takes the base from the watch on the exact key and confirms on read-back', () => {
    const ws = openSocket();
    watchUpdate(ws, 'w1', '/Game/A', 'Health', 50);
    ue5LiveState.setProperty('/Game/A', 'Health', 100);
    expect(ue5LiveState.getState().writes.get('/Game/A::Health')).toMatchObject({ base: 50, written: 100, sent: true });
    watchUpdate(ws, 'w1', '/Game/A', 'Health', 100);
    expect(ue5LiveState.getState().writes.get('/Game/A::Health')?.outcome).toBe('confirmed');
    expect(deriveConflicts(ue5LiveState.getState().writes)).toEqual([]);
  });

  it('case 6 (end to end): a watch on /Game/B.Health moving 50 -> 80 raises no conflict for a write to /Game/A', () => {
    const ws = openSocket();
    ue5LiveState.setProperty('/Game/A', 'Health', 100);
    watchUpdate(ws, 'wb', '/Game/B', 'Health', 50);
    watchUpdate(ws, 'wb', '/Game/B', 'Health', 80);
    expect(deriveConflicts(ue5LiveState.getState().writes)).toEqual([]);
  });

  it("case 7 (end to end): a watch on 'Max' moving 1 -> 2 raises no conflict for a write to 'MaxHealth'", () => {
    const ws = openSocket();
    ue5LiveState.setProperty('/Game/A', 'MaxHealth', 5);
    watchUpdate(ws, 'wm', '/Game/A', 'Max', 1);
    watchUpdate(ws, 'wm', '/Game/A', 'Max', 2);
    expect(deriveConflicts(ue5LiveState.getState().writes)).toEqual([]);
  });

  it('a diverged read-back surfaces as one typed conflict; the ledger is cloned for callers', () => {
    const ws = openSocket();
    watchUpdate(ws, 'w1', '/Game/A', 'Health', 50);
    ue5LiveState.setProperty('/Game/A', 'Health', 100);
    watchUpdate(ws, 'w1', '/Game/A', 'Health', 80);
    const state = ue5LiveState.getState();
    expect(deriveConflicts(state.writes)).toEqual([
      { key: '/Game/A::Health', objectPath: '/Game/A', propertyName: 'Health', base: 50, written: 100, inbound: 80 },
    ]);
    state.writes.clear();
    expect(ue5LiveState.getState().writes.size).toBe(1);
  });

  it('disconnect clears the ledger with the watches', () => {
    openSocket();
    ue5LiveState.setProperty('/Game/A', 'Health', 100);
    ue5LiveState.disconnect('user');
    expect(ue5LiveState.getState().writes.size).toBe(0);
  });
});
