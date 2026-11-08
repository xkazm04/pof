/** A hex alpha suffix on a var() is invalid CSS: the browser drops the declaration. */
import { describe, it, expect } from 'vitest';
import { PRIORITY_COLORS } from '@/components/modules/evaluator/ProjectHealthDashboard/constants';

describe('PRIORITY_COLORS', () => {
  it.each(Object.keys(PRIORITY_COLORS))('%s has valid bg, border and badge colors', (level) => {
    const { bg, border, badge } = PRIORITY_COLORS[level];
    for (const value of [bg, border, badge]) {
      expect(value).toBeTruthy();
      expect(value).not.toMatch(/var\([^)]*\)[0-9a-fA-F]+$/);
    }
  });
});
