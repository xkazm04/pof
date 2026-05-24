import { describe, it, expect } from 'vitest';
import { SUB_MODULES } from '@/lib/module-registry';

/**
 * Guards the level-design knowledge tips that carry the hard-won Blender→UE
 * gotchas. These strings reach the dispatch prompt (UE_GOTCHAS), so silently
 * dropping or mangling them re-opens bugs we already paid for — most notably
 * the x100 oversized-mesh import (import_uniform_scale=1.0, NOT 100).
 */
describe('level-design knowledge tips', () => {
  const levelDesign = SUB_MODULES.find((m) => m.id === 'level-design');

  it('the level-design module exists with non-empty knowledge tips', () => {
    expect(levelDesign).toBeDefined();
    expect(levelDesign!.knowledgeTips.length).toBeGreaterThan(0);
  });

  it('keeps the Blender→UE import-scale gotcha (avoids the x100 oversize)', () => {
    const tips = levelDesign!.knowledgeTips;
    const scaleTip = tips.find((t) => t.content.includes('import_uniform_scale=1.0'));
    expect(scaleTip, 'a knowledge tip must pin import_uniform_scale=1.0').toBeDefined();
    // It must also warn against the 100x value that causes the oversize bug.
    expect(scaleTip!.content).toContain('NOT 100');
  });

  it('keeps the headless-lighting gotcha (Movable/Lumen vs baked Static)', () => {
    const tips = levelDesign!.knowledgeTips;
    const lightingTip = tips.find(
      (t) => t.content.includes('Lumen') && t.content.includes('light_map_coordinate_index'),
    );
    expect(lightingTip, 'a knowledge tip must cover headless Lumen vs baked lighting').toBeDefined();
  });
});
