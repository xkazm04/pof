/**
 * TopBar project triggers route through the one project-flip owner.
 *
 * Switch / New / Delete each call the store action, which delegates to
 * src/services/projectTransition.ts — so the CLI clear runs once per flip (it
 * used to run twice on a switch), the persisted activity feed is cleared (a
 * surviving evaluator-recommendation could otherwise run A's prompt in a session
 * created with B's path), and Rename is the recorded exclusion: it changes the
 * display name only, never projectPath, and runs no teardown.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

import { mockFetchRoutes } from '../../setup';
import { useTopBar } from '@/components/layout/TopBar/useTopBar';
import { useProjectStore, type RecentProject } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { cancelAutoSave } from '@/services/ProjectModuleBridge';

afterEach(cleanup);

const REAL_CLEAR_ALL = useCLIPanelStore.getState().clearAllSessions;

const TARGET_B: RecentProject = {
  id: 'p-b',
  projectName: 'B',
  projectPath: 'C:/UE/B',
  ueVersion: '5.8',
  lastOpenedAt: '',
  checklistTotal: 0,
  checklistDone: 0,
};

const A_PROGRESS = { 'arpg-combat': { 'acb-1': true } };

type FetchMock = ReturnType<typeof vi.fn>;

function routes(): FetchMock {
  return mockFetchRoutes([
    { match: '/api/project-progress?', response: { body: { success: true, data: { checklistProgress: {}, moduleHealth: {}, checklistVerification: {}, moduleHistory: {} } } } },
    { match: '/api/project-progress', response: { body: { success: true, data: {} } } },
    { match: '/api/recent-projects', response: { body: { success: true, data: { touched: true, projects: [TARGET_B] } } } },
    { match: '/api/session-log', response: { body: { success: true, data: {} } } },
    { match: '/api/filesystem/scan-project', response: { body: { success: false, error: 'not in test' }, status: 500 } },
  ]);
}

function progressPosts(fetchMock: FetchMock): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .filter(
      (call) =>
        String(call[0]) === '/api/project-progress' &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

/** Open project `name` at `path` with loaded progress and two CLI sessions. */
function openProject(name: string, path: string): ReturnType<typeof vi.fn> {
  useProjectStore.setState({
    projectName: name,
    projectPath: path,
    ueVersion: '5.8',
    isSetupComplete: true,
    isNewProject: false,
    recentProjects: [TARGET_B],
    dynamicContext: null,
    isScanning: false,
    scanError: null,
  });
  useModuleStore.setState({
    progressProjectPath: path,
    checklistProgress: A_PROGRESS,
    progressSaveError: null,
    progressLoadError: null,
  });
  const cli = useCLIPanelStore.getState();
  cli.createSession({ label: 'one', projectPath: path });
  cli.createSession({ label: 'two', projectPath: path });
  const spy = vi.fn(() => REAL_CLEAR_ALL());
  useCLIPanelStore.setState({ clearAllSessions: spy });
  return spy;
}

async function rename(to: string) {
  const { result } = renderHook(() => useTopBar());
  act(() => result.current.setRenameValue(to));
  await act(async () => {
    result.current.handleRenameConfirm();
  });
  return result;
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
});

describe('TopBar switch runs the flip teardown once', () => {
  it('clears the CLI sessions exactly once and ends with no tabs', async () => {
    routes();
    const clearSpy = openProject('A', 'C:/UE/A');
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(2);

    const { result } = renderHook(() => useTopBar());
    await act(async () => {
      await result.current.handleSwitchProject(TARGET_B);
    });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(useCLIPanelStore.getState().tabOrder).toEqual([]);
    expect(useProjectStore.getState().projectPath).toBe('C:/UE/B');
  });

  it('drops the persisted activity feed so A\'s Fix prompt cannot run under B', async () => {
    routes();
    openProject('A', 'C:/UE/A');
    useActivityFeedStore.getState().addEvent({
      type: 'evaluator-recommendation',
      title: 'Fix combo window',
      description: 'recorded while A was open',
      moduleId: 'arpg-combat',
      meta: { priority: 'high', prompt: 'Rewrite ADidCharacter::ComboWindow in project A' },
    });
    expect(useActivityFeedStore.getState().events).toHaveLength(1);

    const { result } = renderHook(() => useTopBar());
    await act(async () => {
      await result.current.handleSwitchProject(TARGET_B);
    });

    expect(useActivityFeedStore.getState().events).toEqual([]);
  });
});

describe('Rename is name-only (the recorded exclusion)', () => {
  it('keeps projectPath, runs no teardown, and later saves still reach the DB', async () => {
    const fetchMock = routes();
    const clearSpy = openProject('Did', 'C:/UE/Did');

    await rename('Hero');

    const project = useProjectStore.getState();
    expect(project.projectName).toBe('Hero');
    expect(project.projectPath).toBe('C:/UE/Did');
    expect(clearSpy).not.toHaveBeenCalled();
    expect(useModuleStore.getState().checklistProgress).toEqual(A_PROGRESS);

    await useModuleStore.getState().saveProgress('C:/UE/Did');
    expect(useModuleStore.getState().progressSaveError).toBeNull();
    expect(progressPosts(fetchMock)).toHaveLength(1);
  });

  it('the trigger list is enumerated and a path-stable rename tears nothing down', async () => {
    const { PROJECT_FLIP_TRIGGERS, PROJECT_FLIP_EXCLUSIONS } = await import('@/services/projectTransition');
    expect([...PROJECT_FLIP_TRIGGERS]).toEqual(['switch', 'new', 'delete']);
    expect([...PROJECT_FLIP_EXCLUSIONS]).toEqual(['rename']);

    routes();
    const clearSpy = openProject('Did', 'C:/UE/Game');
    await rename('Hero');

    expect(useProjectStore.getState().projectPath).toBe('C:/UE/Game');
    expect(clearSpy).not.toHaveBeenCalled();
    expect(useCLIPanelStore.getState().tabOrder).toHaveLength(2);
    expect(useModuleStore.getState().checklistProgress).toEqual(A_PROGRESS);
  });
});
