import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';
import { NightlyBuildScheduler } from '@/components/modules/game-systems/NightlyBuildScheduler';
import type { BuildProfile } from '@/lib/packaging/build-profiles';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';

const profile: BuildProfile = {
  ...createDefaultProfile('Win64', 'Shipping'),
  id: 'p-1',
  name: 'Win64 Shipping',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function statusBody(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      schedule: { enabled: false, time: '02:00', days: [], profileId: null, skipIfUnchanged: true, projectPath: '', projectName: '', ueVersion: '' },
      state: { lastRunAt: null, lastCommit: null, lastOutcome: null, lastReason: null, lastBuildId: null, lastDurationMs: null },
      running: false,
      describe: 'Scheduled builds off',
      nextRunAt: null,
      dueNow: false,
      currentHead: 'abc12345def6',
      ...overrides,
    },
  };
}

beforeEach(() => {
  mockFetchRoutes([{ match: '/api/packaging/schedule', response: { body: statusBody() } }]);
});
afterEach(cleanup);

describe('NightlyBuildScheduler', () => {
  it('renders the fetched schedule status', async () => {
    render(<NightlyBuildScheduler profiles={[profile]} />);
    // Wait on a value that only the FETCHED status carries: 'Scheduled builds off' is also the
    // placeholder shown before the fetch lands, so waiting on it resolved early under load.
    // current HEAD is shown short
    expect(await screen.findByText('abc12345')).toBeTruthy();
    expect(screen.getByText('Scheduled builds off')).toBeTruthy();
    // profile appears in the dropdown
    expect(screen.getByText('Win64 Shipping (Win64)')).toBeTruthy();
  });

  it('saves when the enable toggle is flipped', async () => {
    const fetchMock = mockFetchRoutes([{ match: '/api/packaging/schedule', response: { body: statusBody() } }]);
    render(<NightlyBuildScheduler profiles={[profile]} />);
    await waitFor(() => expect(screen.getByTestId('pof-nightly-enabled')).toBeTruthy());

    fireEvent.click(screen.getByTestId('pof-nightly-enabled'));

    await waitFor(() => {
      const savePost = fetchMock.mock.calls.find(([, init]) => {
        const body = (init as RequestInit | undefined)?.body;
        return typeof body === 'string' && body.includes('"action":"save"') && body.includes('"enabled":true');
      });
      expect(savePost).toBeTruthy();
    });
  });

  it('names every control: full weekday names with pressed state, time and profile labelled', async () => {
    mockFetchRoutes([{
      match: '/api/packaging/schedule',
      response: { body: statusBody({ schedule: { enabled: true, time: '02:00', days: [1, 3], profileId: null, skipIfUnchanged: true, projectPath: '', projectName: '', ueVersion: '' } }) },
    }]);
    render(<NightlyBuildScheduler profiles={[profile]} />);
    await screen.findByText('abc12345');
    // The visible letters repeat (S/S, T/T) - the accessible names must not.
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const [day, name] of names.entries()) {
      const btn = screen.getByRole('button', { name });
      expect(btn.getAttribute('aria-pressed')).toBe(day === 1 || day === 3 ? 'true' : 'false');
    }
    expect(screen.getByLabelText('Build time')).toBe(screen.getByTestId('pof-nightly-time'));
    expect(screen.getByLabelText('Build profile')).toBe(screen.getByTestId('pof-nightly-profile'));
  });

  describe('weekday toggles', () => {
    /** The `days` array of every save POST, in order. */
    function savedDays(fetchMock: ReturnType<typeof mockFetchRoutes>): number[][] {
      return fetchMock.mock.calls
        .map(([, init]) => (init as RequestInit | undefined)?.body)
        .filter((b): b is string => typeof b === 'string' && b.includes('"action":"save"'))
        .map((b) => (JSON.parse(b) as { days?: number[] }).days)
        .filter((d): d is number[] => Array.isArray(d));
    }
    async function renderWithDays(days: number[]) {
      const fetchMock = mockFetchRoutes([{
        match: '/api/packaging/schedule',
        response: { body: statusBody({ schedule: { enabled: true, time: '02:00', days, profileId: null, skipIfUnchanged: true, projectPath: '', projectName: '', ueVersion: '' } }) },
      }]);
      render(<NightlyBuildScheduler profiles={[profile]} />);
      await screen.findByText('abc12345');
      return fetchMock;
    }

    it('turning one day OFF from "every day" keeps the other six', async () => {
      const fetchMock = await renderWithDays([]);
      // Every button reads ON (empty days = every day); pressing Monday turns Monday off.
      fireEvent.click(screen.getByTestId('pof-nightly-day-1'));
      await waitFor(() => expect(savedDays(fetchMock)).toEqual([[0, 2, 3, 4, 5, 6]]));
    });

    it('turning OFF the only selected day does not widen the schedule to every day', async () => {
      const fetchMock = await renderWithDays([3]);
      fireEvent.click(screen.getByTestId('pof-nightly-day-3'));
      // Nothing saved: an empty list would mean "every day", the opposite of the press.
      await new Promise((r) => setTimeout(r, 20));
      expect(savedDays(fetchMock)).toEqual([]);
    });

    it('selecting the seventh day normalizes to every day', async () => {
      const fetchMock = await renderWithDays([0, 1, 2, 3, 4, 5]);
      fireEvent.click(screen.getByTestId('pof-nightly-day-6'));
      await waitFor(() => expect(savedDays(fetchMock)).toEqual([[]]));
    });
  });
});
