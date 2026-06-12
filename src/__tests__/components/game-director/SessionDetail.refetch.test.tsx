import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SessionDetail } from '@/components/modules/game-director/SessionDetail';
import type { PlaytestSession } from '@/types/game-director';

const baseConfig = {
  testCategories: [],
  maxPlaytimeMinutes: 10,
  screenshotIntervalSeconds: 5,
  aggressiveMode: false,
  prioritySystems: [],
};

function session(over: Partial<PlaytestSession>): PlaytestSession {
  return {
    id: 's1', name: 'Run', status: 'playing', buildPath: '/x',
    createdAt: 't0', startedAt: 't0', completedAt: null, durationMs: null,
    config: baseConfig, summary: null, systemsTestedCount: 0, findingsCount: 0,
    ...over,
  };
}

describe('SessionDetail refetches when a playtest completes', () => {
  it('reloads findings/events when status + completedAt change (same session id)', async () => {
    const getFindings = vi.fn().mockResolvedValue([]);
    const getEvents = vi.fn().mockResolvedValue([]);
    const props = {
      onBack: () => {}, onSimulate: async () => {}, onDelete: async () => {},
      simulating: false, getFindings, getEvents,
      markFixDispatched: vi.fn(),
    };

    const { rerender } = render(<SessionDetail session={session({ status: 'playing' })} {...props} />);
    await waitFor(() => expect(getFindings).toHaveBeenCalledTimes(1));

    // The playtest finishes: same session.id, but status → complete and a
    // completedAt timestamp appears. The old [session.id, ...] deps never
    // refetched here.
    rerender(<SessionDetail session={session({ status: 'complete', completedAt: 't1', findingsCount: 12 })} {...props} />);
    await waitFor(() => expect(getFindings).toHaveBeenCalledTimes(2));
    expect(getEvents).toHaveBeenCalledTimes(2);
  });
});
