import { describe, it, expect } from 'vitest';
import { buildExecutors, selectScreenshotResolver } from '@/lib/test-gate-runner/executors';
import type { GateJob } from '@/lib/test-gate-runner/types';

const anyJob = {} as GateJob;

describe('selectScreenshotResolver', () => {
  it('prefers an explicit resolver', () => {
    const r = async () => 'x';
    expect(selectScreenshotResolver({ screenshotResolver: r })).toBe(r);
  });

  it('falls back to a screenshotPath trivial resolver', async () => {
    const r = selectScreenshotResolver({ screenshotPath: 'p.png' });
    expect(await r!(anyJob)).toBe('p.png');
  });

  it('builds an autoCapture resolver when configured (closing the manual-screenshot gap)', () => {
    const r = selectScreenshotResolver({ autoCapture: { uproject: 'C:/p/PoF.uproject' } });
    expect(typeof r).toBe('function');
  });

  it('returns undefined when no screenshot source is configured (stays deferred)', () => {
    expect(selectScreenshotResolver({})).toBeUndefined();
  });
});

describe('buildExecutors', () => {
  it('includes an L4 visual executor when appOrigin + autoCapture are set', () => {
    const ex = buildExecutors({ appOrigin: 'http://x', autoCapture: { uproject: 'C:/p/PoF.uproject' } });
    expect(ex.some((e) => e.tier === 'L4')).toBe(true);
  });
});
