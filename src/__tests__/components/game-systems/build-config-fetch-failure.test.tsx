/**
 * A failed profiles read may not render as "No build profiles yet".
 *
 * Same defect as the history dashboard (fixed in the same context): fetchProfiles
 * swallowed the error into console.error, `profiles` stayed [], and the panel offered
 * "No build profiles yet" plus create buttons over profiles that may well exist.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/modules/game-systems/CookProgress', () => ({ CookProgress: () => null }));
vi.mock('@/components/modules/game-systems/SmokeTest', () => ({ SmokeTest: () => null }));
vi.mock('@/components/modules/game-systems/NightlyBuildScheduler', () => ({ NightlyBuildScheduler: () => null }));
vi.mock('@/components/modules/game-systems/GateNotifySettings', () => ({ GateNotifySettings: () => null }));
vi.mock('@/components/modules/game-systems/PreflightPanel', () => ({ PreflightPanel: () => null }));

import { BuildConfigSelector } from '@/components/modules/game-systems/BuildConfigSelector';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function failingFetch() {
  return vi.fn().mockImplementation(() => {
    const body = { success: false, error: 'profiles table unreadable' };
    return Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
}

describe('BuildConfigSelector profiles read failure', () => {
  it('says the read failed instead of "No build profiles yet"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = failingFetch() as unknown as typeof fetch;
    const { container } = render(<BuildConfigSelector />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/profiles table unreadable/);
    expect(container.textContent ?? '').not.toContain('No build profiles yet');
  });

  it('Retry re-reads the profiles', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = failingFetch();
    globalThis.fetch = f as unknown as typeof fetch;
    render(<BuildConfigSelector />);
    await screen.findByRole('alert');
    const before = f.mock.calls.length;
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(f.mock.calls.length).toBeGreaterThan(before));
  });
});
