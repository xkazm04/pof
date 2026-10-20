/**
 * The one binding rule - and the parity table proving judge provenance, craft staleness and the
 * re-judge skip all read the same (recorded, current, timestamps) fixtures the same way.
 */
import { describe, it, expect } from 'vitest';
import { classifyBinding, sameContent } from '@/lib/judge/bindingRule';
import { stepContentHash } from '@/lib/judge/contentHash';
import { verdictProvenance } from '@/lib/catalog/acceptance/judgeBridge';
import { craftOf } from '@/lib/status/craft';
import { judgeSkipDecision } from '@/lib/judge/fleetPlan';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { buildCraftTrend } from '@/lib/craft/craftCell';
import { buildVerdictTrend } from '@/lib/judge/verdictTrend';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

const dA = { text: 'alpha' };
const dB = { text: 'beta' };
const hA = stepContentHash(dA);
const hB = stepContentHash(dB);
const V2 = 'v2-deadbeef';

describe('classifyBinding', () => {
  it('equal current-scheme hashes -> current', () => {
    expect(classifyBinding({ recordedHash: hA, currentHash: hA }).state).toBe('current');
  });
  it('different hashes -> stale, "content changed", regardless of timestamps', () => {
    const r = classifyBinding({ recordedHash: hA, currentHash: hB, recordedAt: '2030-01-01T00:00:00Z', currentUpdatedAt: '2020-01-01T00:00:00Z' });
    expect(r.state).toBe('stale');
    expect(r.reason).toContain('content changed');
  });
  it('a superseded scheme is unknown and names both schemes, never current', () => {
    const r = classifyBinding({ recordedHash: V2, currentHash: hA });
    expect(r.state).toBe('unknown');
    expect(r.reason).toContain('v2');
    expect(r.reason).toContain('v3');
  });
  it('no recorded hash: judged before the write -> stale; otherwise unknown, never current', () => {
    expect(classifyBinding({ recordedAt: '2026-01-01T00:00:00Z', currentUpdatedAt: '2026-02-01T00:00:00Z' }).state).toBe('stale');
    expect(classifyBinding({ recordedAt: '2026-02-01T00:00:00Z', currentUpdatedAt: '2026-02-01T00:00:00Z' }).state).toBe('unknown');
    expect(classifyBinding({ recordedAt: '2026-03-01T00:00:00Z', currentUpdatedAt: '2026-02-01T00:00:00Z' }).state).toBe('unknown');
  });
  it('timestampFallback none never goes stale on time', () => {
    expect(
      classifyBinding({ recordedAt: '2026-01-01T00:00:00Z', currentUpdatedAt: '2026-02-01T00:00:00Z', timestampFallback: 'none' }).state,
    ).toBe('unknown');
  });
  it('unprovable mode (craft) falls back to the timestamp when the hash cannot be compared', () => {
    const base = { recordedAt: '2026-01-01T00:00:00Z', currentUpdatedAt: '2026-02-01T00:00:00Z', timestampFallback: 'unprovable' as const };
    expect(classifyBinding({ ...base, recordedHash: V2, currentHash: hA }).state).toBe('stale');
    expect(classifyBinding({ ...base, recordedHash: hA }).state).toBe('stale');
  });
});

