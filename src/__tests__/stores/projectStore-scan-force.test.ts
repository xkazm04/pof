import { describe, it, expect, beforeEach } from 'vitest';
import { mockFetch } from '../setup';
import { useProjectStore } from '@/stores/projectStore';

/**
 * A post-run re-check must see the files the run just wrote, so it has to get past
 * the 5-minute scan cache — but only when asked (scan-sweep --challenge
 * core-engine-genre-tabs/B). Every existing caller keeps the cached behaviour.
 */

const FRESH = () => ({
  scannedAt: new Date().toISOString(),
  projectType: 'ue5' as const,
  classes: [],
  plugins: [],
  buildDependencies: [],
  sourceFileCount: 0,
});

const SCAN_BODY = {
  success: true,
  data: {
    scannedAt: '2026-09-30T10:00:00.000Z',
    classes: [{ name: 'UARPGHitDetectionComponent', prefix: 'U', headerPath: 'Combat/Hit.h' }],
    plugins: [],
    buildDependencies: [],
    sourceFileCount: 1,
  },
};

beforeEach(() => {
  useProjectStore.setState({
    projectName: 'Did',
    projectPath: 'C:/UE/Did',
    dynamicContext: FRESH(),
    isScanning: false,
    scanError: null,
  });
});

describe('projectStore.scanProject cache', () => {
  it('[guard] with no argument it still returns early while the scan is younger than the cache window', async () => {
    const fetchMock = mockFetch({ body: SCAN_BODY });
    await useProjectStore.getState().scanProject();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useProjectStore.getState().dynamicContext?.classes).toEqual([]);
  });

  it('{force:true} bypasses the cache and replaces the scanned classes', async () => {
    const fetchMock = mockFetch({ body: SCAN_BODY });
    await useProjectStore.getState().scanProject({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().dynamicContext?.classes.map((c) => c.name)).toEqual([
      'UARPGHitDetectionComponent',
    ]);
  });
});
