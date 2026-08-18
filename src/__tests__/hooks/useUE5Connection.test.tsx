/**
 * `useUE5Connection` is the ONLY live path from the server-owned UE5 Remote
 * Control connection to the browser. These tests pin the two things that were
 * broken before it was wired up:
 *
 *   1. `useUE5BridgeStore.connectionState` can actually reach 'connected' —
 *      via the real SSE transport, not a local component state.
 *   2. Losing the transport does not leave the store claiming 'connected'.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useUE5Connection } from '@/hooks/useUE5Connection';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { ue5Connection } from '@/lib/ue5-bridge/connection-manager';
import type { UE5ConnectionState } from '@/types/ue5-bridge';

// setup.ts installs no auto-cleanup — see reference_test_no_autocleanup.
afterEach(cleanup);

// ── Fake EventSource (jsdom has none) ───────────────────────────────────────

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  close() { this.closed = true; }

  /** Push one `data:` frame, exactly as the SSE route does. */
  push(state: UE5ConnectionState) {
    this.onmessage?.({ data: JSON.stringify(state) });
  }

  /** Simulate the stream dropping. */
  drop() { this.onerror?.(); }
}

const CONNECTED: UE5ConnectionState = {
  status: 'connected',
  info: { version: '5.8.0', serverName: 'PoFEditor' },
  error: null,
  lastConnected: '2026-08-18T00:00:00.000Z',
  reconnectAttempts: 0,
};

const DISCONNECTED: UE5ConnectionState = {
  status: 'disconnected',
  info: null,
  error: null,
  lastConnected: null,
  reconnectAttempts: 0,
};

function latestStream(): FakeEventSource {
  const es = FakeEventSource.instances.at(-1);
  if (!es) throw new Error('hook did not open an SSE stream');
  return es;
}

function okFetch(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(''),
  });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  useUE5BridgeStore.setState({
    connectionState: { ...DISCONNECTED },
    autoConnect: false,
    host: '127.0.0.1',
    httpPort: 30010,
  });
  globalThis.fetch = okFetch(DISCONNECTED) as unknown as typeof fetch;
});

describe('useUE5Connection — the live transport', () => {
  it('subscribes to the SSE status route on mount and closes it on unmount', () => {
    const { unmount } = renderHook(() => useUE5Connection());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(latestStream().url).toBe('/api/ue5-bridge/status');
    expect(latestStream().closed).toBe(false);

    const stream = latestStream();
    unmount();
    expect(stream.closed).toBe(true);
  });

  it('drives useUE5BridgeStore.connectionState to "connected" from an SSE frame', () => {
    const { result } = renderHook(() => useUE5Connection());

    // Before any frame: the store's default is a GUESS, and the hook says so.
    expect(useUE5BridgeStore.getState().connectionState.status).toBe('disconnected');
    expect(result.current.isStateLive).toBe(false);

    act(() => { latestStream().push(CONNECTED); });

    // This is the assertion the whole direction exists for: the store gate
    // that `/api/ue5-inject-item` reads is reachable through a real transport.
    expect(useUE5BridgeStore.getState().connectionState.status).toBe('connected');
    expect(useUE5BridgeStore.getState().connectionState.info?.version).toBe('5.8.0');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isStateLive).toBe(true);
  });

  it('stops claiming "connected" when the stream drops', () => {
    renderHook(() => useUE5Connection());
    act(() => { latestStream().push(CONNECTED); });
    expect(useUE5BridgeStore.getState().connectionState.status).toBe('connected');

    act(() => { latestStream().drop(); });

    expect(useUE5BridgeStore.getState().connectionState.status).toBe('reconnecting');
  });

  it('ignores a malformed frame rather than corrupting the store', () => {
    renderHook(() => useUE5Connection());
    act(() => { latestStream().push(CONNECTED); });

    act(() => { latestStream().onmessage?.({ data: 'not json' }); });

    expect(useUE5BridgeStore.getState().connectionState.status).toBe('connected');
  });

  it('does not write its own POST response into the store (SSE is the only writer)', async () => {
    globalThis.fetch = okFetch(CONNECTED) as unknown as typeof fetch;
    const { result } = renderHook(() => useUE5Connection());

    await act(async () => { await result.current.connect(); });

    // The server DID report connected, but the store waits for the stream —
    // a second writer would race the frames and could re-apply a stale one.
    expect(useUE5BridgeStore.getState().connectionState.status).toBe('disconnected');
  });
});

