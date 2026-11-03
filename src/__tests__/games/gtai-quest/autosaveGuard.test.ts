import { describe, expect, it } from 'vitest';
import { assessQuest } from '@/lib/games/gtai-quest/assess';
import { AUTOSAVE_REQUIRED_FROM, assessAutosave, predatesAutosave } from '@/lib/games/gtai-quest/autosaveGuard';
import { CLEAN, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { AutosavePoint, QuestDesign } from '@/lib/games/gtai-quest/types';

const pt = (o: Partial<AutosavePoint> = {}): AutosavePoint => ({ id: 'as-the-run', beat: 'the-run', at: 'start', why: 'The run is the long part, so a miss replays only it.', ...o });
const withPoints = (points: unknown): QuestDesign => mutate((d) => { (d as { autosavePoints?: unknown }).autosavePoints = points; });
const refs = (d: QuestDesign, at?: string) => assessAutosave(d, at).findings.map((f) => `${f.code}@${f.ref}`);

describe('assessAutosave', () => {
  it('green for valid points', () => {
    const v = assessAutosave(withPoints([pt(), pt({ id: 'as-payoff', beat: 'the-payoff', at: 'end' })]));
    expect(v.state).toBe('green');
    expect(v.findings).toEqual([]);
    expect(v.guard).toBe('autosave');
  });

  it('missing or empty points are red for a new design, named AUTOSAVE_MISSING', () => {
    expect(refs(withPoints(undefined))).toEqual(['AUTOSAVE_MISSING@undefined']);
    const v = assessAutosave(withPoints([]), '2026-11-04T08:00:00Z');
    expect(v.state).toBe('red');
    expect(v.findings[0].code).toBe('AUTOSAVE_MISSING');
  });

  it('a package fused before the requirement is warned, not failed', () => {
    const v = assessAutosave(withPoints(undefined), '2026-11-02T18:53:38.036Z');
    expect(v.state).toBe('green');
    expect(v.findings.map((f) => `${f.code}:${f.severity}`)).toEqual(['AUTOSAVE_MISSING:warn']);
    expect(predatesAutosave('2026-11-03')).toBe(true);
    expect(predatesAutosave(AUTOSAVE_REQUIRED_FROM)).toBe(false);
    expect(predatesAutosave(undefined)).toBe(false);
    expect(predatesAutosave('yesterday')).toBe(false);
  });

  it.each([
    ['an unknown beat id', pt({ beat: 'the-moon' }), 'AUTOSAVE_UNKNOWN_BEAT@as-the-run'],
    ['a bad "at"', pt({ at: 'middle' as 'start' }), 'AUTOSAVE_BAD_AT@as-the-run'],
    ['an empty why', pt({ why: '  ' }), 'AUTOSAVE_EMPTY_WHY@as-the-run'],
  ])('red on %s, naming the point', (_n, point, expected) => {
    expect(refs(withPoints([point]))).toEqual([expected]);
    expect(assessAutosave(withPoints([point])).state).toBe('red');
  });

  it('red on a duplicate id, naming it', () => {
    expect(refs(withPoints([pt(), pt({ at: 'end' })]))).toEqual(['AUTOSAVE_DUPLICATE_ID@as-the-run']);
  });

  it('a malformed entry is named by index and never throws', () => {
    expect(refs(withPoints([null, 'x']))).toEqual([
      'AUTOSAVE_BAD_SHAPE@#0', 'AUTOSAVE_UNKNOWN_BEAT@#0', 'AUTOSAVE_BAD_AT@#0', 'AUTOSAVE_EMPTY_WHY@#0',
      'AUTOSAVE_BAD_SHAPE@#1', 'AUTOSAVE_UNKNOWN_BEAT@#1', 'AUTOSAVE_BAD_AT@#1', 'AUTOSAVE_EMPTY_WHY@#1',
    ]);
  });

  it('a non-array autosavePoints counts as missing', () => {
    expect(refs(withPoints('as-b2'))).toEqual(['AUTOSAVE_MISSING@undefined']);
  });
});

describe('assessQuest wiring', () => {
  it('blocks on a bad autosave point and the owner cannot override it away', () => {
    const bad = withPoints([pt({ beat: 'the-moon' })]);
    const v = assessQuest('x', bad, ctx(), [{ guard: 'autosave', reason: 'because', at: '2026-11-03' }]);
    expect(v.blockedBy).toContain('autosave');
  });

  it('a clean design passes the autosave guard; designedAt grandfathers an old package', () => {
    expect(assessQuest('x', CLEAN, ctx()).guards.find((g) => g.guard === 'autosave')?.state).toBe('green');
    const old = withPoints(undefined);
    expect(assessQuest('x', old, ctx(), [], 'x', '2026-11-02').guards.find((g) => g.guard === 'autosave')?.state).toBe('green');
    expect(assessQuest('x', old, ctx()).guards.find((g) => g.guard === 'autosave')?.state).toBe('red');
  });
});
