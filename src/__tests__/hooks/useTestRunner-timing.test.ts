/** useTestRunner takes its timings from UI_TIMEOUTS: no local millisecond constant remains. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { UI_TIMEOUTS } from '@/lib/constants';

describe('useTestRunner timing constants', () => {
  it('declares 0 local numeric timing constants and reads both from UI_TIMEOUTS', () => {
    const src = readFileSync('src/hooks/useTestRunner.ts', 'utf8');
    const local = src.match(/^const [A-Z_]+ = [\d_]+;/gm) ?? [];
    expect(local).toEqual([]);
    expect(src).toContain('UI_TIMEOUTS.testPollInterval');
    expect(src).toContain('UI_TIMEOUTS.testPollTimeout');
    expect(UI_TIMEOUTS.testPollInterval).toBe(2_000);
    expect(UI_TIMEOUTS.testPollTimeout).toBe(120_000);
  });
});
