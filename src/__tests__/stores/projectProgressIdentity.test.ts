/**
 * Project identity for module progress.
 *
 * Checklist progress / module health / semantic verification live in ONE global
 * localStorage blob while the server row is per-project, and the POST merges
 * checklists additively (a `true` written under the wrong path can never be
 * un-done). These tests pin the three corruption paths shut:
 *
 *   (a) "New Project" inheriting the previous project's completed checklist
 *   (b) a failed load on a switch leaving A's progress rendered — and saved — as B's
 *   (c) the never-disposed 2 s auto-save timer firing under the new projectPath
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockFetch, mockFetchRoutes } from '../setup';
import { useModuleStore, claimUnadoptedOwner, readPersistedProjectPath } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { autoSaveLifecycle, cancelAutoSave } from '@/services/ProjectModuleBridge';

const EMPTY_MODULE_STATE = {
  moduleHistory: {},
  moduleHealth: {},
  checklistProgress: {},
  checklistVerification: {},
  scanResults: {},
  progressProjectPath: null,
  progressAdopted: true,
  progressLoadError: null,
  progressSaveError: null,
  progressLoadPath: null,
  isLoadingProgress: false,
};

const EMPTY_PROJECT_STATE = {
  projectName: '',
  projectPath: '',
  ueVersion: '5.8.0',
  isSetupComplete: false,
  isNewProject: true,
  setupStep: 0,
  dynamicContext: null,
  isScanning: false,
  scanError: null,
  recentProjects: [],
};

/** POST bodies sent to /api/project-progress, in order. */
function progressPosts(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(
      (call) =>
        String(call[0]).includes('/api/project-progress') &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

beforeEach(() => {
  cancelAutoSave();
  useModuleStore.setState(EMPTY_MODULE_STATE);
  useProjectStore.setState(EMPTY_PROJECT_STATE);
  globalThis.localStorage.clear();
});

afterEach(() => {
  cancelAutoSave();
  vi.useRealTimers();
});

// ─── (a) A brand-new project must not inherit the previous project's ticks ────

describe('new project does not inherit the previous project\'s progress', () => {
  it('posts an empty checklist for the new project after resetProject', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: {} } });

    // Project A, with real completed work.
    useProjectStore.setState({
      projectName: 'A',
      projectPath: '/proj/A',
      isSetupComplete: true,
      isNewProject: false,
    });
    useModuleStore.setState({
      progressProjectPath: '/proj/A',
      checklistProgress: { 'arpg-combat': { 'acb-1': true, 'acb-2': true } },
      moduleHealth: { 'arpg-combat': { score: 90, tasksCompleted: 2, status: 'healthy' } },
    });

    // "New Project" → reset, then set up a fresh project at a different path.
    useProjectStore.getState().resetProject();
    expect(useModuleStore.getState().checklistProgress).toEqual({});

    useProjectStore.getState().setProject({
      projectName: 'B',
      projectPath: '/proj/B',
      isNewProject: true,
    });
    await useProjectStore.getState().completeSetup();

    const posts = progressPosts(fetchMock);
    expect(posts.length).toBeGreaterThan(0);
    const forB = posts.filter((b) => b.projectPath === '/proj/B');
    expect(forB.length).toBeGreaterThan(0);
    for (const body of forB) {
      expect(body.checklistProgress).toEqual({});
      expect(body.moduleHealth).toEqual({});
    }
  });

  it('still saves A\'s real progress under A before clearing it', () => {
    const fetchMock = mockFetch({ body: { success: true, data: {} } });
    useProjectStore.setState({
      projectName: 'A',
      projectPath: '/proj/A',
      isSetupComplete: true,
    });
    useModuleStore.setState({
      progressProjectPath: '/proj/A',
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
    });

    useProjectStore.getState().resetProject();

    const posts = progressPosts(fetchMock);
    expect(posts).toHaveLength(1);
    expect(posts[0].projectPath).toBe('/proj/A');
    expect(posts[0].checklistProgress).toEqual({ 'arpg-combat': { 'acb-1': true } });
  });
});

// ─── (b) A failed load must not render A's progress as B's ───────────────────

