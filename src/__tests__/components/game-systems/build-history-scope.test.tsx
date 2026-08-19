/**
 * The Builds tab must ask for THIS project's builds — and say what it could not see.
 *
 * Wave 20 taught `insertBuild` to persist `project_id`. No UI caller was taught to
 * PASS a project, so the dashboard kept fetching `?action=dashboard` unscoped — and
 * `projectScopeSql('')` resolves to `project_id = ''`, i.e. LEGACY ROWS ONLY. From
 * wave 20 on, a user who cooks ten builds with a project open sees zero of them and
 * is told "No builds recorded yet". It went uncaught because the live DB has no
 * post-wave-20 cooks: all 6 rows still carry `''`.
 *
 * The route already computed the honest disclosure (`scope: getBuildScopeReport(...)`)
 * and the component's response type did not declare the field — the answer was fetched
 * and thrown away.
 *
 * Everything here is FIXTURE-driven: real attribution is being written by real cooks,
 * so any assertion against live counts would be a time-bomb rather than a test.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import type { ProjectScopeCounts } from '@/lib/project-id';
import { describeMatrixScope } from '@/components/modules/shared/FeatureMatrix/matrixScope';
import { BuildHistoryDashboard } from '@/components/modules/game-systems/BuildHistoryDashboard';
import { describeBuildScope, emptyHistoryCopy } from '@/components/modules/game-systems/BuildHistoryDashboard/buildScope';
import { useProjectStore } from '@/stores/projectStore';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const PROJECT_PATH = 'C:/Users/kazda/Documents/Unreal Projects/PoF';
const PROJECT_ID = 'c:/users/kazda/documents/unreal projects/pof';

function counts(over: Partial<ProjectScopeCounts> = {}): ProjectScopeCounts {
  return {
    projectId: PROJECT_ID,
    unscoped: false,
    totalRows: 0,
    legacyRows: 0,
    ownedRows: 0,
    foreignRows: 0,
    projects: [],
    distinctProjects: 1,
    ...over,
  };
}

const STATS = {
  totalBuilds: 0,
  successCount: 0,
  failedCount: 0,
  successRate: 0,
  avgDurationMs: null,
  avgSizeBytes: null,
  latestVersion: null,
  platforms: [],
};

/** Mock the composite dashboard GET; returns the fetch spy so the URL can be read. */
function mockDashboard(over: Record<string, unknown> = {}) {
  const dashboard = {
    builds: [],
    stats: STATS,
    trend: [],
    version: '0.2.0',
    parsed: { major: 0, minor: 2, patch: 0 },
    scope: counts(),
    ...over,
  };
  const mock = vi.fn().mockImplementation(() => {
    const body = { success: true, data: dashboard };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function urlsOf(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((c) => String(c[0]));
}

beforeEach(() => {
  useProjectStore.setState({ projectPath: PROJECT_PATH, projectName: 'PoF' });
});

describe('the Builds tab reads its own project', () => {
  it('carries projectPath= on the dashboard fetch when a project is open', async () => {
    const mock = mockDashboard();
    render(<BuildHistoryDashboard />);
    await waitFor(() => expect(mock).toHaveBeenCalled());

    const dashUrl = urlsOf(mock).find((u) => u.includes('action=dashboard'))!;
    expect(dashUrl).toContain(`projectPath=${encodeURIComponent(PROJECT_PATH)}`);
  });

  it('omits projectPath entirely when no project is open (an honest unscoped read)', async () => {
    useProjectStore.setState({ projectPath: '', projectName: '' });
    const mock = mockDashboard({ scope: counts({ projectId: '', unscoped: true }) });
    render(<BuildHistoryDashboard />);
    await waitFor(() => expect(mock).toHaveBeenCalled());

    const dashUrl = urlsOf(mock).find((u) => u.includes('action=dashboard'))!;
    expect(dashUrl).not.toContain('projectPath=');
  });

  it('attributes a manually recorded build to the same project', async () => {
    const mock = mockDashboard();
    render(<BuildHistoryDashboard />);
    await waitFor(() => expect(mock).toHaveBeenCalled());

    fireEvent.click(await screen.findByText('Record'));
    // "Record Build" is both the form heading and the submit button — take the button.
    const candidates = await screen.findAllByText('Record Build');
    fireEvent.click(candidates.find((el) => el.tagName === 'BUTTON')!);

    await waitFor(() => {
      const post = mock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
      expect(post).toBeTruthy();
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body.action).toBe('record');
      expect(body.projectPath).toBe(PROJECT_PATH);
    });
  });
});

describe('an empty Builds tab says WHY it is empty', () => {
  it('renders the disclosure when another project owns the builds', async () => {
    mockDashboard({ scope: counts({ totalRows: 10, foreignRows: 10, distinctProjects: 2 }) });
    render(<BuildHistoryDashboard />);
    const banner = await screen.findByTestId('pof-build-history-scope');
    expect(banner.getAttribute('data-scope-state')).toBe('foreign');
    expect(banner.textContent).toContain('another project');
  });

  it('renders the disclosure when only unattributed legacy builds are visible', async () => {
    mockDashboard({ scope: counts({ totalRows: 6, legacyRows: 6 }) });
    render(<BuildHistoryDashboard />);
    const banner = await screen.findByTestId('pof-build-history-scope');
    expect(banner.getAttribute('data-scope-state')).toBe('legacy');
  });

  it('renders NOTHING when every visible build belongs to this project', async () => {
    mockDashboard({ scope: counts({ totalRows: 4, ownedRows: 4 }) });
    render(<BuildHistoryDashboard />);
    await screen.findByText('Build History');
    expect(screen.queryByTestId('pof-build-history-scope')).toBeNull();
  });

  it('cannot claim "no builds recorded" while builds exist under another project', async () => {
    mockDashboard({ scope: counts({ totalRows: 10, foreignRows: 10, distinctProjects: 2 }) });
    render(<BuildHistoryDashboard />);
    await screen.findByTestId('pof-build-history-scope');
    expect(screen.queryByText(/No builds recorded yet/i)).toBeNull();
  });
});

describe('the four states come from the ONE classifier, not a second one', () => {
  const cases: Array<[string, ProjectScopeCounts, number]> = [
    ['foreign', counts({ totalRows: 5, foreignRows: 5 }), 0],
    ['legacy', counts({ totalRows: 6, legacyRows: 6 }), 6],
    ['mixed', counts({ totalRows: 6, ownedRows: 4, legacyRows: 2 }), 6],
    ['own', counts({ totalRows: 4, ownedRows: 4 }), 4],
  ];

  it.each(cases)('%s: state/level/word/show delegate to describeMatrixScope', (_name, scope, visible) => {
    const mine = describeBuildScope(scope, visible)!;
    // The classifier is fed the same facts; only the SENTENCE is domain copy.
    const theirs = describeMatrixScope({ ...scope, moduleId: null, note: mine.note }, visible)!;
    expect(mine.state).toBe(theirs.state);
    expect(mine.level).toBe(theirs.level);
    expect(mine.word).toBe(theirs.word);
    expect(mine.show).toBe(theirs.show);
  });

  it('speaks about builds, never about feature-matrix rows or modules', () => {
    const d = describeBuildScope(counts({ totalRows: 5, foreignRows: 5 }), 0)!;
    expect(d.headline.toLowerCase()).toContain('build');
    expect(d.headline.toLowerCase()).not.toContain('feature matrix');
    expect(d.headline.toLowerCase()).not.toContain('module');
  });

  it('returns null before the first fetch has produced a scope', () => {
    expect(describeBuildScope(null, 0)).toBeNull();
  });
});

describe('empty-state copy', () => {
  it('keeps the original invitation when nothing anywhere has ever been built', () => {
    expect(emptyHistoryCopy(counts())).toContain('Use "Record"');
  });

  it('names the excluded builds instead of claiming none exist', () => {
    const copy = emptyHistoryCopy(counts({ totalRows: 10, foreignRows: 10 }));
    expect(copy).not.toMatch(/No builds recorded yet/i);
    expect(copy).toContain('10');
    expect(copy.toLowerCase()).toContain('another project');
  });
});
