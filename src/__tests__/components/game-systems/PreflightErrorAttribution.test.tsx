import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PreflightPanel } from '@/components/modules/game-systems/PreflightPanel';

function envelope(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** fast succeeds; build-verify-shipping fails with HTTP 500. */
function mockShippingFails() {
  const mock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const check = typeof init?.body === 'string' ? (JSON.parse(init.body).check as string) : 'fast';
    if (check === 'build-verify-shipping') {
      return Promise.resolve(envelope(500, { success: false, error: 'UAT exploded' }));
    }
    return Promise.resolve(envelope(200, {
      success: true,
      data: {
        overall: 'pass',
        results: [{ id: 'config-sanity', label: 'Config sanity', status: 'pass', detail: 'ok', issues: [] }],
      },
    }));
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(cleanup);

describe('PreflightPanel - failure attribution', () => {
  const props = { projectPath: 'C:\Proj\PoF', projectName: 'PoF', ueVersion: '5.7.0' };

  it('keeps a failed slow check on its own tile after Re-run', async () => {
    const fetchMock = mockShippingFails();
    render(<PreflightPanel {...props} />);
    await waitFor(() =>
      expect(screen.getByTestId('pof-preflight-check-config-sanity').getAttribute('data-status')).toBe('pass'),
    );

    fireEvent.click(screen.getByTestId('pof-preflight-run-shipping-build'));
    await waitFor(() => {
      const tile = screen.getByTestId('pof-preflight-check-build-verify-shipping');
      expect(tile.textContent).toContain('UAT exploded');
    });

    const fastCallsBefore = fetchMock.mock.calls.filter(([, i]) => String((i as RequestInit).body).includes('"check":"fast"')).length;
    fireEvent.click(screen.getByTestId('pof-preflight-rerun'));
    await waitFor(() => {
      const n = fetchMock.mock.calls.filter(([, i]) => String((i as RequestInit).body).includes('"check":"fast"')).length;
      expect(n).toBe(fastCallsBefore + 1);
    });
    await waitFor(() => expect(screen.getByTestId('pof-preflight-rerun').hasAttribute('disabled')).toBe(false));

    const tile = screen.getByTestId('pof-preflight-check-build-verify-shipping');
    expect(tile.textContent).toContain('UAT exploded');
  });
});
