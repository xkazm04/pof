import { describe, it, expect } from 'vitest';
import {
  ELEMENT_RGBA, ELEMENT_COLORS, NORMAL_FONT_SIZE, CRIT_FONT_SIZE, DEFAULT_PHYSICS,
} from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/constants';

/** One table mirrors UDamageNumberWidget.h; the palette panel and the simulator both derive from it. */

describe('damage number C++ table', () => {
  it('pins the five FLinearColor values of DamageNumberWidget.h', () => {
    expect(ELEMENT_RGBA).toEqual({
      physical: [1.0, 1.0, 1.0, 1.0],
      fire: [1.0, 0.3, 0.1, 1.0],
      ice: [0.3, 0.6, 1.0, 1.0],
      lightning: [1.0, 1.0, 0.2, 1.0],
      heal: [0.2, 1.0, 0.3, 1.0],
    });
  });

  it('pins the 18/26 font sizes and the simulator defaults to them', () => {
    expect([NORMAL_FONT_SIZE, CRIT_FONT_SIZE]).toEqual([18, 26]);
    expect([DEFAULT_PHYSICS.normalFontSize, DEFAULT_PHYSICS.critFontSize]).toEqual([18, 26]);
  });

  it('simulator CSS colours are the rounded 0-255 form of the table', () => {
    expect(ELEMENT_COLORS).toEqual({
      physical: 'rgba(255,255,255,1)',
      fire: 'rgba(255,77,26,1)',
      ice: 'rgba(77,153,255,1)',
      lightning: 'rgba(255,255,51,1)',
      heal: 'rgba(51,255,77,1)',
    });
  });
});
