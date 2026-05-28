import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  BridgeStatusIndicator,
  ConnectionStatusBadge,
  type ConnectionStatus,
} from '@/components/ui/BridgeStatusIndicator';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL, ACCENT_ORANGE,
} from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** JSDOM serializes inline `style` color values as `rgb(r, g, b)`; convert for matching. */
function hexToRgb(hex: string): string {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex: ${hex}`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

const STATUSES: ConnectionStatus[] = ['connected', 'connecting', 'reconnecting', 'disconnected', 'error'];

describe('BridgeStatusIndicator — single source of truth', () => {
  it('renders the default label from the status map for every status', () => {
    const expectedLabels: Record<ConnectionStatus, string> = {
      connected: 'Connected',
      connecting: 'Connecting…',
      reconnecting: 'Reconnecting…',
      disconnected: 'Offline',
      error: 'Error',
    };
    for (const status of STATUSES) {
      cleanup();
      render(<BridgeStatusIndicator status={status} />);
      expect(screen.getByRole('status').textContent).toContain(expectedLabels[status]);
    }
  });

  it('uses the chart-color token for each status (no hardcoded hex)', () => {
    const expectedColors: Record<ConnectionStatus, string> = {
      connected: STATUS_SUCCESS,
      connecting: ACCENT_ORANGE,
      reconnecting: ACCENT_ORANGE,
      disconnected: STATUS_NEUTRAL,
      error: STATUS_ERROR,
    };
    for (const status of STATUSES) {
      cleanup();
      render(<BridgeStatusIndicator status={status} />);
      const style = screen.getByRole('status').getAttribute('style') ?? '';
      expect(style).toContain(hexToRgb(expectedColors[status]));
    }
  });

  it('honors a label override', () => {
    render(<BridgeStatusIndicator status="connected" label="Bridge v1.2.3" />);
    expect(screen.getByRole('status').textContent).toContain('Bridge v1.2.3');
  });

  it('renders the count suffix when provided (panel variant)', () => {
    render(<BridgeStatusIndicator status="connected" count={42} />);
    expect(screen.getByRole('status').textContent).toContain('(42)');
  });

  it('topbar variant uses the same color tokens as panel via the shared map', () => {
    render(<BridgeStatusIndicator status="error" variant="topbar" label="Bridge err" />);
    const el = screen.getByRole('status');
    expect(el.textContent).toContain('Bridge err');
    expect(el.getAttribute('style') ?? '').toContain(hexToRgb(STATUS_ERROR));
  });

  it('strip variant accepts paletteOverride for lab-themed surfaces', () => {
    // eslint-disable-next-line no-restricted-syntax -- intentional lab-theme hex to verify the paletteOverride API
    const LAB_OK = '#2e7d4f';
    render(
      <BridgeStatusIndicator
        status="connected"
        variant="strip"
        label="UE 5.7 · PoF"
        paletteOverride={{ connected: LAB_OK }}
      />,
    );
    const el = screen.getByRole('status');
    expect(el.getAttribute('style') ?? '').toContain(hexToRgb(LAB_OK));
    expect(el.textContent).toContain('UE 5.7 · PoF');
  });

  it('exposes role=status with aria-live for screen readers', () => {
    render(<BridgeStatusIndicator status="connecting" />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('ConnectionStatusBadge alias renders the panel variant (backward compat)', () => {
    render(<ConnectionStatusBadge status="connected" count={7} />);
    const el = screen.getByRole('status');
    expect(el.textContent).toContain('Connected');
    expect(el.textContent).toContain('(7)');
    expect(el.getAttribute('style') ?? '').toContain(hexToRgb(STATUS_SUCCESS));
  });
});
