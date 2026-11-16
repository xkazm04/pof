import { describe, it, expect } from 'vitest';

import * as builder from '@/components/modules/content/materials/PostProcessStackBuilder/constants';
import * as studio from '@/components/modules/evaluator/PostProcessStudioView/constants';
import { DEFAULT_EFFECTS } from '@/lib/post-process-studio/effects';

/**
 * The Materials builder and the Evaluator studio render one store's effects,
 * but each kept its own hand-copied CATEGORY_COLORS (5 entries) and
 * EFFECT_ICONS (10 entries) "with a shared shape". A new effect or a recoloured
 * category then had to be edited twice or the two screens disagree. One map,
 * owned by the studio, re-exported here.
 */

describe('post-process presentation maps — one source', () => {
  it('the builder uses the studio\'s maps, not copies', () => {
    expect(builder.CATEGORY_COLORS).toBe(studio.CATEGORY_COLORS);
    expect(builder.EFFECT_ICONS).toBe(studio.EFFECT_ICONS);
  });

  it('every default effect has an icon and a category colour', () => {
    for (const e of DEFAULT_EFFECTS) {
      expect(builder.EFFECT_ICONS[e.id], e.id).toBeDefined();
      expect(builder.CATEGORY_COLORS[e.category], e.category).toBeDefined();
    }
  });
});
