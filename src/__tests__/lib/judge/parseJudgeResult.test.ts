/**
 * `parseJudgeResult` robustness — the parse seam between a paid judge draw and the verdict POST.
 *
 * A draw is the most expensive call this app makes; a parse that hands the route a value the
 * route's own schema refuses loses the verdict AFTER paying for it (`judge-run` prints
 * "(POST FAIL)" and the step stays unjudged). So whatever the parser returns must already be
 * admissible: the score is clamped to 0-100 (pinned in judge.test.ts) and so is every
 * dimension, which the route schema checks with the same 0-100 bound.
 */
import { describe, it, expect } from 'vitest';
import { parseJudgeResult } from '@/lib/judge/rubrics';

const wrap = (dimensions: unknown) =>
  JSON.stringify({ dimensions, score: 82, verdict: 'fail', findings: 'flat value structure, muddy edges', fix: 'add rim light' });

/** The route's dimension rule (`POST /api/judge-verdicts` verdictSchema.dimensions). */
const admissibleDims = (d: Record<string, unknown>) =>
  Object.values(d).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100);

describe('parseJudgeResult — dimensions are admissible by construction', () => {
  it('clamps out-of-range dimension scores the same way it clamps the overall score', () => {
    const r = parseJudgeResult(wrap({ silhouette: 120, edgeQuality: -5, cleanliness: 71.6 }));
    expect(r).not.toBeNull();
    expect(r!.dimensions).toEqual({ silhouette: 100, edgeQuality: 0, cleanliness: 72 });
    expect(admissibleDims(r!.dimensions)).toBe(true);
  });

  it('drops a dimension that is not a finite number instead of passing it to the route', () => {
    const r = parseJudgeResult(wrap({ silhouette: '85', edgeQuality: null, cleanliness: 64, extra: { a: 1 } }));
    expect(r).not.toBeNull();
    expect(r!.dimensions).toEqual({ cleanliness: 64 });
    expect(admissibleDims(r!.dimensions)).toBe(true);
  });

  it('a non-object dimensions value parses to an empty map, never a string or array', () => {
    for (const d of ['high', [90, 80], 42]) {
      const r = parseJudgeResult(wrap(d));
      expect(r).not.toBeNull();
      expect(r!.dimensions).toEqual({});
    }
  });

  it('well-formed dimensions are kept exactly', () => {
    const r = parseJudgeResult(wrap({ silhouette: 40, valueHierarchy: 55 }));
    expect(r!.dimensions).toEqual({ silhouette: 40, valueHierarchy: 55 });
  });
});
