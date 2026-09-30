/**
 * The project-flip owner (src/services/projectTransition.ts).
 *
 * Every trigger that changes the open project (switch / new / delete) runs ONE
 * ordered teardown of the outgoing project's per-project state. These cases pin
 * the store-level half: resetProject runs the whole list (it used to run three of
 * the seven steps), a throwing step cannot abort a switch, the stale auto-save
 * guard still holds, and the identity store no longer reaches into the CLI cache.
 * The TopBar half lives in components/layout/useTopBarTransition.test.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mockFetchRoutes } from '../setup';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore, type RecentProject } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { cancelAutoSave } from '@/services/ProjectModuleBridge';
import { logger } from '@/lib/logger';

const REAL_CLEAR_ALL = useCLIPanelStore.getState().clearAllSessions;

const TARGET_B: RecentProject = {
  id: 'p-b',
  projectName: 'B',
  projectPath: '/proj/B',
  ueVersion: '5.8',
  lastOpenedAt: '',
  checklistTotal: 0,
  checklistDone: 0,
};

type FetchMock = ReturnType<typeof vi.fn>;

function postsTo(fetchMock: FetchMock, url: string): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .filter(
      (call) =>
        String(call[0]).includes(url) &&
        !String(call[0]).includes('?') &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

function progressGetsFor(fetchMock: FetchMock, path: string): number {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    return url.includes('/api/project-progress?') && decodeURIComponent(url).includes(path);
  }).length;
}

function routes(): FetchMock {
  return mockFetchRoutes([
    { match: '/api/project-progress?', response: { body: { success: true, data: { checklistProgress: {}, moduleHealth: {}, checklistVerification: {}, moduleHistory: {} } } } },
    { match: '/api/project-progress', response: { body: { success: true, data: {} } } },
    { match: '/api/recent-projects', response: { body: { success: true, data: { touched: true, projects: [TARGET_B] } } } },
    { match: '/api/session-log', response: { body: { success: true, data: {} } } },
    { match: '/api/filesystem/scan-project', response: { body: { success: true, data: { scannedAt: new Date().toISOString(), classes: [], plugins: [], buildDependencies: [], sourceFileCount: 0 } } } },
  ]);
}

function openProjectA(): void {
  useProjectStore.setState({
    projectName: 'A',
    projectPath: '/proj/A',
    ueVersion: '5.8',
    isSetupComplete: true,
    isNewProject: false,
    recentProjects: [TARGET_B],
    dynamicContext: null,
    isScanning: false,
    scanError: null,
  });
  useModuleStore.setState({
    progressProjectPath: '/proj/A',
    checklistProgress: { 'arpg-combat': { 'acb-1': true } },
    progressSaveError: null,
    progressLoadError: null,
  });
  const cli = useCLIPanelStore.getState();
  cli.createSession({ label: 'one', projectPath: '/proj/A' });
  cli.createSession({ label: 'two', projectPath: '/proj/A' });
}

beforeEach(() => {
  cancelAutoSave();
  globalThis.localStorage.clear();
  useCLIPanelStore.setState({
    sessions: {},
    tabOrder: [],
    activeTabId: null,
    maximizedTabId: null,
    clearAllSessions: REAL_CLEAR_ALL,
  });
  useActivityFeedStore.setState({ events: [] });
});

afterEach(() => {
  cancelAutoSave();
  useCLIPanelStore.setState({ clearAllSessions: REAL_CLEAR_ALL });
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('resetProject runs the whole flip teardown', () => {
  it('clears the CLI sessions and cancels the outgoing session log exactly once', async () => {
    const fetchMock = routes();
    openProjectA();
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(2);

    useProjectStore.getState().resetProject();

    expect(useCLIPanelStore.getState().tabOrder).toEqual([]);
    await vi.waitFor(() => {
      const cancels = postsTo(fetchMock, '/api/session-log').filter((b) => b.action === 'cancel-open');
      expect(cancels).toEqual([{ action: 'cancel-open', projectPath: '/proj/A' }]);
    });
  });
});

describe('a throwing teardown step cannot abort the flip', () => {
  it('completes the switch A->B and reports the failed step through logger', async () => {
    const fetchMock = routes();
    openProjectA();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    useCLIPanelStore.setState({
      clearAllSessions: () => {
        throw new Error('cli-clear-boom');
      },
    });

    await useProjectStore.getState().switchProject(TARGET_B.id);

    expect(useProjectStore.getState().projectPath).toBe('/proj/B');
    expect(progressGetsFor(fetchMock, '/proj/B')).toBe(1);
    const reported = [...warn.mock.calls, ...error.mock.calls].map((args) => args.map(String).join(' '));
    expect(reported.some((line) => line.includes('cli-clear-boom'))).toBe(true);
  });
});

describe('[guard] the stale auto-save cannot write A\'s keys under B', () => {
  it('a save scheduled on A, then a switch to B and 2000ms, posts nothing for B carrying A\'s keys', async () => {
    vi.useFakeTimers();
    const fetchMock = routes();
    openProjectA();
    useModuleStore.getState().toggleChecklistItem('arpg-combat', 'acb-2');

    await useProjectStore.getState().switchProject(TARGET_B.id);
    await vi.advanceTimersByTimeAsync(2000);

    const forB = postsTo(fetchMock, '/api/project-progress').filter((b) => b.projectPath === '/proj/B');
    for (const body of forB) {
      expect((body.checklistProgress as Record<string, unknown>)['arpg-combat']).toBeUndefined();
    }
  });
});

describe('the identity store sits above the owner, not beside the caches', () => {
  it('projectStore.ts no longer imports the CLI panel store', () => {
    const src = readFileSync(join(process.cwd(), 'src/stores/projectStore.ts'), 'utf8');
    expect(src).not.toContain("'@/components/cli/store/cliPanelStore'");
  });
});