describe('useUE5Connection — one stream per tab, not one per mount', () => {
  it('two mounts share a single EventSource, closed only when the last releases it', () => {
    const first = renderHook(() => useUE5Connection());
    const second = renderHook(() => useUE5Connection());

    expect(FakeEventSource.instances).toHaveLength(1);
    const stream = latestStream();

    first.unmount();
    expect(stream.closed).toBe(false); // the console (say) still holds it

    second.unmount();
    expect(stream.closed).toBe(true);
  });

  it('a mount arriving after the first frame inherits live state', () => {
    const first = renderHook(() => useUE5Connection());
    act(() => { latestStream().push(CONNECTED); });

    const late = renderHook(() => useUE5Connection());

    // No second stream, and no false "Checking…" — with one shared stream the
    // next frame could be minutes away, so liveness must be shared too.
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(late.result.current.isStateLive).toBe(true);
    expect(late.result.current.isConnected).toBe(true);
    expect(first.result.current.isStateLive).toBe(true);
  });

  it('forgets liveness when the last mount goes, so a fresh mount must earn it', () => {
    const first = renderHook(() => useUE5Connection());
    act(() => { latestStream().push(CONNECTED); });
    first.unmount();

    const next = renderHook(() => useUE5Connection());

    // A new stream, and nothing observed on it yet: the store still holds the
    // old snapshot, but we no longer KNOW it is current.
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(next.result.current.isStateLive).toBe(false);
  });

  it('auto-connects once for the tab, not once per mounted surface', async () => {
    const fetchMock = okFetch(DISCONNECTED);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    useUE5BridgeStore.setState({ autoConnect: true });

    renderHook(() => useUE5Connection());
    renderHook(() => useUE5Connection());

    await act(async () => { latestStream().push(DISCONNECTED); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('useUE5Connection — actions go over the wire', () => {
  it('connect() posts action "connect" with the store host/port', async () => {
    const fetchMock = okFetch(DISCONNECTED);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    useUE5BridgeStore.setState({ host: '10.0.0.5', httpPort: 30011 });

    const { result } = renderHook(() => useUE5Connection());
    await act(async () => { await result.current.connect(); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ue5-bridge/query');
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'connect', host: '10.0.0.5', httpPort: 30011,
    });
  });

  it('executeConsoleCommand() posts action "consoleCommand" and returns a Result', async () => {
    const fetchMock = okFetch({ command: 'stat fps', executed: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useUE5Connection());
    let outcome: { ok: boolean } | undefined;
    await act(async () => { outcome = await result.current.executeConsoleCommand('stat fps'); });

    expect(outcome?.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'consoleCommand', command: 'stat fps',
    });
  });

  it('surfaces the route error instead of swallowing it', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ success: false, error: 'Not connected to UE5. Call "connect" first.' }),
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUE5Connection());
    const outcome = await result.current.executeConsoleCommand('stat fps');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain('Not connected to UE5');
  });

  it('auto-connects only after the first SSE frame proves the server is idle', async () => {
    const fetchMock = okFetch(DISCONNECTED);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    useUE5BridgeStore.setState({ autoConnect: true });

    renderHook(() => useUE5Connection());
    // No frame yet — the store's 'disconnected' is a guess, so we don't act on it.
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => { latestStream().push(CONNECTED); });
    // Server is already connected: nothing to do.
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => { latestStream().push(DISCONNECTED); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).action)
      .toBe('connect');
  });
});

describe('client/server singleton split is deliberate and loud', () => {
  it('getClient() on a browser instance returns null and says why', () => {
    // jsdom => `window` is defined => this module instance is the phantom one.
    expect(ue5Connection.getClient()).toBeNull();
  });
});
