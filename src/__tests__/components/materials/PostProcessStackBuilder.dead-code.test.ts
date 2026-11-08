import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as builderConstants from '@/components/modules/content/materials/PostProcessStackBuilder/constants';

/**
 * When the builder moved onto usePostProcessStudioStore it stopped using its
 * local `cloneDefaultEffects()` seed (helpers.ts) and its fixed
 * `TARGET_RESOLUTION = '1080p'` — the budget is now computed at the store's
 * resolution. Both stayed behind with zero consumers, and the constant's comment
 * ("Materials tab evaluates GPU budget against a fixed target resolution")
 * still described the behaviour the migration removed.
 */

const DIR = resolve(process.cwd(), 'src/components/modules/content/materials/PostProcessStackBuilder');

describe('PostProcessStackBuilder — no pre-store leftovers', () => {
  it('has no local default-effects seed', () => {
    expect(existsSync(resolve(DIR, 'helpers.ts'))).toBe(false);
  });

  it('exports no fixed target resolution, and says none', () => {
    expect('TARGET_RESOLUTION' in builderConstants).toBe(false);
    const src = readFileSync(resolve(DIR, 'constants.ts'), 'utf-8');
    expect(src).not.toMatch(/fixed target resolution/i);
  });

  it('the budget still reads the store resolution', () => {
    const src = readFileSync(resolve(DIR, 'index.tsx'), 'utf-8');
    expect(src).toMatch(/estimateGPUBudget\(effects, resolution\)/);
  });
});
