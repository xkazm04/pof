/** completeSetup records the project's LOADED checklist counts in the recent list. */
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { registerModuleStore } from '@/services/ProjectModuleBridge';
import { useProjectStore } from '@/stores/projectStore';

const LOADED = { combat: { a: true, b: true } };

let progress: Record<string, Record<string, boolean>> = {};
const fakeModuleStore = {
  getState: () => ({
    checklistProgress: progress,
    progressProjectPath: null,
    saveProgress: async () => {},
    loadProgress: async () => { progress = LOADED; },
    clearProgress: () => { progress = {}; },
  }),
};

function reply(data: unknown) {
  const body = { success: true, data };
  return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

beforeEach(() => {
  progress = {};
  registerModuleStore(fakeModuleStore);
  useProjectStore.setState({
    projectName: 'P', projectPath: 'C:/UE/P', isNewProject: false, isSetupComplete: false, recentProjects: [],
  });
});

describe('completeSetup saves to recent after progress is loaded', () => {
  it('an existing project is saved with its loaded checklist, not the empty in-memory one', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(reply({ id: 'x', projects: [] })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await useProjectStore.getState().completeSetup();

    const saveCall = (fetchMock.mock.calls as unknown as Array<[string, { body: string }]>)
      .map((c) => JSON.parse(c[1].body))
      .find((b) => b.action === 'save');
    expect(saveCall.checklistProgress).toEqual(LOADED);
  });
});
