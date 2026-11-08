import { describe, it, expect } from 'vitest';
import * as data from '@/components/modules/core-engine/sub_save/_shared/data';
import { RECOVERY_STEPS } from '@/components/modules/core-engine/sub_save/_shared/data-panels';

describe('save fixtures carry no unreachable data', () => {
  it('has no fallback diff fixture the slot pickers can never reach', () => {
    expect('SAVE_DIFF_ENTRIES' in data).toBe(false);
  });

  it('has no recovery step field that nothing renders', () => {
    for (const step of RECOVERY_STEPS) expect('icon' in step).toBe(false);
  });
});
