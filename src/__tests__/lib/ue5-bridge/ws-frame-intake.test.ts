/**
 * Frame intake door for the live-state WebSocket client.
 *
 * Before: state.snapshot was cast and stored unchecked (a viewport-less frame
 * crashed the panel render), and property.update carried the plugin's
 * FPlatformTime timestamp (arbitrary origin) that the panel shows as a clock.
 * After: malformed snapshots are rejected at intake with a warning; watch
 * updates are stamped with the client's arrival wall-clock time.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { formatClock } from '@/components/modules/project-setup/LiveStateSyncPanel/helpers';
import { logger } from '@/lib/logger';

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
  onmessage: ((e: { data: string | ArrayBuffer }) => void) | null = null;
  binaryType = 'blob';
  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send() {}
  close() { this.readyState = FakeWebSocket.CLOSED; }
  fireOpen() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(); }
  push(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}

const goodSnapshot = () => ({
  timestamp: 5,
  editorState: 'Editing',
  openLevel: '/Game/L',
  selectedActors: [],
  dirtyPackages: [],
  pieState: null,
  viewport: { cameraLocation: { x: 0, y: 0, z: 0 }, cameraRotation: { pitch: 0, yaw: 0, roll: 0 }, fov: 90, viewMode: 'Lit' },
});

function openSocket(): FakeWebSocket {
  ue5LiveState.connect('127.0.0.1', 30041);
  const ws = FakeWebSocket.instances.at(-1)!;
  ws.fireOpen();
  return ws;
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  ue5LiveState.disconnect('test-teardown');
});

describe('state.snapshot intake validation', () => {
  it('rejects a viewport-less snapshot, keeps state clean and logs a warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const ws = openSocket();
    const { viewport: _omit, ...noViewport } = goodSnapshot();
    void _omit;
    ws.push({ type: 'state.snapshot', payload: noViewport });
    expect(ue5LiveState.getState().snapshot).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('rejects a snapshot whose selectedActors is not an array', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const ws = openSocket();
    ws.push({ type: 'state.snapshot', payload: { ...goodSnapshot(), selectedActors: null } });
    expect(ue5LiveState.getState().snapshot).toBeNull();
  });

  it('accepts a well-formed snapshot', () => {
    const ws = openSocket();
    ws.push({ type: 'state.snapshot', payload: goodSnapshot() });
    expect(ue5LiveState.getState().snapshot?.viewport.viewMode).toBe('Lit');
  });
});

describe('property.update arrival stamp', () => {
  it('replaces the plugin platform-clock timestamp with the client arrival time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 8, 13, 14, 15));
    const arrival = Date.now();
    const ws = openSocket();
    ws.push({
      type: 'property.update',
      payload: { watchId: 'w1', objectPath: '/Game/A', propertyName: 'Health', value: 1, timestamp: 123456 },
    });
    const stamped = ue5LiveState.getState().propertyWatches.get('w1')?.timestamp;
    expect(stamped).toBe(arrival);
    expect(formatClock(stamped)).toBe('13:14:15');
  });
});
