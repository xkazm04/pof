import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCORE_BANDS, OPACITY_37, OPACITY_40, BORDER_HOVER } from '@/lib/chart-colors';
import { CLI_ANIM } from '@/lib/constants';
import { DURATION } from '@/lib/motion';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf-8');

describe('token-layer comments state the cuts the code uses', () => {
  it('ScoreRing documents the SCORE_BANDS orange cut', () => {
    const orangeMin = SCORE_BANDS[2].min;
    const src = read('src/components/ui/ScoreRing.tsx');
    expect(src).toContain(`>=${orangeMin} orange`);
    expect(src).not.toContain('>=40 orange');
  });

  it('BORDER_HOVER documents the percentage its alias really is', () => {
    expect(BORDER_HOVER).toBe(OPACITY_40);
    expect(OPACITY_37).toBe(OPACITY_40);
    const src = read('src/lib/chart-colors.ts');
    const line = src.split(/\r?\n/).find((l) => l.includes('Hover border opacity')) ?? '';
    expect(line).toContain('(40%)');
    expect(line).not.toContain('37%');
  });

  it('CLI_ANIM.fast derives from DURATION.fast instead of restating it', () => {
    expect(CLI_ANIM.fast.duration).toBe(DURATION.fast);
    const src = read('src/lib/constants.ts');
    expect(src).toMatch(/fast: \{ duration: DURATION\.fast,/);
  });
});