describe('failed load does not render the previous project\'s progress', () => {
  it('clears foreign progress and reports the failure', async () => {
    useModuleStore.setState({
      progressProjectPath: '/proj/A',
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
      moduleHealth: { 'arpg-combat': { score: 90, tasksCompleted: 1, status: 'healthy' } },
    });

    globalThis.fetch = (() => Promise.reject(new Error('Connection refused'))) as unknown as typeof fetch;
    await useModuleStore.getState().loadProgress('/proj/B');

    const state = useModuleStore.getState();
    expect(state.checklistProgress).toEqual({});
    expect(state.moduleHealth).toEqual({});
    expect(state.progressProjectPath).toBe('/proj/B');
    expect(state.progressLoadError).toBeTruthy();
    expect(state.progressLoadError).toContain('discarded');
    expect(state.isLoadingProgress).toBe(false);
  });

  it('keeps the local cache when the failed load is for the SAME project', async () => {
    useModuleStore.setState({
      progressProjectPath: '/proj/A',
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
    });

    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    await useModuleStore.getState().loadProgress('/proj/A');

    const state = useModuleStore.getState();
    expect(state.checklistProgress).toEqual({ 'arpg-combat': { 'acb-1': true } });
    expect(state.progressLoadError).toContain('locally cached');
  });

  it('retryLoadProgress re-attempts the failed path and clears the error', async () => {
    useModuleStore.setState({ progressProjectPath: '/proj/A' });
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    await useModuleStore.getState().loadProgress('/proj/B');
    expect(useModuleStore.getState().progressLoadError).toBeTruthy();

    mockFetch({
      body: {
        success: true,
        data: { checklistProgress: { 'arpg-loot': { 'al-1': true } }, moduleHealth: {}, checklistVerification: {}, moduleHistory: {} },
      },
    });
    await useModuleStore.getState().retryLoadProgress();

    const state = useModuleStore.getState();
    expect(state.progressLoadError).toBeNull();
    expect(state.checklistProgress).toEqual({ 'arpg-loot': { 'al-1': true } });
  });
});

// ─── (c) No POST may carry project A's keys under project B ──────────────────

describe('saveProgress refuses a cross-project write', () => {
  it('does not POST when the loaded progress belongs to another project', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: {} } });
    useModuleStore.setState({
      progressProjectPath: '/proj/A',
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
    });

    await useModuleStore.getState().saveProgress('/proj/B');

    expect(progressPosts(fetchMock)).toHaveLength(0);
    const err = useModuleStore.getState().progressSaveError;
    expect(err).toContain('/proj/A');
    expect(err).toContain('/proj/B');
  });

  it('claims an unowned blob for the project being written', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: {} } });
    useModuleStore.setState({ progressProjectPath: null });

    await useModuleStore.getState().saveProgress('/proj/B');

    expect(useModuleStore.getState().progressProjectPath).toBe('/proj/B');
    expect(progressPosts(fetchMock)).toHaveLength(1);
  });

  it('reports a failed save instead of swallowing it', async () => {
    useModuleStore.setState({ progressProjectPath: '/proj/A' });
    globalThis.fetch = (() => Promise.reject(new Error('DB locked'))) as unknown as typeof fetch;
    await useModuleStore.getState().saveProgress('/proj/A');
    expect(useModuleStore.getState().progressSaveError).toContain('DB locked');
  });

  it('switch A→B with a failed load then a toggle issues no POST carrying A\'s keys', async () => {
    vi.useFakeTimers();
    const target = {
      id: 'p2',
      projectName: 'B',
      projectPath: '/proj/B',
      ueVersion: '5.8',
      lastOpenedAt: '',
      checklistTotal: 0,
      checklistDone: 0,
    };
    useProjectStore.setState({
      recentProjects: [target],
      projectName: 'A',
      projectPath: '/proj/A',
      isSetupComplete: true,
    });
    useModuleStore.setState({
      progressProjectPath: '/proj/A',
      checklistProgress: { 'arpg-combat': { 'acb-1': true, 'acb-2': true } },
    });

    // Everything succeeds EXCEPT the progress GET for B.
    const fetchMock = mockFetchRoutes([
      { match: '/api/project-progress?', response: { body: { success: false, error: 'boom' }, status: 500 } },
      { match: '/api/project-progress', response: { body: { success: true, data: {} } } },
      { match: '/api/recent-projects', response: { body: { success: true, data: [target] } } },
      { match: '/api/session-log', response: { body: { success: true, data: {} } } },
      { match: '/api/filesystem/scan-project', response: { body: { success: true, data: { scannedAt: new Date().toISOString(), classes: [], plugins: [], buildDependencies: [], sourceFileCount: 0 } } } },
    ]);

    await useProjectStore.getState().switchProject('p2');

    expect(useModuleStore.getState().checklistProgress).toEqual({});
    expect(useModuleStore.getState().progressLoadError).toBeTruthy();

    // Now the user ticks one item in B and the debounced auto-save fires.
    useModuleStore.getState().toggleChecklistItem('arpg-loot', 'al-1');
    await vi.advanceTimersByTimeAsync(3000);

    const forB = progressPosts(fetchMock).filter((b) => b.projectPath === '/proj/B');
    expect(forB.length).toBeGreaterThan(0);
    for (const body of forB) {
      expect(body.checklistProgress['arpg-combat']).toBeUndefined();
    }
    expect(forB[forB.length - 1].checklistProgress).toEqual({ 'arpg-loot': { 'al-1': true } });
  });
});

