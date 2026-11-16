import { describe, it, expect, vi } from 'vitest';
import { importGlbToUE } from '@/lib/visual-gen/ue-import';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const run = () =>
  vi.fn(async (): Promise<ExperimentResult> => ({
    ok: true, logs: [], markers: { POF_UE_IMPORT: '/Game/Generated/Chair.Chair' }, durationMs: 1, binary: 'b', args: [],
  }));

describe('importGlbToUE never launches the editor on a string that would break out of its python', () => {
  const cases: [string, string, { destPath?: string; assetName?: string }][] = [
    ['assetName quote', 'C:/gen/a.glb', { assetName: "x'\nimport os\n#" }],
    ['destPath quote', 'C:/gen/a.glb', { destPath: "/Game/x'\nimport os\n#" }],
    ['destPath outside a content root shape', 'C:/gen/a.glb', { destPath: 'Game/no-leading-slash' }],
    ['glbPath quote', "C:/gen/it's.glb", {}],
    ['glbPath newline', 'C:/gen/a\n.glb', {}],
  ];
  for (const [label, glb, opts] of cases) {
    it(`refuses ${label}`, async () => {
      const fn = run();
      const res = await importGlbToUE(glb, { ...opts, runExperimentFn: fn });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/refused/i);
      expect(fn).not.toHaveBeenCalled();
    });
  }

  it('still imports ordinary names and folders, spaces in the file path included', async () => {
    const fn = run();
    const res = await importGlbToUE('C:/Users/me/My Meshes/chair.glb', {
      destPath: '/Game/Generated/Chair_01', assetName: 'Chair_01', runExperimentFn: fn,
    });
    expect(res.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
