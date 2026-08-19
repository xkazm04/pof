/**
 * Every simulated number in the Game Director UI must say it is simulated, and a
 * session a real harness measured must NOT be qualified as one.
 *
 * The external session here is built the way a real harness builds one — through
 * the writer API (`create` + `complete`) against a throwaway DB — and then
 * rendered. Nothing in the test hand-writes `source: 'external'` onto the object
 * the component receives.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-ui-provenance-${process.pid}.db`;
});

import { POST } from '@/app/api/game-director/route';
import { createSession, getSession } from '@/lib/game-director-db';
import { simulatePlaytest } from '@/lib/game-director-sim';
import { SessionDetail } from '@/components/modules/game-director/SessionDetail';
import { DirectorOverview } from '@/components/modules/game-director/DirectorOverview';
import type { DirectorStats } from '@/lib/game-director-db';
import type { PlaytestConfig, PlaytestSession, PlaytestSummary } from '@/types/game-director';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const config: PlaytestConfig = {
  testCategories: ['combat'],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

const detailProps = {
  onBack: () => {},
  onSimulate: async () => {},
  onDelete: async () => {},
  simulating: false,
  getFindings: vi.fn().mockResolvedValue([]),
  getEvents: vi.fn().mockResolvedValue([]),
  markFixDispatched: vi.fn(),
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A session the in-repo simulator produced. */
async function simulatedSession(id: string): Promise<PlaytestSession> {
  createSession(id, `Sim ${id}`, '/build', config);
  await simulatePlaytest(id, config);
  return getSession(id)!;
}

/** A session a real harness produced, written through the external writer API. */
async function harnessSession(name: string): Promise<PlaytestSession> {
  const created = await POST(post({
    action: 'create', name, buildPath: '/build', config, source: 'external',
  }));
  const { data } = await created.json() as { data: { id: string } };

  const summary: PlaytestSummary = {
    overallScore: 74,
    totalScreenshotsAnalyzed: 8,
    systemsTested: ['combat'],
    testCoverage: { combat: 81 } as PlaytestSummary['testCoverage'],
    topIssue: 'Boss arena frame hitch',
    topPraise: 'Dodge cancel window feels right',
    playtimeSeconds: 900,
  };
  await POST(post({
    action: 'complete',
    sessionId: data.id,
    summary,
    durationMs: 900_000,
    systemsTestedCount: 1,
    findingsCount: 0,
  }));
  return getSession(data.id)!;
}

describe('SessionDetail discloses where its numbers came from', () => {
  it('qualifies a simulated session: disclosure banner, qualified ring, "Simulate" wording', async () => {
    const session = await simulatedSession('ui-sim');
    render(<SessionDetail session={session} {...detailProps} />);

    // The banner states plainly that nothing was measured.
    expect(screen.getByText(/Simulated/).textContent).toBeTruthy();
    expect(
      screen.getByText(/no build was launched and nothing was measured/i),
    ).toBeTruthy();

    // The ring never announces a bare score for a number nothing measured.
    const ring = screen.getByRole('img', { name: /simulated score/i });
    expect(ring.getAttribute('aria-label')).toContain('not measured');
    expect(screen.queryByRole('img', { name: /^Score: \d+ out of 100$/ })).toBeNull();

    // The button runs the simulator and says so.
    // The session is already complete, so the action is the re-run form of it.
    expect(screen.getByText('Re-simulate')).toBeTruthy();
    expect(screen.queryByText('Re-run')).toBeNull();
    expect(screen.queryByText('Run Playtest')).toBeNull();

    // Figures the fixture cannot produce read as words, not as counts.
    expect(screen.getAllByText('Not measured').length).toBeGreaterThan(0);
  });

  it('leaves a harness-written session unqualified', async () => {
    const session = await harnessSession('Harness detail');
    render(<SessionDetail session={session} {...detailProps} />);

    const ring = screen.getByRole('img', { name: /74 out of 100, measured/ });
    expect(ring.getAttribute('aria-label')).not.toMatch(/simulated/i);
    expect(screen.queryByText(/no build was launched/i)).toBeNull();
    expect(screen.getByText(/written by a real playtest harness/i)).toBeTruthy();

    // Real measurements render as measurements.
    expect(screen.getByText('8')).toBeTruthy();     // screenshots analyzed
    expect(screen.getByText('15m')).toBeTruthy();   // playtime
    expect(screen.queryByText('Not measured')).toBeNull();
  });
});

describe('CoverageView refuses to draw a bar for an unmeasured category', () => {
  it('renders "Not measured" and no progressbar for the simulator, a bar for the harness', async () => {
    const sim = await simulatedSession('ui-sim-cov');
    const { container, unmount } = render(
      <SessionDetail session={sim} {...detailProps} />,
    );
    // Coverage lives behind its sub-tab.
    (await screen.findByText('Coverage')).click();
    await screen.findByText('Test Coverage by Category');
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0);
    expect(screen.getAllByText('Not measured').length).toBeGreaterThan(0);
    unmount();

    const real = await harnessSession('Harness coverage');
    render(<SessionDetail session={real} {...detailProps} />);
    (await screen.findByText('Coverage')).click();
    await screen.findByText('Test Coverage by Category');
    const bar = screen.getByRole('progressbar', { name: /combat test coverage/i });
    expect(bar.getAttribute('aria-valuetext')).toBe('81%');
  });
});

describe('DirectorOverview qualifies the rolled-up health score', () => {
  const baseStats: DirectorStats = {
    totalSessions: 2, completedSessions: 2, totalFindings: 5,
    criticalFindings: 1, openCriticalHigh: 2, activeAlerts: 0,
    avgScore: 68, recentSessions: [],
  };

  it('labels an all-simulated average as simulated and says so in the ring name', () => {
    render(
      <DirectorOverview
        sessions={[]}
        stats={{ ...baseStats, scoreSource: 'simulated', scoredSessions: 2 }}
        trend={[]}
        loading={false}
        onViewSession={() => {}}
        onNewSession={() => {}}
      />,
    );
    expect(screen.getByText('Game Health Score (simulated)')).toBeTruthy();
    const ring = screen.getByRole('img', { name: /simulated game health score/i });
    expect(ring.getAttribute('aria-label')).toContain('not measured');
    expect(screen.getByText(/covers 2 simulated sessions/i)).toBeTruthy();
  });

  it('leaves a measured average unqualified', () => {
    render(
      <DirectorOverview
        sessions={[]}
        stats={{ ...baseStats, scoreSource: 'external', scoredSessions: 2 }}
        trend={[]}
        loading={false}
        onViewSession={() => {}}
        onNewSession={() => {}}
      />,
    );
    expect(screen.getByText('Game Health Score')).toBeTruthy();
    const ring = screen.getByRole('img', { name: /game health score: 68 out of 100, measured/i });
    expect(ring.getAttribute('aria-label')).not.toMatch(/simulated/i);
  });

  it('treats an absent scoreSource as simulated — an unattributed score is not a verified one', () => {
    render(
      <DirectorOverview
        sessions={[]}
        stats={baseStats}
        trend={[]}
        loading={false}
        onViewSession={() => {}}
        onNewSession={() => {}}
      />,
    );
    expect(screen.getByText('Game Health Score (simulated)')).toBeTruthy();
    expect(screen.getByText('Avg Score (simulated)')).toBeTruthy();
    expect(screen.getByText('68/100')).toBeTruthy();
  });
});
