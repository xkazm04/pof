/**
 * The completion ledger lives in the project_progress row, not only in the
 * browser. A project switch runs clear-module-progress, so a ledger held only
 * client-side was erased on every switch; loadProgress now adopts the server's
 * stamps and saveProgress sends the client's, so velocity history survives.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockFetchRoutes } from '../setup';
import { useModuleStore } from '@/stores/moduleStore';
import { cancelAutoSave } from '@/services/ProjectModuleBridge';

const T = Date.UTC(2026, 8, 3);
const T_LOCAL = Date.UTC(2026, 8, 1);

beforeEach(() => {
  cancelAutoSave();
  useModuleStore.setState({
    checklistProgress: {},
    checklistCompletedAt: {},
    moduleHealth: {},
    moduleHistory: {},
    checklistVerification: {},
    scanResults: {},
    progressProjectPath: null,
    progressAdopted: true,
    progressLoadError: null,
    progressSaveError: null,
    progressLoadPath: null,
    isLoadingProgress: false,
  });
});

afterEach(() => {
  cancelAutoSave();
  vi.restoreAllMocks();
});

describe('moduleStore — server-held completion ledger', () => {
  it("a switch to A adopts A's server stamps, and the next save sends them back", async () => {
    useModuleStore.setState({ progressProjectPath: 'B' });
    const fetchMock = mockFetchRoutes([
      {
        match: '/api/project-progress?',
        response: {
          body: {
            success: true,
            data: { checklistProgress: { m: { a: true } }, checklistCompletedAt: { m: { a: T } } },
          },
        },
      },
      { match: '/api/project-progress', response: { body: { success: true, data: { saved: true } } } },
    ]);

    await useModuleStore.getState().loadProgress('A');
    expect(useModuleStore.getState().checklistCompletedAt.m?.a).toBe(T);

    await useModuleStore.getState().saveProgress('A');
    const post = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/project-progress' && (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(post).toBeDefined();
    const body = JSON.parse((post![1] as RequestInit).body as string);
    expect(body.checklistCompletedAt).toEqual({ m: { a: T } });
  });

  it('a same-project reload merges server and local stamps, earliest wins, pruned to done items', async () => {
    useModuleStore.setState({
      progressProjectPath: 'A',
      checklistCompletedAt: { m: { a: T_LOCAL, gone: T_LOCAL } },
    });
    mockFetchRoutes([
      {
        match: '/api/project-progress?',
        response: {
          body: {
            success: true,
            data: { checklistProgress: { m: { a: true, b: true } }, checklistCompletedAt: { m: { a: T, b: T } } },
          },
        },
      },
    ]);
    await useModuleStore.getState().loadProgress('A');
    expect(useModuleStore.getState().checklistCompletedAt).toEqual({ m: { a: T_LOCAL, b: T } });
  });
});
