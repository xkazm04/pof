import { describe, it, expect } from 'vitest';
import { buildVerdictTrend, trendPointLabel, trendSummary } from '@/lib/judge/verdictTrend';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

const v = (score: number, judgedAt: string, extra: Partial<JudgeVerdict> = {}): JudgeVerdict => ({
  catalogId: 'items', entityId: 'sword', step: 'Economy', judge: 'llm-panel',
  verdict: score >= 60 ? 'pass' : 'fail', score, findings: 'f', model: 'opus', judgedAt, ...extra,
});

describe('buildVerdictTrend — did my fix actually improve this?', () => {
  it('orders oldest-first and reports the delta between the first and latest judgment', () => {
    const t = buildVerdictTrend([v(41, '2026-07-20 10:00'), v(58, '2026-07-22 09:00'), v(77, '2026-07-28 18:30')]);
    expect(t.points.map((p) => p.score)).toEqual([41, 58, 77]);
    expect(t.delta).toBe(36);
    expect(t.direction).toBe('improved');
    expect(t.best).toBe(77);
    expect(t.worst).toBe(41);
  });

  it('sorts by judgedAt even when the log is handed over out of order', () => {
    const t = buildVerdictTrend([v(77, '2026-07-28 18:30'), v(41, '2026-07-20 10:00')]);
    expect(t.points.map((p) => p.score)).toEqual([41, 77]);
    expect(t.direction).toBe('improved');
  });

  it('names a regression and a flat re-judge', () => {
    expect(buildVerdictTrend([v(80, '2026-07-01 00:00'), v(55, '2026-07-02 00:00')]).direction).toBe('regressed');
    expect(buildVerdictTrend([v(80, '2026-07-01 00:00'), v(80, '2026-07-02 00:00')]).direction).toBe('unchanged');
  });

  it('has NO trend from a single judgment — and says so instead of implying one', () => {
    const t = buildVerdictTrend([v(72, '2026-07-01 00:00')]);
    expect(t.delta).toBeNull();
    expect(t.direction).toBe('none');
    expect(trendSummary(t)).toContain('no prior verdict');
    const empty = buildVerdictTrend([]);
    expect(empty.points).toEqual([]);
    expect(trendSummary(empty)).toContain('No judgments recorded');
  });

  it('flags a re-judge that read the SAME content (a rise there is variance, not a fix)', () => {
    const t = buildVerdictTrend([
      v(60, '2026-07-01 00:00', { contentHash: 'v2:aaa' }),
      v(74, '2026-07-02 00:00', { contentHash: 'v2:aaa' }),
      v(80, '2026-07-03 00:00', { contentHash: 'v2:bbb' }),
    ]);
    expect(t.points.map((p) => p.sameContentAsPrevious)).toEqual([null, true, false]);
  });

  it('never claims "same content" when either side has no binding', () => {
    const t = buildVerdictTrend([v(60, '2026-07-01 00:00'), v(74, '2026-07-02 00:00', { contentHash: 'v2:aaa' })]);
    expect(t.points[1].sameContentAsPrevious).toBe(false);
  });

  it('labels points readably, and falls back to an index when a judgment is undated', () => {
    expect(trendPointLabel({ score: 1, verdict: 'pass', model: 'm', judgedAt: '2026-07-29 14:03:11', sameContentAsPrevious: null }, 0)).toBe('07-29 14:03');
    expect(trendPointLabel({ score: 1, verdict: 'pass', model: 'm', sameContentAsPrevious: null }, 2)).toBe('#3');
  });

  it('summarises a real trend with both endpoints', () => {
    const s = trendSummary(buildVerdictTrend([v(41, '2026-07-20 10:00'), v(77, '2026-07-28 18:30')]));
    expect(s).toContain('improved +36');
    expect(s).toContain('41 → 77');
  });
});
