import { describe, it, expect } from 'vitest';
import { importGlbToUE } from '@/lib/visual-gen/ue-import';

describe('importGlbToUE with a run that printed no import marker', () => {
  it('fails with a reason instead of an undefined error', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', {
      runExperimentFn: async () => ({ ok: true, logs: [], markers: {}, durationMs: 1, binary: 'b', args: [] }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/POF_UE_IMPORT/);
  });
});
