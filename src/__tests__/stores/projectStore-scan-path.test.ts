/** The 5-minute scan cache serves only the project it was scanned for. */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockFetch } from '../setup';
import { useProjectStore } from '@/stores/projectStore';

const SCAN = {
  success: true,
  data: { scannedAt: new Date().toISOString(), classes: [], plugins: [], buildDependencies: [], sourceFileCount: 0 },
};

beforeEach(() => {
  useProjectStore.setState({
    projectName: 'A',
    projectPath: 'C:/UE/A',
    dynamicContext: {
      scannedAt: new Date().toISOString(),
      projectType: 'ue5',
      classes: [{ name: 'FromA', prefix: 'U', headerPath: 'A.h' }],
      plugins: [],
      buildDependencies: [],
      sourceFileCount: 1,
    },
    scannedPath: 'C:/UE/A',
    isScanning: false,
    scanError: null,
  });
});

describe('scan cache is keyed by project path', () => {
  it('re-scans after setProject moves to another path without a flip', async () => {
    const fetchMock = mockFetch({ body: SCAN });
    useProjectStore.getState().setProject({ projectName: 'B', projectPath: 'C:/UE/B' });
    await useProjectStore.getState().scanProject();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().dynamicContext?.classes).toEqual([]);
    expect(useProjectStore.getState().scannedPath).toBe('C:/UE/B');
  });

  it('[guard] the same path stays cached', async () => {
    const fetchMock = mockFetch({ body: SCAN });
    await useProjectStore.getState().scanProject();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
