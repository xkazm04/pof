/**
 * A failed history read may not render as an empty history.
 *
 * The dashboard swallowed a fetch failure into console.error and kept `builds = []`,
 * so the History tab said "No builds recorded yet. Use "Record" to add your first
 * build." — a claim about the whole table made by a read that never landed
 * (law: failure-not-empty-success).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { BuildHistoryDashboard } from '@/components/modules/game-systems/BuildHistoryDashboard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function failingFetch() {
  return vi.fn().mockImplementation(() => {
    const body = { success: false, error: 'database is locked' };
    return Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
}

describe('BuildHistoryDashboard read failure', () => {
  it('says the read failed instead of "No builds recorded yet"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = failingFetch() as unknown as typeof fetch;
    const { container } = render(<BuildHistoryDashboard />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/database is locked/);
    expect(container.textContent ?? '').not.toContain('No builds recorded yet');
  });

  it('Retry re-reads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = failingFetch();
    globalThis.fetch = f as unknown as typeof fetch;
    render(<BuildHistoryDashboard />);
    await screen.findByRole('alert');
    const before = f.mock.calls.length;
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(f.mock.calls.length).toBeGreaterThan(before));
  });
});
