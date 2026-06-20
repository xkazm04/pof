import { describe, it, expect } from 'vitest';
import { buildGlbImportPython, importGlbToUE } from '@/lib/visual-gen/ue-import';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const RES = (markers: Record<string, string>, ok = true): ExperimentResult => ({
  ok, logs: [], markers, durationMs: 1, binary: 'b', args: [],
});

describe('buildGlbImportPython', () => {
  it('imports the glb via an AssetImportTask and logs the marker', () => {
    const py = buildGlbImportPython('C:\\gen\\chair.glb', '/Game/Generated', 'Chair');
    expect(py).toContain('unreal.AssetImportTask()');
    expect(py).toContain("task.filename = 'C:/gen/chair.glb'"); // backslashes normalized
    expect(py).toContain("task.destination_path = '/Game/Generated'");
    expect(py).toContain("task.destination_name = 'Chair'");
    expect(py).toContain('POF_UE_IMPORT=');
  });
});

describe('importGlbToUE', () => {
  it('returns the imported asset path on success', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', { runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/Generated/Chair.Chair' }) });
    expect(res.ok).toBe(true);
    expect(res.assetPath).toBe('/Game/Generated/Chair.Chair');
  });

  it('fails when nothing was imported (NONE marker)', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', { runExperimentFn: async () => RES({ POF_UE_IMPORT: 'NONE' }) });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no objects imported/i);
  });

  it('propagates an experiment-level failure', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', { runExperimentFn: async () => RES({ POF_EXPERIMENT_ERROR: 'boom' }, false) });
    expect(res.ok).toBe(false);
  });
});
