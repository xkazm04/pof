import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PreflightPanel } from '@/components/modules/game-systems/PreflightPanel';
import type { PreflightCheckResult, PreflightStatus } from '@/lib/packaging/preflight';

/** A fetch mock that returns a different result set per requested `check` kind. */
function mockPreflightByCheck() {
  const bodies: Record<string, { results: PreflightCheckResult[]; overall: PreflightStatus }> = {
    fast: {
      results: [{ id: 'config-sanity', label: 'Config sanity', status: 'pass', detail: 'ok', issues: [] }],
      overall: 'pass',
    },
    'asset-validation': {
      results: [{
        id: 'asset-validation',
        label: 'Asset validation',
        status: 'warn',
        detail: '0 errors, 1 warning in content validation.',
        issues: ['[warning] Redirector: Fixing up 2 redirectors'],
      }],
      overall: 'warn',
    },
  };
  const mock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const check = typeof init?.body === 'string' ? (JSON.parse(init.body).check as string) : 'fast';
    const body = { success: true, data: bodies[check] ?? bodies.fast };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(cleanup);

describe('PreflightPanel — asset-validation check', () => {
  const props = { projectPath: 'C:\\Proj\\PoF', projectName: 'PoF', ueVersion: '5.7.0' };

  it('renders the content-audit button', async () => {
    mockPreflightByCheck();
    render(<PreflightPanel {...props} />);
    await waitFor(() => expect(screen.getByTestId('pof-preflight-run-asset-validation')).toBeTruthy());
  });

  it('dispatches the asset-validation check and renders its tile', async () => {
    const fetchMock = mockPreflightByCheck();
    render(<PreflightPanel {...props} />);

    // Auto-run "fast" lands the config tile first.
    await waitFor(() => expect(screen.getByTestId('pof-preflight-check-config-sanity')).toBeTruthy());

    fireEvent.click(screen.getByTestId('pof-preflight-run-asset-validation'));

    // The POST carries the asset-validation kind...
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => {
        const body = (init as RequestInit | undefined)?.body;
        return typeof body === 'string' && body.includes('"check":"asset-validation"');
      });
      expect(post).toBeTruthy();
    });

    // ...and the returned tile renders with its warn status.
    await waitFor(() => {
      const tile = screen.getByTestId('pof-preflight-check-asset-validation');
      expect(tile.getAttribute('data-status')).toBe('warn');
    });
  });
});
