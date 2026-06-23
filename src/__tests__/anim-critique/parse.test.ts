import { describe, it, expect } from 'vitest';
import { parseCritique } from '@/lib/anim-critique/parse';

const GOOD = JSON.stringify({
  dimensions: { anticipation: 30, weight: 25, timing: 60, followThrough: 20, silhouette: 55, believability: 30 },
  reasons: ['no windup before the strike', 'blade stops dead — no follow-through'],
  topFix: 'add a 0.15s anticipation pulling the saber back before the downswing',
});

describe('parseCritique', () => {
  it('parses a clean JSON response into dimensions, reasons, and topFix', () => {
    const r = parseCritique(GOOD);
    expect(r.ok).toBe(true);
    expect(r.dimensions?.weight).toBe(25);
    expect(r.reasons).toHaveLength(2);
    expect(r.topFix).toContain('anticipation');
  });

  it('strips ```json markdown fences before parsing', () => {
    const r = parseCritique('```json\n' + GOOD + '\n```');
    expect(r.ok).toBe(true);
    expect(r.dimensions?.believability).toBe(30);
  });

  it('returns an error for non-JSON output', () => {
    const r = parseCritique('I think the animation looks fine, honestly.');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('returns an error when the dimensions block is missing', () => {
    const r = parseCritique(JSON.stringify({ reasons: [], topFix: 'x' }));
    expect(r.ok).toBe(false);
  });

  it('clamps out-of-range dimension scores into 0-100', () => {
    const r = parseCritique(JSON.stringify({
      dimensions: { anticipation: 120, weight: -5, timing: 50, followThrough: 50, silhouette: 50, believability: 50 },
      reasons: [], topFix: '',
    }));
    expect(r.ok).toBe(true);
    expect(r.dimensions?.anticipation).toBe(100);
    expect(r.dimensions?.weight).toBe(0);
  });
});
