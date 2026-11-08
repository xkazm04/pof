/**
 * Ping All stays available while the store reads disconnected: the probes
 * classify editor-not-running / wrong-port / auth-rejected on their own, so a
 * misconfigured port can be diagnosed from the panel.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { BridgeEndpointHealth } from '@/components/modules/project-setup/BridgeEndpointHealth';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

class FakeWebSocket {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  constructor(public url: string) {
    setTimeout(() => this.onerror?.(), 0);
  }
  send() {}
  close() {}
}

beforeEach(() => {
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
  // Nothing listens on the configured port: every fetch is refused.
  globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
  useUE5BridgeStore.setState({ host: '127.0.0.1', wsPort: 30041, wsStatus: 'disconnected' });
});

afterEach(() => cleanup());

describe.each(['disconnected', 'error'] as const)('Ping All with the bridge reading %s', (status) => {
  it('is enabled and a refused port reports its ProbeFailureKind on a row', async () => {
    usePofBridgeStore.setState({ pofPort: 39999, pofAuthToken: '', connectionStatus: status });
    render(<BridgeEndpointHealth />);
    const btn = screen.getByTestId('bridge-ping-all-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => {
      const kinds = Array.from(document.querySelectorAll('[data-probe-kind]'))
        .map((el) => el.getAttribute('data-probe-kind'));
      expect(kinds.length).toBeGreaterThan(0);
    });
    const kind = document.querySelector('[data-probe-kind]')!.getAttribute('data-probe-kind');
    expect(kind).toBe('editor-not-running');
  });
});
