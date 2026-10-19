import { describe, it, expect } from 'vitest';
import { createRunSession } from '@/lib/one-shot/runSession';

describe('runSession', () => {
  it('begin() twice: the first run is no longer live and its signal is aborted', () => {
    const s = createRunSession();
    const a = s.begin('analyze');
    const b = s.begin('analyze');
    expect(a.isLive()).toBe(false);
    expect(a.signal.aborted).toBe(true);
    expect(b.isLive()).toBe(true);
    expect(b.signal.aborted).toBe(false);
    expect(b.epoch).toBeGreaterThan(a.epoch);
  });

  it('cancel() with no live run returns false; with one it aborts and returns true', () => {
    const s = createRunSession();
    expect(s.cancel()).toBe(false);
    const r = s.begin('pipeline');
    expect(s.cancel()).toBe(true);
    expect(r.isLive()).toBe(false);
    expect(r.signal.aborted).toBe(true);
    expect(s.cancel()).toBe(false);
  });

  it('a claimed run cannot be claimed again until it ends or is cancelled', () => {
    const s = createRunSession();
    const a = s.claim('pipeline');
    expect(a).not.toBeNull();
    expect(s.claim('pipeline')).toBeNull();
    a!.end();
    const b = s.claim('pipeline');
    expect(b).not.toBeNull();
    s.cancel();
    expect(s.claim('pipeline')).not.toBeNull();
  });

  it('end() of a superseded run does not release the newer run', () => {
    const s = createRunSession();
    const a = s.begin('x');
    const b = s.begin('x');
    a.end();
    expect(b.isLive()).toBe(true);
    expect(s.claim('x')).toBeNull();
  });
});
