import { describe, it, expect } from 'vitest';
import { scoreCard } from '@/lib/anim-critique/score';

const STRONG = { anticipation: 80, weight: 80, timing: 80, followThrough: 80, silhouette: 80, believability: 80 };

describe('scoreCard', () => {
  it('averages the dimensions and passes a strong motion', () => {
    const r = scoreCard(STRONG);
    expect(r.score).toBe(80);
    expect(r.verdict).toBe('pass');
  });

  it('fails a stiff motion (low weight, no anticipation/follow-through)', () => {
    const r = scoreCard({ anticipation: 20, weight: 25, timing: 40, followThrough: 15, silhouette: 50, believability: 25 });
    // (20+25+40+15+50+25)/6 = 29.17 -> 29
    expect(r.score).toBe(29);
    expect(r.verdict).toBe('fail');
  });

  it('warns a middling motion', () => {
    const r = scoreCard({ anticipation: 55, weight: 55, timing: 55, followThrough: 55, silhouette: 55, believability: 55 });
    expect(r.score).toBe(55);
    expect(r.verdict).toBe('warn');
  });

  it('honors a stricter passAt threshold', () => {
    const r = scoreCard(STRONG, { passAt: 90 });
    expect(r.verdict).toBe('warn'); // 80 < 90 pass, but >= 45 warn
  });
});

describe('scoreCard does not average away a broken dimension', () => {
  it('refuses to pass a card that is excellent on five dimensions and broken on one', () => {
    const r = scoreCard({
      anticipation: 90, weight: 90, timing: 90, followThrough: 90, silhouette: 90, believability: 10,
    });
    expect(r.verdict).not.toBe('pass');
    expect(r.verdict).toBe('fail');
  });

  it('names the dimension that capped the verdict', () => {
    const r = scoreCard({
      anticipation: 90, weight: 90, timing: 90, followThrough: 90, silhouette: 90, believability: 10,
    });
    expect(r.worstDimension).toBe('believability');
    expect(r.worstScore).toBe(10);
    expect(r.reason).toContain('believability');
  });

  it('caps a five-strong card to warn when the weak dimension only warns', () => {
    const r = scoreCard({
      anticipation: 95, weight: 95, timing: 95, followThrough: 95, silhouette: 95, believability: 50,
    });
    expect(r.verdict).toBe('warn');
    expect(r.worstDimension).toBe('believability');
  });

  it('still reports the mean as the score, so trend telemetry is unchanged', () => {
    const r = scoreCard({
      anticipation: 90, weight: 90, timing: 90, followThrough: 90, silhouette: 90, believability: 10,
    });
    expect(r.score).toBe(77); // (90*5+10)/6 = 76.67 -> 77
  });
});
