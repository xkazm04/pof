import { describe, it, expect } from 'vitest';
import { COMPAT_MATRIX, COMPAT_VERSIONS } from '@/components/modules/core-engine/sub_save/_shared/data-panels';

describe('COMPAT_MATRIX', () => {
  it('only claims compatibility between versions the schema history declares', () => {
    const orphans = COMPAT_MATRIX.filter((c) => !COMPAT_VERSIONS.includes(c.from) || !COMPAT_VERSIONS.includes(c.to));
    expect(orphans).toEqual([]);
  });
});