// ─── The auto-save timer is disposed on every project change ─────────────────

describe('auto-save timer disposal', () => {
  it('cancelAutoSave stops a scheduled save from firing', async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch({ body: { success: true, data: {} } });
    useProjectStore.setState({ projectPath: '/proj/A', isSetupComplete: true });
    useModuleStore.setState({ progressProjectPath: '/proj/A' });

    useModuleStore.getState().toggleChecklistItem('arpg-combat', 'acb-1');
    expect(autoSaveLifecycle.isActive()).toBe(true);

    cancelAutoSave();
    expect(autoSaveLifecycle.isActive()).toBe(false);

    await vi.advanceTimersByTimeAsync(5000);
    expect(progressPosts(fetchMock)).toHaveLength(0);
  });

  it('resetProject disposes a pending auto-save', () => {
    vi.useFakeTimers();
    mockFetch({ body: { success: true, data: {} } });
    useProjectStore.setState({ projectPath: '/proj/A', isSetupComplete: true });
    useModuleStore.setState({ progressProjectPath: '/proj/A' });

    useModuleStore.getState().toggleChecklistItem('arpg-combat', 'acb-1');
    expect(autoSaveLifecycle.isActive()).toBe(true);

    useProjectStore.getState().resetProject();
    expect(autoSaveLifecycle.isActive()).toBe(false);
  });

  it('a stale timer that fires after a switch cannot write the old project\'s keys', async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch({ body: { success: true, data: {} } });

    // Timer scheduled while A is open, holding A's progress.
    useProjectStore.setState({ projectPath: '/proj/A', isSetupComplete: true });
    useModuleStore.setState({
      progressProjectPath: '/proj/A',
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
    });
    useModuleStore.getState().toggleChecklistItem('arpg-combat', 'acb-2');

    // The project changes underneath it WITHOUT going through switchProject
    // (the belt-and-braces case: the identity gate alone must hold).
    useProjectStore.setState({ projectPath: '/proj/B' });

    await vi.advanceTimersByTimeAsync(5000);

    const posts = progressPosts(fetchMock);
    expect(posts.filter((b) => b.projectPath === '/proj/B')).toHaveLength(0);
    expect(useModuleStore.getState().progressSaveError).toContain('/proj/A');
  });
});

// ─── One-time adoption: real work is claimed, never discarded ────────────────

describe('one-time adoption of the pre-identity global blob', () => {
  it('attributes an unadopted blob to the persisted projectPath', () => {
    globalThis.localStorage.setItem(
      'pof-project',
      JSON.stringify({ state: { projectPath: '/proj/A' }, version: 0 }),
    );
    expect(readPersistedProjectPath()).toBe('/proj/A');

    const claim = claimUnadoptedOwner({ progressAdopted: false });
    expect(claim).toEqual({ progressProjectPath: '/proj/A', progressAdopted: true });
  });

  it('never re-claims an already-adopted blob', () => {
    globalThis.localStorage.setItem(
      'pof-project',
      JSON.stringify({ state: { projectPath: '/proj/B' }, version: 0 }),
    );
    expect(claimUnadoptedOwner({ progressAdopted: true })).toBeNull();
  });

  it('leaves the blob unowned when no project was persisted', () => {
    expect(readPersistedProjectPath()).toBeNull();
    expect(claimUnadoptedOwner({ progressAdopted: false })).toEqual({
      progressProjectPath: null,
      progressAdopted: true,
    });
  });

  it('adoption is identity only — it does not touch the progress itself', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: {} } });
    // Unadopted blob with real work, project store persisted on A.
    globalThis.localStorage.setItem(
      'pof-project',
      JSON.stringify({ state: { projectPath: '/proj/A' }, version: 0 }),
    );
    const real = { 'arpg-combat': { 'acb-1': true, 'acb-2': true } };
    const claim = claimUnadoptedOwner({ progressAdopted: false });
    useModuleStore.setState({ checklistProgress: real, ...claim });

    expect(useModuleStore.getState().checklistProgress).toEqual(real);
    // …and it now saves under A, not silently into whatever opens next.
    await useModuleStore.getState().saveProgress('/proj/A');
    const posts = progressPosts(fetchMock);
    expect(posts).toHaveLength(1);
    expect(posts[0].checklistProgress).toEqual(real);
  });
});
