import { describe, it, expect } from 'vitest';
import * as data from '@/components/modules/core-engine/sub_save/_shared/data';

describe('save fixtures carry no unreachable data', () => {
  it('has no fallback diff fixture the slot pickers can never reach', () => {
    expect('SAVE_DIFF_ENTRIES' in data).toBe(false);
  });
});
