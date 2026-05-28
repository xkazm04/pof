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
    await waitFor(() => expect(screen.getByText('Scheduled builds off')).toBeTruthy());
    // current HEAD is shown short
    expect(screen.getByText('abc12345')).toBeTruthy();
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
});
