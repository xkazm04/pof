/**
 * The A-axis projection (src/lib/status/craft.ts) — the craft ladder's laws:
 * rung order pinned, precedence (ungauged → stale → at-ceiling → gauged), version
 * invalidation, and the display codes. Pure module, no DB.
 */
import { describe, it, expect } from 'vitest';
import {
  A_LADDER,
  CRAFT_NAME,
  CRAFT_MEANING,
  craftRank,
  craftOf,
  craftCode,
  craftLabel,
  distanceToRoof,
  CRAFT_STATE_GLYPH,
} from '@/lib/status/craft';

describe('craft ladder order', () => {
  it('pins the rung order A0..A4 and rank follows it', () => {
    expect(A_LADDER).toEqual(['A0', 'A1', 'A2', 'A3', 'A4']);
    expect(A_LADDER.map(craftRank)).toEqual([0, 1, 2, 3, 4]);
  });

  it('every rung has a name and a meaning', () => {
    for (const level of A_LADDER) {
      expect(CRAFT_NAME[level].length).toBeGreaterThan(0);
      expect(CRAFT_MEANING[level].length).toBeGreaterThan(0);
    }
  });
});

describe('craftOf precedence', () => {
  const base = { currentLensVersion: 2, ceiling: 'A4' as const };

  it('no verdict → A0 UNGAUGED', () => {
    const c = craftOf({ ...base });
    expect(c.level).toBe('A0');
    expect(c.state).toBe('gauged');
  });

  it('verdict under an older lens version → A0, never its old level', () => {
    const c = craftOf({ ...base, verdict: { aLevel: 'A3', lensVersion: 1 } });
    expect(c.level).toBe('A0');
    expect(c.because).toContain('v1');
    expect(c.because).toContain('v2');
  });

  it('content changed since gauged → stale at the recorded level', () => {
    const c = craftOf({
      ...base,
      verdict: { aLevel: 'A3', lensVersion: 2, artifactUpdatedAt: '2026-07-01 10:00:00' },
      artifactUpdatedAt: '2026-07-20 10:00:00',
    });
    expect(c.level).toBe('A3');
    expect(c.state).toBe('stale');
  });

  it('stale beats at-ceiling — a stale gauge must not read as roof reached', () => {
    const c = craftOf({
      currentLensVersion: 1,
      ceiling: 'A2',
      verdict: { aLevel: 'A2', lensVersion: 1, artifactUpdatedAt: '2026-07-01 10:00:00' },
      artifactUpdatedAt: '2026-07-20 10:00:00',
    });
    expect(c.state).toBe('stale');
  });

  it('missing verdict anchor degrades to NOT-stale (staleness unknown, never fabricated)', () => {
    const c = craftOf({
      ...base,
      verdict: { aLevel: 'A2', lensVersion: 2 },
      artifactUpdatedAt: '2026-07-20 10:00:00',
    });
    expect(c.state).toBe('gauged');
  });

  it('at the medium ceiling → at-ceiling (achievement, not shame)', () => {
    const c = craftOf({ currentLensVersion: 1, ceiling: 'A2', verdict: { aLevel: 'A2', lensVersion: 1 } });
    expect(c.state).toBe('at-ceiling');
    expect(c.because).toContain('A2');
  });

  it('below the ceiling under the current lens → plain gauged', () => {
    const c = craftOf({ ...base, verdict: { aLevel: 'A2', lensVersion: 2 } });
    expect(c.level).toBe('A2');
    expect(c.state).toBe('gauged');
  });
});

describe('distanceToRoof', () => {
  it('A0 counts the full climb; at-ceiling is 0; never negative', () => {
    expect(distanceToRoof('A0', 'A4')).toBe(4);
    expect(distanceToRoof('A2', 'A2')).toBe(0);
    expect(distanceToRoof('A3', 'A2')).toBe(0);
    expect(distanceToRoof('A1', 'A3')).toBe(2);
  });
});

describe('display codes', () => {
  it('craftCode appends the state glyph', () => {
    expect(craftCode({ level: 'A2', state: 'at-ceiling', because: '' })).toBe('A2^');
    expect(craftCode({ level: 'A3', state: 'stale', because: '' })).toBe('A3~');
    expect(craftCode({ level: 'A1', state: 'gauged', because: '' })).toBe('A1');
  });

  it('glyphs are distinct and gauged is unmarked', () => {
    expect(CRAFT_STATE_GLYPH.gauged).toBe('');
    expect(CRAFT_STATE_GLYPH['at-ceiling']).not.toBe(CRAFT_STATE_GLYPH.stale);
  });

  it('craftLabel speaks level, name, state and because', () => {
    const label = craftLabel({ level: 'A3', state: 'gauged', because: 'why' });
    expect(label).toContain('A3');
    expect(label).toContain('AA');
    expect(label).toContain('why');
  });
});
