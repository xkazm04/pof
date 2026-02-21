import { describe, it, expect, beforeEach } from 'vitest';
import { mockFetch, mockFetchRoutes } from '../setup';
import { useProjectStore } from '@/stores/projectStore';
// localStorage mock installed by vitest setupFiles

// Reset store before each test (partial merge — preserves action methods)
beforeEach(() => {
  useProjectStore.setState({
    projectName: '',
    projectPath: '',
    ueVersion: '5.7.3',
    isSetupComplete: false,
    isNewProject: true,
    setupStep: 0,
    dynamicContext: null,
    isScanning: false,
    scanError: null,
    recentProjects: [],
  });
});

describe('useProjectStore', () => {
  describe('setProject', () => {
    it('updates partial project state', () => {
      useProjectStore.getState().setProject({
        projectName: 'TestProject',
        projectPath: '/home/user/TestProject',
      });
      const state = useProjectStore.getState();
      expect(state.projectName).toBe('TestProject');
      expect(state.projectPath).toBe('/home/user/TestProject');
      // Other fields should remain at defaults
      expect(state.ueVersion).toBe('5.7.3');
    });
  });

  describe('resetProject', () => {
    it('resets project state to defaults', () => {
      mockFetch(); // saveModuleProgress will call fetch
      useProjectStore.getState().setProject({
        projectName: 'TestProject',
        projectPath: '/some/path',
        isSetupComplete: true,
      });
      useProjectStore.getState().resetProject();
      const state = useProjectStore.getState();
      expect(state.projectName).toBe('');
      expect(state.projectPath).toBe('');
      expect(state.isSetupComplete).toBe(false);
      expect(state.isNewProject).toBe(true);
      expect(state.dynamicContext).toBeNull();
    });
  });

  describe('completeSetup', () => {
    it('sets isSetupComplete to true', async () => {
      mockFetch({ body: { success: true, data: {} } });
      useProjectStore.getState().setProject({
        projectName: 'TestProject',
        projectPath: '/path',
        isNewProject: true,
      });
      await useProjectStore.getState().completeSetup();
      expect(useProjectStore.getState().isSetupComplete).toBe(true);
    });
  });

  describe('loadRecentProjects', () => {
    it('populates recentProjects from API response', async () => {
      const mockProjects = [
        { id: 'p1', projectName: 'Project A', projectPath: '/a', ueVersion: '5.7', lastOpenedAt: '2026-01-01', checklistTotal: 10, checklistDone: 5 },
        { id: 'p2', projectName: 'Project B', projectPath: '/b', ueVersion: '5.7', lastOpenedAt: '2026-01-02', checklistTotal: 20, checklistDone: 0 },
      ];
      mockFetch({ body: { success: true, data: mockProjects } });
      await useProjectStore.getState().loadRecentProjects();
      expect(useProjectStore.getState().recentProjects).toEqual(mockProjects);
    });

    it('keeps existing state on API failure', async () => {
      const existing = [
        { id: 'p1', projectName: 'Existing', projectPath: '/e', ueVersion: '5.7', lastOpenedAt: '2026-01-01', checklistTotal: 5, checklistDone: 1 },
      ];
      useProjectStore.setState({ recentProjects: existing });
      mockFetch({ body: { success: false, error: 'Server error' }, status: 500 });
      await useProjectStore.getState().loadRecentProjects();
      // Should still have the old projects (silent fail)
      expect(useProjectStore.getState().recentProjects).toEqual(existing);
    });
  });

  describe('removeRecentProject', () => {
    it('removes a project from the list optimistically', async () => {
      const projects = [
        { id: 'p1', projectName: 'A', projectPath: '/a', ueVersion: '5.7', lastOpenedAt: '', checklistTotal: 0, checklistDone: 0 },
        { id: 'p2', projectName: 'B', projectPath: '/b', ueVersion: '5.7', lastOpenedAt: '', checklistTotal: 0, checklistDone: 0 },
      ];
      useProjectStore.setState({ recentProjects: projects });
      mockFetch({ body: { success: true, data: {} } });
      await useProjectStore.getState().removeRecentProject('p1');
      const remaining = useProjectStore.getState().recentProjects;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('p2');
    });
  });

  describe('scanProject', () => {
    it('skips scan when projectPath is empty', async () => {
      const fetchMock = mockFetch();
      await useProjectStore.getState().scanProject();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sets isScanning during scan', async () => {
      useProjectStore.getState().setProject({ projectPath: '/path', projectName: 'Test' });

      let isScanning = false;
      mockFetch({
        body: {
          success: true,
          data: { scannedAt: new Date().toISOString(), classes: [], plugins: [], buildDependencies: [], sourceFileCount: 0 },
        },
      });

      // Intercept to check isScanning during the call
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
        isScanning = useProjectStore.getState().isScanning;
        return origFetch(...args);
      }) as typeof fetch;

      await useProjectStore.getState().scanProject();
      expect(isScanning).toBe(true);
      expect(useProjectStore.getState().isScanning).toBe(false);
    });

    it('sets scanError on failure', async () => {
      useProjectStore.getState().setProject({ projectPath: '/path', projectName: 'Test' });
      globalThis.fetch = (() => Promise.reject(new Error('Connection refused'))) as unknown as typeof fetch;
      await useProjectStore.getState().scanProject();
      expect(useProjectStore.getState().scanError).toBe('Connection refused');
      expect(useProjectStore.getState().isScanning).toBe(false);
    });
  });

  describe('switchProject', () => {
    it('does nothing when target project does not exist', async () => {
      const fetchMock = mockFetch();
      useProjectStore.setState({ recentProjects: [] });
      await useProjectStore.getState().switchProject('nonexistent');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('switches to a known project and restores its state', async () => {
      const target = {
        id: 'p2',
        projectName: 'Target',
        projectPath: '/target',
        ueVersion: '5.8',
        lastOpenedAt: '',
        checklistTotal: 0,
        checklistDone: 0,
      };
      useProjectStore.setState({
        recentProjects: [target],
        projectPath: '/current',
        isSetupComplete: true,
      });

      mockFetchRoutes([
        { match: '/api/recent-projects', response: { body: { success: true, data: [target] } } },
        { match: '/api/project-progress', response: { body: { success: true, data: {} } } },
        { match: '/api/session-log', response: { body: { success: true, data: {} } } },
        { match: '/api/filesystem/scan-project', response: { body: { success: true, data: { scannedAt: new Date().toISOString(), classes: [], plugins: [], buildDependencies: [], sourceFileCount: 0 } } } },
      ]);

      await useProjectStore.getState().switchProject('p2');
      const state = useProjectStore.getState();
      expect(state.projectName).toBe('Target');
      expect(state.projectPath).toBe('/target');
      expect(state.ueVersion).toBe('5.8');
      expect(state.isSetupComplete).toBe(true);
      expect(state.isNewProject).toBe(false);
    });
  });
});
