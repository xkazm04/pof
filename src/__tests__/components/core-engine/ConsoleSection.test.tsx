/**
 * The interactive console used to answer every command with
 * "UE5 not connected — command queued locally": flagged as an error AND
 * promising a retry queue that does not exist. It also read a browser-bundle
 * copy of the server-owned connection manager, so it could never be connected.
 *
 * These tests pin the honest replacement: it reports plainly that the command
 * was not sent, and when the live SSE transport says the server IS connected it
 * dispatches through the API route instead of a phantom singleton.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ConsoleSection } from '@/components/modules/core-engine/sub_debug/console/ConsoleSection';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { UE5ConnectionState } from '@/types/ue5-bridge';

// setup.ts installs no auto-cleanup — see reference_test_no_autocleanup.
afterEach(cleanup);

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() { this.closed = true; }
  push(state: UE5ConnectionState) { this.onmessage?.({ data: JSON.stringify(state) }); }
}

const CONNECTED: UE5ConnectionState = {
  status: 'connected',
  info: { version: '5.8.0', serverName: 'PoFEditor' },
  error: null,
  lastConnected: '2026-08-18T00:00:00.000Z',
  reconnectAttempts: 0,
};

const DISCONNECTED: UE5ConnectionState = {
  status: 'disconnected', info: null, error: null, lastConnected: null, reconnectAttempts: 0,
};

let fetchMock: ReturnType<typeof vi.fn>;

function stream(): FakeEventSource {
  const es = FakeEventSource.instances.at(-1);
  if (!es) throw new Error('console did not open an SSE stream');
  return es;
}

function typeCommand(text: string) {
  const input = screen.getByPlaceholderText('Type a console command...');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  // jsdom implements no scrollIntoView — see reference_jsdom_no_scrollintoview.
  Element.prototype.scrollIntoView = vi.fn();
  useUE5BridgeStore.setState({ connectionState: { ...DISCONNECTED }, autoConnect: false });
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: { command: 'stat fps', executed: true } }),
    text: () => Promise.resolve(''),
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('ConsoleSection — tells the truth when not connected', () => {
  it('says the command was NOT SENT, and never claims it was queued', async () => {
    render(<ConsoleSection />);
    await act(async () => { stream().push(DISCONNECTED); });

    await act(async () => { typeCommand('stat fps'); });

    const output = screen.getByText(/Not sent/i);
    expect(output.textContent).toContain('not connected');
    expect(output.textContent).toContain('not queued');
    // The specific lie this direction removes.
    expect(document.body.textContent).not.toContain('queued locally');
  });

  it('does not dispatch anything to the server when not connected', async () => {
    render(<ConsoleSection />);
    await act(async () => { stream().push(DISCONNECTED); });

    await act(async () => { typeCommand('stat fps'); });

    const consoleCalls = fetchMock.mock.calls.filter(
      ([, init]) => String((init as RequestInit | undefined)?.body ?? '').includes('consoleCommand'),
    );
    expect(consoleCalls).toHaveLength(0);
  });

  it('offers a CONNECT action once the live stream reports the server is idle', async () => {
    render(<ConsoleSection />);
    // Before the first frame the status is unknown — no false "Offline".
    expect(screen.queryByTitle('Connect the server to UE5 Remote Control')).toBeNull();
    expect(document.body.textContent).toContain('Checking');

    await act(async () => { stream().push(DISCONNECTED); });

    const button = screen.getByTitle('Connect the server to UE5 Remote Control');
    await act(async () => { fireEvent.click(button); });

    const connectCalls = fetchMock.mock.calls.filter(
      ([, init]) => String((init as RequestInit | undefined)?.body ?? '').includes('"connect"'),
    );
    expect(connectCalls).toHaveLength(1);
  });
});

describe('ConsoleSection — executes through the server when the transport says connected', () => {
  it('dispatches the command to /api/ue5-bridge/query and reports success', async () => {
    render(<ConsoleSection />);
    await act(async () => { stream().push(CONNECTED); });

    // The status strip reflects the SERVER state, delivered over SSE.
    expect(document.body.textContent).toContain('Connected');
    expect(screen.queryByTitle('Connect the server to UE5 Remote Control')).toBeNull();

    await act(async () => { typeCommand('stat fps'); });

    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe('/api/ue5-bridge/query');
    expect(JSON.parse(init.body as string)).toEqual({ action: 'consoleCommand', command: 'stat fps' });
    expect(screen.getByText('Executed: stat fps')).toBeTruthy();
  });

  it('surfaces the route\'s own reason when the command fails', async () => {
    render(<ConsoleSection />);
    await act(async () => { stream().push(CONNECTED); });

    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ success: false, error: 'UE5 Remote Control PUT /remote/object/call returned 500' }),
      text: () => Promise.resolve(''),
    });

    await act(async () => { typeCommand('badcmd'); });

    expect(screen.getByText(/returned 500/)).toBeTruthy();
    // No invented "queued" consolation prize on a real failure either.
    expect(document.body.textContent).not.toContain('queued');
  });
});
