import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Control apiFetch per call: GET loads succeed; the POST (Analyze) rejects so we
// can assert the failure is surfaced instead of swallowed.
const h = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch: h.apiFetch };
});

import { RegressionTrackerView } from '@/components/modules/game-director/RegressionTrackerView';

describe('RegressionTrackerView surfaces action failures', () => {
  it('shows a retryable error banner when Analyze fails instead of failing silently', async () => {
    h.apiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (opts?.method === 'POST') return Promise.reject(new Error('Server exploded'));
      if (url.includes('action=stats')) {
        return Promise.resolve({
          totalTracked: 1, openCount: 1, fixedCount: 0, regressedCount: 0,
          resolvedCount: 0, activeAlerts: 0, regressionRate: 0,
        });
      }
      if (url.includes('action=sessions')) {
        return Promise.resolve([
          { id: 's1', name: 'Sess A', createdAt: new Date(0).toISOString(), status: 'complete' },
        ]);
      }
      return Promise.resolve([]); // fingerprints + alerts
    });

    render(<RegressionTrackerView />);

    // Wait for initial load, pick a session, then trigger the failing POST.
    const select = await screen.findByLabelText('Select session to analyze');
    fireEvent.change(select, { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));

    // The failure is surfaced with the server message + a Retry affordance.
    expect(await screen.findByText(/Server exploded/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
  });
});
