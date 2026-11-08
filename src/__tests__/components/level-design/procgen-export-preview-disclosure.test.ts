import { describe, it, expect } from 'vitest';

// ── Blender export: a downscaled preview is a different layout ──

import { buildExportPlan, describeExportPlan } from '@/components/modules/content/level-design/ProceduralLevelWizard/exportPlan';
import { DEFAULT_MAX_PREVIEW_SIZE } from '@/lib/level-design/procgen-preview';

describe('the export plan says when it is not the previewed layout', () => {
  const grid = Array.from({ length: 128 }, () => Array.from({ length: 128 }, () => 'floor' as const));
  const base = { algorithm: 'bsp', requestedWidth: 128, requestedHeight: 128, grid, scale: 1, seedLabel: 's', seedValue: 1 };

  it('names the regenerated layout and its measured rooms and regions when the preview was capped', () => {
    const line = describeExportPlan(buildExportPlan({
      ...base, previewMaxSide: DEFAULT_MAX_PREVIEW_SIZE, exportStats: { roomCount: 7, regions: 2 },
    }));
    expect(line).toMatch(/not the layout previewed/i);
    expect(line).toContain('96');
    expect(line).toMatch(/7 rooms/);
    expect(line).toMatch(/2 regions/);
  });

  it('says nothing extra when the preview was the full grid', () => {
    const small = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => 'floor' as const));
    const line = describeExportPlan(buildExportPlan({
      ...base, grid: small, requestedWidth: 64, requestedHeight: 64,
      previewMaxSide: DEFAULT_MAX_PREVIEW_SIZE, exportStats: { roomCount: 7, regions: 2 },
    }));
    expect(line).not.toMatch(/not the layout previewed/i);
  });
});
