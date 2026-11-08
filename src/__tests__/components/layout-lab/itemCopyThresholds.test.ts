import { describe, it, expect, vi } from 'vitest';

/**
 * The bespoke Items acceptance copy states the SAME thresholds its server-importable checker
 * grades with (`itemsBespokeCheckers.ts`), read from the exported constants — not a second,
 * hand-typed copy of each number. Proven by moving every constant: copy that re-typed "three"
 * or `6000` keeps describing the old rule while the checker grades the new one.
 */
vi.mock('@/lib/catalog/acceptance/itemsBespokeCheckers', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/catalog/acceptance/itemsBespokeCheckers')>();
  return {
    ...real,
    MIN_ANIM_CLIPS: 3,
    MIN_SFX_CUES: 5,
    DEFAULT_TRI_CAP: 9000,
    DEFAULT_VFX_MS_CAP: 1.5,
    REQUIRED_PBR_MAPS: ['Albedo', 'Normal', 'ORM', 'Height'] as const,
  };
});

const { ITEM_STEP_COPY } = await import('@/components/layout-lab/steps/itemsSteps');

describe('bespoke Items copy reads its checker’s thresholds', () => {
  it('SFX names the checker’s minimum cue count', () => {
    expect(ITEM_STEP_COPY['SFX']({ cues: [['a', 'b']] }).why).toContain('requires 5');
  });

  it('Animations names the checker’s minimum clip count', () => {
    expect(ITEM_STEP_COPY['Animations']({ clips: [['Pickup', '0.6s']] }).why).toContain('at least 3');
  });

  it('3D Generation falls back to the checker’s default triangle cap', () => {
    expect(ITEM_STEP_COPY['3D Generation']({ tris: 9500 }).why).toContain('9500 > 9000');
  });

  it('VFX falls back to the checker’s default GPU budget', () => {
    expect(ITEM_STEP_COPY['VFX']({ variants: [['a', 'b']], cost: 2 }).why).toContain('1.5ms frame budget');
  });

  it('Material / Texture requires the checker’s map set', () => {
    expect(ITEM_STEP_COPY['Material / Texture']({ maps: ['Albedo', 'Normal', 'ORM'] }).why).toBe('The Height map is missing.');
  });
});