describe('parity table: judge provenance, craft staleness and skip agree', () => {
  type Fx = { name: string; recorded?: string; current: Record<string, unknown>; judgedAt?: string; updatedAt?: string; expected: 'current' | 'stale' | 'unknown' };
  const fixtures: Fx[] = [
    { name: 'same content', recorded: hA, current: dA, expected: 'current' },
    { name: 'changed content', recorded: hA, current: dB, expected: 'stale' },
    { name: 'older scheme', recorded: V2, current: dA, expected: 'unknown' },
    { name: 'hashless, no timestamps', current: dA, expected: 'unknown' },
    { name: 'hashless, judged after write', current: dA, judgedAt: '2026-03-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z', expected: 'unknown' },
    { name: 'same content, timestamps disagree', recorded: hA, current: dA, judgedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z', expected: 'current' },
  ];

  for (const f of fixtures) {
    it(f.name, () => {
      const content = { hash: stepContentHash(f.current), updatedAt: f.updatedAt };
      const judge = verdictProvenance(
        { rubricVersion: RUBRIC_VERSION, contentHash: f.recorded, judgedAt: f.judgedAt } as unknown as JudgeVerdict,
        content,
      );
      const craft = craftOf({
        verdict: { aLevel: 'A1', lensVersion: 1, contentHash: f.recorded, artifactUpdatedAt: f.judgedAt },
        currentLensVersion: 1,
        ceiling: 'A4',
        artifact: content,
      });
      const skip = judgeSkipDecision({
        data: f.current,
        prior: { judge: 'j', verdict: 'pass', score: 80, contentHash: f.recorded, rubricVersion: RUBRIC_VERSION } as never,
        rubricVersion: RUBRIC_VERSION,
      });
      const skipState = skip.skip ? 'current' : skip.reason.includes('content changed') ? 'stale' : 'unknown';
      expect(judge).toBe(f.expected);
      expect(skipState).toBe(f.expected);
      expect(craft.state === 'stale').toBe(f.expected === 'stale');
    });
  }

  it('hashless judged-before-write is stale for judge and craft alike', () => {
    const content = { hash: hA, updatedAt: '2026-02-01T00:00:00Z' };
    expect(verdictProvenance({ rubricVersion: RUBRIC_VERSION, judgedAt: '2026-01-01T00:00:00Z' } as unknown as JudgeVerdict, content)).toBe('stale');
    expect(
      craftOf({ verdict: { aLevel: 'A1', lensVersion: 1, artifactUpdatedAt: '2026-01-01T00:00:00Z' }, currentLensVersion: 1, ceiling: 'A4', artifact: content }).state,
    ).toBe('stale');
  });
});

describe('sameContent and the trend builders', () => {
  it('craft trend: identical contentHash with different artifactUpdatedAt -> same content', () => {
    const t = buildCraftTrend([
      { aLevel: 'A1', lensVersion: 1, model: 'm', contentHash: hA, artifactUpdatedAt: '2026-01-01T00:00:00Z', judgedAt: '2026-01-02T00:00:00Z' },
      { aLevel: 'A2', lensVersion: 1, model: 'm', contentHash: hA, artifactUpdatedAt: '2026-01-05T00:00:00Z', judgedAt: '2026-01-06T00:00:00Z' },
    ]);
    expect(t.points[1].sameContentAsPrevious).toBe(true);
  });
  it('craft trend: a row lacking a hash while the other has one is never "same"', () => {
    const t = buildCraftTrend([
      { aLevel: 'A1', lensVersion: 1, model: 'm', contentHash: hA, artifactUpdatedAt: '2026-01-01T00:00:00Z', judgedAt: '2026-01-02T00:00:00Z' },
      { aLevel: 'A2', lensVersion: 1, model: 'm', artifactUpdatedAt: '2026-01-01T00:00:00Z', judgedAt: '2026-01-06T00:00:00Z' },
    ]);
    expect(t.points[1].sameContentAsPrevious).toBe(false);
  });
  it('craft trend: legacy rows without any hash keep the artifactUpdatedAt equality', () => {
    const t = buildCraftTrend([
      { aLevel: 'A1', lensVersion: 1, model: 'm', artifactUpdatedAt: '2026-01-01T00:00:00Z', judgedAt: '2026-01-02T00:00:00Z' },
      { aLevel: 'A2', lensVersion: 1, model: 'm', artifactUpdatedAt: '2026-01-01T00:00:00Z', judgedAt: '2026-01-06T00:00:00Z' },
    ]);
    expect(t.points[1].sameContentAsPrevious).toBe(true);
  });
  it('verdict trend: one row lacking a hash -> false; both equal -> true', () => {
    const v = (judgedAt: string, contentHash?: string): JudgeVerdict =>
      ({ catalogId: 'c', entityId: 'e', step: 's', judge: 'j', verdict: 'pass', score: 70, findings: '', model: 'm', judgedAt, contentHash }) as unknown as JudgeVerdict;
    expect(buildVerdictTrend([v('2026-01-01 00:00', hA), v('2026-01-02 00:00')]).points[1].sameContentAsPrevious).toBe(false);
    expect(buildVerdictTrend([v('2026-01-01 00:00', hA), v('2026-01-02 00:00', hA)]).points[1].sameContentAsPrevious).toBe(true);
  });
  it('sameContent helper', () => {
    expect(sameContent({}, {})).toBe(false);
    expect(sameContent({ anchor: 'x' }, { anchor: 'x' })).toBe(true);
    expect(sameContent({ contentHash: 'a', anchor: 'x' }, { contentHash: 'b', anchor: 'x' })).toBe(false);
  });
});
