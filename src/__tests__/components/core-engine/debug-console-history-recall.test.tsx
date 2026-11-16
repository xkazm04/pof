import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ConsoleSection } from '@/components/modules/core-engine/sub_debug/console/ConsoleSection';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { UE5ConnectionState } from '@/types/ue5-bridge';

/**
 * scan-sweep night 2026-11-08 (debug-performance, bounty-hunter): a failed
 * CONNECT click is logged into the console history as a 'connect' entry, and
 * ArrowUp recall walked every non-pending entry - so the UI action came back
 * as if it were a typed command, and Enter would send `connect` to UE5.
 */

afterEach(cleanup);

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() {}
  push(state: UE5ConnectionState) { this.onmessage?.({ data: JSON.stringify(state) }); }
}

const DISCONNECTED: UE5ConnectionState = {
  status: 'disconnected', info: null, error: null, lastConnected: null, reconnectAttempts: 0,
};

beforeEach(() => {
  FakeEventSource.instances = [];
  (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  Element.prototype.scrollIntoView = vi.fn();
  useUE5BridgeStore.setState({ connectionState: { ...DISCONNECTED }, autoConnect: false });
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false, status: 502,
    json: () => Promise.resolve({ success: false, error: 'ECONNREFUSED 127.0.0.1:30010' }),
    text: () => Promise.resolve(''),
  }) as unknown as typeof fetch;
});

function input(): HTMLInputElement {
  return screen.getByPlaceholderText('Type a console command...') as HTMLInputElement;
}

describe('ConsoleSection history recall', () => {
  it('ArrowUp recalls typed commands only, never the CONNECT action log line', async () => {
    render(<ConsoleSection />);
    await act(async () => { FakeEventSource.instances.at(-1)!.push(DISCONNECTED); });

    await act(async () => {
      fireEvent.change(input(), { target: { value: 'stat fps' } });
      fireEvent.keyDown(input(), { key: 'Enter' });
    });
    await act(async () => { fireEvent.click(screen.getByTitle('Connect the server to UE5 Remote Control')); });
    // The failed connect is shown in the log ...
    expect(document.body.textContent).toContain('ECONNREFUSED');

    // ... but recall skips it: the newest typed command is 'stat fps'.
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(input().value).toBe('stat fps');
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(input().value).toBe('stat fps');
  });
});
