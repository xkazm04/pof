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
