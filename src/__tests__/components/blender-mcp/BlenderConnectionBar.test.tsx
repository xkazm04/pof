import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

afterEach(cleanup);

/** The status envelope `POST /api/blender-mcp { action:'status' }` returns. */
function mockStatus(connection: Record<string, unknown>) {
  global.fetch = vi.fn(async () => ({
    json: async () => ({ success: true, data: { connection } }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  // The bar now probes the server on mount (it can no longer read a live bridge
  // off a store field that rehydration resets). Default every case to "the
  // bridge is down" so only the tests that care drive the probe.
  mockStatus({ host: '127.0.0.1', port: 9876, connected: false });
  useBlenderMCPStore.getState().stopHealthCheck();
  useBlenderMCPStore.setState({
    host: '127.0.0.1',
    port: 9876,
    autoConnect: false,
    connection: { host: '127.0.0.1', port: 9876, connected: false },
    isConnecting: false,
    lastError: null,
    recentScreenshots: [],
    retryAttempt: 0,
    autoRetrying: false,
    autoConnectAttempted: false,
  });
});

describe('BlenderConnectionBar — accessibility', () => {
  it('exposes the status pill as a polite live region with a descriptive label', () => {
    useBlenderMCPStore.setState({
      connection: { host: '127.0.0.1', port: 9876, connected: true },
    });
    render(<BlenderConnectionBar />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-label')).toMatch(/Blender MCP status: Connected$/);
  });

  it('never announces a Blender version, because the bridge cannot report one', () => {
    // This assertion used to read `/Connected.*4\.2/` against a `blenderVersion`
    // that NOTHING in the service ever wrote — the only "4.2" in the tree was
    // this fixture. The field is deleted rather than faked; if a real handshake
    // ever produces one, this test is the place that must change with it.
    useBlenderMCPStore.setState({
      connection: { host: '127.0.0.1', port: 9876, connected: true },
    });
    render(<BlenderConnectionBar />);
    expect(screen.getByRole('status').getAttribute('aria-label')).not.toMatch(/\d+\.\d+/);
  });

  it('announces error banners via role="alert"', () => {
    useBlenderMCPStore.setState({ lastError: 'Bridge unreachable' });
    render(<BlenderConnectionBar />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/Bridge unreachable/);
  });

  it('labels the Settings icon button with aria-label and applies the unified focus-ring', () => {
    render(<BlenderConnectionBar />);
    const settings = screen.getByRole('button', { name: /connection settings/i });
    expect(settings.className).toContain('focus-ring');
    expect(settings.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles aria-expanded on the Settings button when opening the panel', () => {
    render(<BlenderConnectionBar />);
    const settings = screen.getByRole('button', { name: /connection settings/i });
    fireEvent.click(settings);
    expect(settings.getAttribute('aria-expanded')).toBe('true');
  });

  it('labels the Connect button with a descriptive aria-label when idle', () => {
    render(<BlenderConnectionBar />);
    const connect = screen.getByRole('button', { name: /connect to blender mcp/i });
    expect(connect.className).toContain('focus-ring');
    expect(connect.hasAttribute('disabled')).toBe(false);
  });

  it('shows an explanatory title and waiting label on the Connect button while connecting', () => {
    useBlenderMCPStore.setState({ isConnecting: true });
    render(<BlenderConnectionBar />);
    const connect = screen.getByRole('button', { name: /connecting to blender mcp, please wait/i });
    expect(connect.hasAttribute('disabled')).toBe(true);
    expect(connect.getAttribute('title')).toMatch(/connecting/i);
  });

  it('relabels the Connect button as Disconnect when connected', () => {
    useBlenderMCPStore.setState({
      connection: { host: '127.0.0.1', port: 9876, connected: true },
    });
    render(<BlenderConnectionBar />);
    expect(screen.getByRole('button', { name: /disconnect from blender mcp/i })).toBeTruthy();
  });

  it('exposes host and port inputs with accessible names, ids, and focus-ring', () => {
    render(<BlenderConnectionBar />);
    fireEvent.click(screen.getByRole('button', { name: /connection settings/i }));

    const host = screen.getByLabelText(/blender mcp host/i) as HTMLInputElement;
    const port = screen.getByLabelText(/blender mcp port/i) as HTMLInputElement;

    expect(host.id).toBe('blender-mcp-host');
    expect(port.id).toBe('blender-mcp-port');
    expect(host.className).toContain('focus-ring');
    expect(port.className).toContain('focus-ring');
  });

  it('marks the decorative status dot as aria-hidden so screen readers do not double-announce', () => {
    render(<BlenderConnectionBar />);
    const status = screen.getByRole('status');
    const dot = status.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeTruthy();
  });
});

describe('BlenderConnectionBar — guided setup + auto-connect', () => {
  it('honors the persisted autoConnect flag by calling maybeAutoConnect on mount', () => {
    const spy = vi.fn();
    useBlenderMCPStore.setState({ maybeAutoConnect: spy as never });
    render(<BlenderConnectionBar />);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('replaces the raw error with a diagnosed failure mode and a Troubleshoot action', () => {
    useBlenderMCPStore.setState({
      lastError: 'Connection failed: connect ECONNREFUSED 127.0.0.1:9876',
    });
    render(<BlenderConnectionBar />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/isn't running/i);
    expect(screen.getByRole('button', { name: /troubleshoot/i })).toBeTruthy();
  });

  it('opens the setup wizard when Troubleshoot is clicked', () => {
    useBlenderMCPStore.setState({
      lastError: 'Connection failed: connect ECONNREFUSED 127.0.0.1:9876',
    });
    render(<BlenderConnectionBar />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /troubleshoot/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('exposes an auto-connect toggle in settings wired to setAutoConnect', () => {
    const spy = vi.fn();
    useBlenderMCPStore.setState({ setAutoConnect: spy as never });
    render(<BlenderConnectionBar />);
    fireEvent.click(screen.getByRole('button', { name: /connection settings/i }));
    const toggle = screen.getByRole('checkbox', {
      name: /auto-connect to blender mcp on launch/i,
    });
    fireEvent.click(toggle);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('shows Connected after mount, without the user clicking Connect', async () => {
    // RED at HEAD~1: `merge` resets `connection` on every rehydration and
    // `ensureHealthCheck` was gated on that reset copy, so a page reload showed
    // "Disconnected" over a live bridge — and the fix the user reaches for
    // (Connect) destroys and rebuilds a working socket.
    mockStatus({ host: '127.0.0.1', port: 9876, connected: true, lastProbeAt: 1 });
    render(<BlenderConnectionBar />);

    expect(screen.getByRole('status').getAttribute('aria-label')).toMatch(/Disconnected/);
    await waitFor(() =>
      expect(screen.getByRole('status').getAttribute('aria-label')).toMatch(/Connected/),
    );
    expect(screen.getByRole('button', { name: /disconnect from blender mcp/i })).toBeTruthy();
    useBlenderMCPStore.getState().stopHealthCheck();
  });

  it('reflects an active backoff retry in the status pill', () => {
    useBlenderMCPStore.setState({ autoRetrying: true, retryAttempt: 1 });
    render(<BlenderConnectionBar />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-label')).toMatch(/reconnecting/i);
  });
});
