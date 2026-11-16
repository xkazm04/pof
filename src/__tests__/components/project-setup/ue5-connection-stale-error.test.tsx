import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const { conn } = vi.hoisted(() => ({
  conn: {
    current: {
      status: 'disconnected',
      info: null,
      error: null as string | null,
      isConnected: false,
      isStateLive: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
  },
}));

vi.mock('@/hooks/useUE5Connection', () => ({ useUE5Connection: () => conn.current }));

import { UE5ConnectionPanel } from '@/components/modules/project-setup/UE5ConnectionPanel';

afterEach(cleanup);
beforeEach(() => {
  conn.current = { ...conn.current, status: 'disconnected', isConnected: false, error: null };
  conn.current.connect.mockResolvedValue({ ok: false, error: 'request never arrived' });
  conn.current.disconnect.mockResolvedValue({ ok: false, error: 'disconnect never arrived' });
});

const ERROR = 'pof-ue5-connection-error';

describe('UE5ConnectionPanel verb failure', () => {
  it('keeps a failed connect on screen while still disconnected', async () => {
    render(<UE5ConnectionPanel />);
    fireEvent.click(screen.getByTestId('pof-ue5-connection-action'));
    await waitFor(() => expect(screen.getByTestId(ERROR).textContent).toContain('never arrived'));
  });

  it('drops a failed connect once the stream reports connected', async () => {
    const { rerender } = render(<UE5ConnectionPanel />);
    fireEvent.click(screen.getByTestId('pof-ue5-connection-action'));
    await waitFor(() => expect(screen.getByTestId(ERROR)).toBeTruthy());

    conn.current = { ...conn.current, status: 'connected', isConnected: true };
    rerender(<UE5ConnectionPanel />);
    expect(screen.queryByTestId(ERROR)).toBeNull();
  });
});
