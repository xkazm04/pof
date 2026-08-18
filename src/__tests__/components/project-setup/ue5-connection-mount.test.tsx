/**
 * Project Setup is the app's authoritative mount of the live UE5 Remote
 * Control stream.
 *
 * The product's own copy — `/api/ue5-inject-item`'s 503 text and the affix
 * workbench's "Send to UE5" tooltip — tells the user to "Connect via Project
 * Setup first". Before this panel, the only mount of `useUE5Connection` was
 * inside the debug console, so `connectionState` could only reach 'connected'
 * while that unrelated panel happened to be open. These tests pin the fix:
 *
 *   1. The affix-workbench inject gate opens from the Project Setup mount
 *      ALONE — no debug console anywhere in the tree.
 *   2. The control says `Checking…` until a real frame arrives, and offers no
 *      action it has not been told is possible.
 *   3. Project Setup + the debug console mounted together hold ONE
 *      EventSource, not one each.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { UE5ConnectionPanel } from '@/components/modules/project-setup/UE5ConnectionPanel';
import { ConsoleSection } from '@/components/modules/core-engine/sub_debug/console/ConsoleSection';
import { useExportActions } from '@/components/modules/core-engine/sub_loot/affix-workbench/useExportActions';
import { ITEM_BASES } from '@/components/modules/core-engine/sub_loot/affix-workbench/data';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { UE5ConnectionState } from '@/types/ue5-bridge';

// setup.ts installs no auto-cleanup — see reference_test_no_autocleanup.
afterEach(cleanup);

// jsdom has no scrollIntoView; ConsoleSection calls it on mount.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

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

function onlyStream(): FakeEventSource {
  const es = FakeEventSource.instances.at(-1);
  if (!es) throw new Error('Project Setup did not open an SSE stream');
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

/**
 * Reads the REAL gate the affix workbench's "Send to UE5" button is disabled
 * on (`WorkbenchHeader` → `ue5Status !== 'connected'`), so this test can only
 * pass if the store the workbench reads actually reached 'connected'.
 */
function InjectGateProbe() {
  const { ue5Status } = useExportActions(ITEM_BASES[0], [], 20);
  return (
    <button data-testid="probe-inject" disabled={ue5Status !== 'connected'}>
      Send to UE5
    </button>
  );
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

describe('Project Setup mounts the live UE5 connection', () => {
  it('opens the affix-workbench inject gate on its own — no debug console mounted', () => {
    render(<><UE5ConnectionPanel /><InjectGateProbe /></>);

    // The gate the workbench reads starts shut, and nothing but a real frame
    // may open it.
    expect(screen.getByTestId('probe-inject').hasAttribute('disabled')).toBe(true);

    act(() => { onlyStream().push(CONNECTED); });

    // This is the assertion the direction exists for: the surface the copy
    // points at is the surface that makes the gate reachable.
    expect(screen.getByTestId('probe-inject').hasAttribute('disabled')).toBe(false);
    expect(useUE5BridgeStore.getState().connectionState.status).toBe('connected');
  });

  it('control: the workbench alone opens no stream and stays gated shut', () => {
    // Without a mount of the hook, nothing subscribes — this is the exact
    // state the app was in whenever the debug console was closed.
    render(<InjectGateProbe />);

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(screen.getByTestId('probe-inject').hasAttribute('disabled')).toBe(true);
  });

  it('subscribes on mount and releases the stream on unmount', () => {
    const { unmount } = render(<UE5ConnectionPanel />);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(onlyStream().url).toBe('/api/ue5-bridge/status');

    const stream = onlyStream();
    unmount();
    expect(stream.closed).toBe(true);
  });
});

describe('the control never claims a state it was not told', () => {
  it('shows "Checking…" and offers no action before the first frame', () => {
    render(<UE5ConnectionPanel />);

    expect(screen.getByText('Checking…')).toBeTruthy();
    // The store's pre-stream default is 'disconnected' — a guess. Neither it
    // nor a CONNECT affordance may be shown as though it were an observation.
    expect(screen.queryByText('Offline')).toBeNull();
    expect(screen.queryByText('Connected')).toBeNull();
    expect(screen.queryByTestId('pof-ue5-connection-action')).toBeNull();
  });

  it('reports Connected and offers Disconnect only after a connected frame', () => {
    render(<UE5ConnectionPanel />);
    act(() => { onlyStream().push(CONNECTED); });

    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByTestId('pof-ue5-connection-action').textContent).toContain('Disconnect');
  });

  it('offers Connect once a frame proves the server is idle', async () => {
    const fetchMock = okFetch(DISCONNECTED);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<UE5ConnectionPanel />);
    act(() => { onlyStream().push(DISCONNECTED); });

    const action = screen.getByTestId('pof-ue5-connection-action');
    expect(action.textContent).toContain('Connect to UE5');

    fireEvent.click(action);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ue5-bridge/query');
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'connect', host: '127.0.0.1', httpPort: 30010,
    });
    // The POST said nothing about the store — the SSE frame is the only writer.
    expect(useUE5BridgeStore.getState().connectionState.status).toBe('disconnected');
  });

  it('surfaces a failed connect verb instead of silently doing nothing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ success: false, error: 'UE5 editor is not reachable on 30010' }),
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;

    render(<UE5ConnectionPanel />);
    act(() => { onlyStream().push(DISCONNECTED); });
    fireEvent.click(screen.getByTestId('pof-ue5-connection-action'));

    const banner = await screen.findByTestId('pof-ue5-connection-error');
    expect(banner.textContent).toContain('not reachable on 30010');
  });

  it('stops showing Connected when the stream drops', () => {
    render(<UE5ConnectionPanel />);
    act(() => { onlyStream().push(CONNECTED); });
    expect(screen.getByText('Connected')).toBeTruthy();

    act(() => { onlyStream().drop(); });

    expect(screen.queryByText('Connected')).toBeNull();
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
  });
});

describe('two mounted surfaces, one stream', () => {
  it('Project Setup + the debug console share a single EventSource', () => {
    render(<><UE5ConnectionPanel /><ConsoleSection /></>);

    // The bound is the point: adding this mount must not double the app's
    // open SSE connections.
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('the console inherits liveness from the frame Project Setup already saw', () => {
    const { rerender } = render(<UE5ConnectionPanel />);
    act(() => { onlyStream().push(CONNECTED); });

    // The console mounts later — with a shared stream there may be no further
    // frame for minutes, so it must read the liveness already established
    // rather than sit on "Checking…".
    rerender(<><UE5ConnectionPanel /><ConsoleSection /></>);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(screen.queryByText('Checking…')).toBeNull();
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(1);
  });
});
