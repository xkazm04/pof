import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { BLENDER_RETRY_MAX_ATTEMPTS } from '@/lib/blender-mcp/diagnostics';
import { UI_TIMEOUTS } from '@/lib/constants';

type FetchResult = { json: () => Promise<unknown> };

function mockFetch(impl: () => Promise<FetchResult>) {
  global.fetch = vi.fn(impl) as unknown as typeof fetch;
}

const okConnection = (connected: boolean) => async () => ({
  json: async () => ({
    success: true,
    data: { connection: { host: 'localhost', port: 9876, connected } },
  }),
});

const failConnection = (error: string) => async () => ({
  json: async () => ({ success: false, error }),
});

const ECONNREFUSED = 'Connection failed: connect ECONNREFUSED 127.0.0.1:9876';

function resetStore() {
  useBlenderMCPStore.setState({
    host: 'localhost',
    port: 9876,
    autoConnect: false,
    connection: { host: 'localhost', port: 9876, connected: false },
    isConnecting: false,
    lastError: null,
    recentScreenshots: [],
    retryAttempt: 0,
    autoRetrying: false,
    autoConnectAttempted: false,
  });
}

beforeEach(() => {
  // Clear any timer the previous test left scheduled.
  useBlenderMCPStore.getState().cancelRetry();
  useBlenderMCPStore.getState().stopHealthCheck();
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('blenderMCPStore — autoConnect preference', () => {
  it('setAutoConnect persists the flag without touching host/port', () => {
    useBlenderMCPStore.setState({ host: 'remote', port: 5000 });
    useBlenderMCPStore.getState().setAutoConnect(true);
    const s = useBlenderMCPStore.getState();
    expect(s.autoConnect).toBe(true);
    expect(s.host).toBe('remote');
    expect(s.port).toBe(5000);
  });

  it('maybeAutoConnect connects once when autoConnect is on and idle', async () => {
    mockFetch(okConnection(true));
    useBlenderMCPStore.setState({ autoConnect: true, autoConnectAttempted: false });

    useBlenderMCPStore.getState().maybeAutoConnect();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // A second mount must not kick another connection.
    useBlenderMCPStore.getState().maybeAutoConnect();
    await Promise.resolve();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('maybeAutoConnect does nothing when autoConnect is off', async () => {
    mockFetch(okConnection(true));
    useBlenderMCPStore.setState({ autoConnect: false, autoConnectAttempted: false });

    useBlenderMCPStore.getState().maybeAutoConnect();
    await Promise.resolve();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('blenderMCPStore — auto-retry with backoff', () => {
  it('schedules a backoff retry after a failed connect when autoConnect is on', async () => {
    vi.useFakeTimers();
    mockFetch(failConnection(ECONNREFUSED));
    useBlenderMCPStore.setState({ autoConnect: true });

    await useBlenderMCPStore.getState().connect();

    expect(useBlenderMCPStore.getState().autoRetrying).toBe(true);
    expect(useBlenderMCPStore.getState().connection.connected).toBe(false);
    expect(useBlenderMCPStore.getState().lastError).toContain('ECONNREFUSED');

    // The scheduled retry succeeds → connected, retry state cleared.
    mockFetch(okConnection(true));
    await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.blenderReconnectBase);

    expect(useBlenderMCPStore.getState().connection.connected).toBe(true);
    expect(useBlenderMCPStore.getState().autoRetrying).toBe(false);
    expect(useBlenderMCPStore.getState().retryAttempt).toBe(0);
  });

  it('does not retry a failed connect when autoConnect is off', async () => {
    vi.useFakeTimers();
    mockFetch(failConnection(ECONNREFUSED));
    useBlenderMCPStore.setState({ autoConnect: false });

    await useBlenderMCPStore.getState().connect();
    expect(useBlenderMCPStore.getState().autoRetrying).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after the maximum number of retry attempts', async () => {
    vi.useFakeTimers();
    mockFetch(failConnection(ECONNREFUSED));
    useBlenderMCPStore.setState({ autoConnect: true });

    await useBlenderMCPStore.getState().connect();

    // Drain every scheduled retry (cap each wait at the max delay).
    for (let i = 0; i <= BLENDER_RETRY_MAX_ATTEMPTS + 1; i++) {
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.blenderReconnectMax);
    }

    expect(useBlenderMCPStore.getState().autoRetrying).toBe(false);
    expect(useBlenderMCPStore.getState().retryAttempt).toBe(BLENDER_RETRY_MAX_ATTEMPTS);
    expect(useBlenderMCPStore.getState().connection.connected).toBe(false);
    // initial attempt + MAX retries
    expect(global.fetch).toHaveBeenCalledTimes(BLENDER_RETRY_MAX_ATTEMPTS + 1);
  });

  it('disconnect cancels a pending retry', async () => {
    vi.useFakeTimers();
    mockFetch(failConnection(ECONNREFUSED));
    useBlenderMCPStore.setState({ autoConnect: true });

    await useBlenderMCPStore.getState().connect();
    expect(useBlenderMCPStore.getState().autoRetrying).toBe(true);

    await useBlenderMCPStore.getState().disconnect();
    expect(useBlenderMCPStore.getState().autoRetrying).toBe(false);
    expect(useBlenderMCPStore.getState().retryAttempt).toBe(0);

    const callsAfterDisconnect = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsAfterDisconnect,
    );
  });

  it('cancelRetry clears the retry state', async () => {
    vi.useFakeTimers();
    mockFetch(failConnection(ECONNREFUSED));
    useBlenderMCPStore.setState({ autoConnect: true });

    await useBlenderMCPStore.getState().connect();
    expect(useBlenderMCPStore.getState().autoRetrying).toBe(true);

    useBlenderMCPStore.getState().cancelRetry();
    expect(useBlenderMCPStore.getState().autoRetrying).toBe(false);
    expect(useBlenderMCPStore.getState().retryAttempt).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

/**
 * Forced-failure block for `blender-bridge-status-is-not-a-probe`.
 *
 * At HEAD~1 `ensureHealthCheck` was `if (get().connection.connected && !healthTimer)`,
 * and `merge` resets `connection` to INITIAL_CONNECTION on every rehydration —
 * so the guard was ALWAYS false on mount and the bar read "Disconnected" over a
 * live bridge until the user clicked Connect (which destroys and rebuilds a
 * working socket). And `refreshStatus` bailed on `if (!result.ok) return`,
 * leaving the previous "Connected" pill on screen with every Produce gate open.
 */
describe('blenderMCPStore — the mount probe and the no-stale-Connected rule', () => {
  const statusReply = (connection: Record<string, unknown>) => async () => ({
    json: async () => ({ success: true, data: { connection } }),
  });

  it('adopts a live bridge on mount, without the user clicking Connect', async () => {
    mockFetch(
      statusReply({
        host: 'localhost',
        port: 9876,
        connected: true,
        lastProbeAt: 123,
      }),
    );

    useBlenderMCPStore.getState().ensureHealthCheck();
    await new Promise((r) => setTimeout(r, 0));

    expect(useBlenderMCPStore.getState().connection.connected).toBe(true);
    const body = JSON.parse(
      String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body),
    );
    expect(body.action).toBe('status');
  });

  it('does not fire a mount probe while a connect is already in flight', async () => {
    mockFetch(statusReply({ host: 'localhost', port: 9876, connected: true }));
    useBlenderMCPStore.setState({ isConnecting: true });

    useBlenderMCPStore.getState().ensureHealthCheck();
    await new Promise((r) => setTimeout(r, 0));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces the probe reason instead of leaving a stale Connected', async () => {
    useBlenderMCPStore.setState({
      connection: { host: 'localhost', port: 9876, connected: true },
    });
    mockFetch(
      statusReply({
        host: 'localhost',
        port: 9876,
        connected: false,
        lastProbeError: 'Command timed out — connection reset to avoid response desync',
      }),
    );

    await useBlenderMCPStore.getState().refreshStatus();

    const s = useBlenderMCPStore.getState();
    expect(s.connection.connected).toBe(false);
    expect(s.lastError).toMatch(/timed out/i);
  });

  it('drops the Connected claim when the status request itself fails', async () => {
    useBlenderMCPStore.setState({
      connection: { host: 'localhost', port: 9876, connected: true },
    });
    mockFetch(failConnection('Blender MCP request failed'));

    await useBlenderMCPStore.getState().refreshStatus();

    const s = useBlenderMCPStore.getState();
    // We could not even ASK — so we must not keep claiming the bridge is live.
    expect(s.connection.connected).toBe(false);
    expect(s.lastError).toContain('Blender MCP request failed');
  });

  it('clears a previous failure reason once a probe answers again', async () => {
    useBlenderMCPStore.setState({ lastError: 'Command timed out' });
    mockFetch(statusReply({ host: 'localhost', port: 9876, connected: true }));

    await useBlenderMCPStore.getState().refreshStatus();

    expect(useBlenderMCPStore.getState().lastError).toBeNull();
    useBlenderMCPStore.getState().stopHealthCheck();
  });
});

/**
 * `disconnect` used to ignore its own result: a refused request (operator guard 403, a
 * route 500) still flipped the pill to "Disconnected" and cleared `lastError`, while the
 * server kept the socket open and kept accepting `execute`. The client claimed a state the
 * server never reached, and said nothing about why.
 */
describe('blenderMCPStore — a refused disconnect is not a disconnect', () => {
  it('keeps the live connection and surfaces the refusal reason', async () => {
    useBlenderMCPStore.setState({
      connection: { host: 'localhost', port: 9876, connected: true },
    });
    mockFetch(failConnection('Operator token required'));

    await useBlenderMCPStore.getState().disconnect();

    const s = useBlenderMCPStore.getState();
    expect(s.connection.connected).toBe(true);
    expect(s.lastError).toContain('Operator token required');
    useBlenderMCPStore.getState().stopHealthCheck();
  });

  it('adopts the server-reported connection on a successful disconnect', async () => {
    useBlenderMCPStore.setState({
      connection: { host: 'localhost', port: 9876, connected: true },
      lastError: 'old',
    });
    mockFetch(okConnection(false));

    await useBlenderMCPStore.getState().disconnect();

    const s = useBlenderMCPStore.getState();
    expect(s.connection.connected).toBe(false);
    expect(s.lastError).toBeNull();
  });
});

/**
 * Generation fence. A liveness probe (or a connect) still in flight when the user clicks
 * Disconnect used to land AFTER the disconnect: it wrote `connected: true` back over the
 * fresh "Disconnected" and re-armed the probe interval, so the pill lied for a full
 * health-check period. A response that belongs to an earlier generation is dropped now.
 */
describe('blenderMCPStore — a late response never overwrites a disconnect', () => {
  function deferredThenOk() {
    let release: (v: FetchResult) => void = () => {};
    const pending = new Promise<FetchResult>((r) => {
      release = r;
    });
    let call = 0;
    mockFetch(() => {
      call += 1;
      return call === 1 ? pending : okConnection(false)();
    });
    return (connected: boolean) =>
      release({
        json: async () => ({
          success: true,
          data: { connection: { host: 'localhost', port: 9876, connected } },
        }),
      });
  }

  it('drops an in-flight status probe that resolves after disconnect', async () => {
    useBlenderMCPStore.setState({
      connection: { host: 'localhost', port: 9876, connected: true },
    });
    const resolveProbe = deferredThenOk();

    const probe = useBlenderMCPStore.getState().refreshStatus();
    await useBlenderMCPStore.getState().disconnect();
    resolveProbe(true);
    await probe;

    expect(useBlenderMCPStore.getState().connection.connected).toBe(false);
  });

  it('drops an in-flight connect that resolves after disconnect', async () => {
    const resolveConnect = deferredThenOk();

    const connecting = useBlenderMCPStore.getState().connect();
    await useBlenderMCPStore.getState().disconnect();
    resolveConnect(true);
    await connecting;

    const s = useBlenderMCPStore.getState();
    expect(s.connection.connected).toBe(false);
    expect(s.isConnecting).toBe(false);
  });
});

describe('blenderMCPStore - a connect target the route always refuses', () => {
  const REFUSAL = 'host must be a loopback address (localhost, 127.0.0.1 or ::1)';

  it('makes at most one request and never retries a non-loopback host under autoConnect', async () => {
    vi.useFakeTimers();
    mockFetch(failConnection(REFUSAL));
    useBlenderMCPStore.setState({ autoConnect: true, host: '192.168.1.5' });

    await useBlenderMCPStore.getState().connect();
    for (let i = 0; i < BLENDER_RETRY_MAX_ATTEMPTS + 1; i++) {
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.blenderReconnectMax);
    }

    expect((global.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeLessThanOrEqual(1);
    const s = useBlenderMCPStore.getState();
    expect(s.autoRetrying).toBe(false);
    expect(s.lastError).toBe(REFUSAL);
  });

  it('refuses a NaN port without a request and without a retry', async () => {
    vi.useFakeTimers();
    mockFetch(failConnection('unused'));
    useBlenderMCPStore.setState({ autoConnect: true });

    await useBlenderMCPStore.getState().connect('localhost', Number('abc'));
    await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.blenderReconnectMax * 2);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(useBlenderMCPStore.getState().lastError).toMatch(/port must be an integer/);
  });
});
