/**
 * Pins the OBSERVABLE reconnect behaviour of the UE5 WebSocket live-state
 * channel: the exact delay sequence, the reset on a successful open, and the
 * silence after an intentional disconnect.
 *
 * Written against the hand-rolled copy of the backoff formula and re-run
 * unchanged after that copy was replaced by the shared scheduler in
 * `@/lib/connection-lifecycle` — the whole point being that a consolidation
 * must not move a single millisecond.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { UI_TIMEOUTS } from '@/lib/constants';

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

  /** The server accepted the socket. */
  fireOpen() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(); }
  /** The socket dropped (not by us). */
  fireClose() { this.readyState = FakeWebSocket.CLOSED; this.onclose?.(); }
}

const BASE = UI_TIMEOUTS.ue5WsReconnectBase;
const MAX = UI_TIMEOUTS.ue5WsReconnectMax;

let delays: number[];
let realSetTimeout: typeof globalThis.setTimeout;

/** The socket the client most recently opened. */
function socket(index: number): FakeWebSocket {
  const ws = FakeWebSocket.instances[index];
  if (!ws) throw new Error(`no socket #${index} (have ${FakeWebSocket.instances.length})`);
  return ws;
}

beforeEach(() => {
  vi.useFakeTimers();
  realSetTimeout = globalThis.setTimeout;
  delays = [];
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    return realSetTimeout(fn, ms);
  }) as unknown as typeof globalThis.setTimeout);

  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
});

afterEach(() => {
  ue5LiveState.disconnect('test-teardown');
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('UE5 WS live-state reconnect backoff', () => {
  it('escalates delay = min(base * 2^attempt, max) and clamps at the ceiling', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Six consecutive drops, each one re-opening after the scheduled delay.
    for (let i = 0; i < 6; i++) {
      socket(i).fireClose();
      vi.advanceTimersByTime(MAX + 1);
    }

    expect(delays).toEqual([
      BASE,          // 2^0 =  2000
      BASE * 2,      // 2^1 =  4000
      BASE * 4,      // 2^2 =  8000
      BASE * 8,      // 2^3 = 16000
      MAX,           // 2^4 = 32000 → clamped to 30000
      MAX,           // 2^5 = 64000 → clamped to 30000
    ]);
    // Each scheduled reconnect actually opened a fresh socket.
    expect(FakeWebSocket.instances).toHaveLength(7);
  });

  it('reports "reconnecting" while a retry is pending', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    socket(0).fireClose();
    expect(ue5LiveState.getState().wsStatus).toBe('reconnecting');
  });

  it('resets the exponent after a socket successfully opens', () => {
    ue5LiveState.connect('127.0.0.1', 30041);

    socket(0).fireClose();
    vi.advanceTimersByTime(MAX + 1);
    socket(1).fireClose();
    vi.advanceTimersByTime(MAX + 1);
    expect(delays).toEqual([BASE, BASE * 2]);

    // A successful open clears the escalation…
    socket(2).fireOpen();
    expect(ue5LiveState.getState().wsStatus).toBe('connected');

    // …so the next drop starts over at the base delay.
    socket(2).fireClose();
    expect(delays).toEqual([BASE, BASE * 2, BASE]);
  });

  it('schedules nothing more after an intentional disconnect', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    socket(0).fireOpen();

    ue5LiveState.disconnect('user-requested');
    const scheduledSoFar = delays.length;
    const openedSoFar = FakeWebSocket.instances.length;

    vi.advanceTimersByTime(MAX * 4);

    expect(delays).toHaveLength(scheduledSoFar);
    expect(FakeWebSocket.instances).toHaveLength(openedSoFar);
    expect(ue5LiveState.getState().wsStatus).toBe('disconnected');
  });

  it('cancels a pending reconnect when the caller reconnects explicitly', () => {
    ue5LiveState.connect('127.0.0.1', 30041);
    socket(0).fireClose();          // schedules a retry
    ue5LiveState.connect('127.0.0.1', 30041); // opens immediately, resets attempts

    const openedAfterManualConnect = FakeWebSocket.instances.length;
    vi.advanceTimersByTime(MAX * 4);

    // The superseded timer must not open a second socket behind our back.
    expect(FakeWebSocket.instances).toHaveLength(openedAfterManualConnect);

    // …and the attempt counter went back to zero.
    socket(openedAfterManualConnect - 1).fireClose();
    expect(delays.at(-1)).toBe(BASE);
  });
});

// ── One formula, one place ──────────────────────────────────────────────────

/** Every source file in the ue5-bridge-client context, as `path → contents`. */
function contextSources(): Record<string, string> {
  const files = [
    'src/lib/connection-lifecycle.ts',
    'src/hooks/useUE5Connection.ts',
    'src/hooks/useLiveStateSync.ts',
    'src/stores/ue5BridgeStore.ts',
    ...readdirSync('src/lib/ue5-bridge')
      .filter((f) => f.endsWith('.ts'))
      .map((f) => `src/lib/ue5-bridge/${f}`),
  ];
  return Object.fromEntries(files.map((f) => [f, readFileSync(f, 'utf8')]));
}

/** `base * 2^attempt` in either spelling. Fresh regex per use — `/g` is stateful. */
const backoffExpr = () => /Math\.pow\(\s*2\s*,|\b2\s*\*\*\s*/g;

describe('exactly one implementation of the backoff formula', () => {
  it('lives only in connection-lifecycle.ts', () => {
    const offenders = Object.entries(contextSources())
      .filter(([, src]) => backoffExpr().test(src))
      .map(([path]) => path);

    expect(offenders).toEqual(['src/lib/connection-lifecycle.ts']);
  });

  it('appears exactly once even there', () => {
    const src = readFileSync('src/lib/connection-lifecycle.ts', 'utf8');
    expect(src.match(backoffExpr())).toHaveLength(1);
  });

  it('is what the WS channel actually consumes', () => {
    const src = readFileSync('src/lib/ue5-bridge/ws-live-state.ts', 'utf8');
    expect(src).toContain("createReconnectScheduler } from '@/lib/connection-lifecycle'");
    expect(src).toContain('this.reconnect.schedule()');
  });
});
