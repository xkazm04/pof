import { describe, it, expect } from 'vitest';
import { stepContentHash, hashScheme, isComparableHash, CONTENT_HASH_SCHEME } from '@/lib/judge/contentHash';
import { RUBRIC_VERSION, newestRubricVerdicts, isCurrentRubric } from '@/lib/judge/rubrics';
import { bridgeJudgeVerdict, verdictProvenance, judgedContentOf } from '@/lib/catalog/acceptance/judgeBridge';
import { resolveStepAcceptance } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Verdicts bind to content.
 *
 * A judge verdict used to condemn a step FOREVER: `judge_verdicts` recorded no reference to
 * the content it judged, so the bridge could only filter on rubric version. Measured against
 * the live DB when this landed: of 305 rubric-3 FAILs, only 36 still judged content the step
 * actually holds — 92 had no artifact at all and 177 had been re-produced since.
 */

const pass: AcceptanceResult = { label: 'Economy', status: 'pass', tier: 'L0', detail: '' };

function verdict(over: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    catalogId: 'items', entityId: 'e1', step: 'Economy',
    judge: 'human', verdict: 'fail', score: 40,
    findings: 'price/power ratio contradicts the sibling Attributes row',
    model: 'opus-judge', rubricVersion: RUBRIC_VERSION,
    ...over,
  };
}

describe('stepContentHash', () => {
  it('is stable across key order and nesting order', () => {
    expect(stepContentHash({ a: 1, b: { x: 1, y: [1, 2] } }))
      .toBe(stepContentHash({ b: { y: [1, 2], x: 1 }, a: 1 }));
  });

  it('changes when the content changes', () => {
    expect(stepContentHash({ price: 100 })).not.toBe(stepContentHash({ price: 101 }));
  });

  it('preserves array ORDER (a reordered list is different content)', () => {
    expect(stepContentHash({ a: [1, 2] })).not.toBe(stepContentHash({ a: [2, 1] }));
  });

  it('ignores the gallery re-roll log — browsing candidates is not a content change', () => {
    const selected = { swatch: '#abc', seed: 7 };
    expect(stepContentHash({ ...selected, genHistory: { batches: [1] } }))
      .toBe(stepContentHash({ ...selected, genHistory: { batches: [1, 2, 3] } }));
  });

  it('ignores the SERVER-STAMPED `_provenance` — the write and read paths must hash the same thing', () => {
    // `POST /api/pipeline-artifacts` (`stampPromptVersion`) always writes this key, the browser
    // never does, and `submitStepArtifact` (MCP) never does either. Hashing it made the verdict
    // write path (persisted row) and the lab read path (local artifact) structurally unable to
    // agree for every browser-produced step.
    const produced = { price: 100 };
    expect(stepContentHash({ ...produced, _provenance: { engine: 'stub', promptVersion: 'q7' } }))
      .toBe(stepContentHash(produced));
  });

  it('carries the current scheme prefix, and legacy hashes are not comparable', () => {
    expect(hashScheme(stepContentHash({ a: 1 }))).toBe(CONTENT_HASH_SCHEME);
    expect(isComparableHash('v1-abc-def')).toBe(false);
    expect(isComparableHash(stepContentHash({ a: 1 }))).toBe(true);
  });

  it('treats absent data as empty, never throwing', () => {
    expect(stepContentHash(undefined)).toBe(stepContentHash({}));
  });
});

describe('the ONE rubric filter (shared by judgeBridge and statusModel)', () => {
  it('keeps only the newest rubric present — so a bump cannot make the two consumers diverge', () => {
    const kept = newestRubricVerdicts([verdict({ rubricVersion: 2 }), verdict({ rubricVersion: 4, judge: 'llm-panel' })]);
    expect(kept.map((v) => v.rubricVersion)).toEqual([4]);
  });

  it('treats a missing rubricVersion as the pre-program v1', () => {
    const v = verdict({}); delete v.rubricVersion;
    expect(isCurrentRubric(v)).toBe(false);
    expect(newestRubricVerdicts([v])).toHaveLength(1);
  });
});

describe('verdictProvenance', () => {
  const content = judgedContentOf({ price: 100 }, '2026-07-20T00:00:00Z');

  it('current — the hash matches what the step holds now', () => {
    expect(verdictProvenance(verdict({ contentHash: content.hash }), content)).toBe('current');
  });

  it('stale — the hash disagrees (the step was re-produced)', () => {
    expect(verdictProvenance(verdict({ contentHash: stepContentHash({ price: 999 }) }), content)).toBe('stale');
  });

  it('unknown — a hash from a SUPERSEDED scheme is unbindable, and must not read as stale', () => {
    // A `v1-` hash excluded a different key set; comparing it against a v2 hash proves nothing.
    // Degrading it to `stale` would silently retire every standing condemnation at once.
    expect(verdictProvenance(verdict({ contentHash: 'v1-abc-def' }), content)).toBe('unknown');
  });

  it('stale — legacy (no hash) but judged BEFORE the artifact was last written', () => {
    expect(verdictProvenance(verdict({ judgedAt: '2026-07-01 10:00:00' }), content)).toBe('stale');
  });

  it('unknown — legacy with no way to date it against the content', () => {
    expect(verdictProvenance(verdict(), content)).toBe('unknown');
    expect(verdictProvenance(verdict({ contentHash: content.hash }), undefined)).toBe('unknown');
  });

  it('superseded — an older rubric is provisional whatever its binding', () => {
    expect(verdictProvenance(verdict({ rubricVersion: RUBRIC_VERSION - 1, contentHash: content.hash }), content)).toBe('superseded');
  });
});

describe('bridgeJudgeVerdict — a stale condemnation is cleared, never silently', () => {
  const data = { price: 100 };
  const content = judgedContentOf(data, '2026-07-20T00:00:00Z');

  it('a BOUND current verdict still condemns the shape-pass', () => {
    const r = bridgeJudgeVerdict(pass, [verdict({ contentHash: content.hash })], undefined, content);
    expect(r.status).toBe('fail');
    expect(r.judge?.provenance).toBe('current');
  });

  it('a re-produce clears the condemnation — and reports the step as UNJUDGED, not passed', () => {
    const stale = verdict({ contentHash: stepContentHash({ price: 999 }) });
    const r = bridgeJudgeVerdict(pass, [stale], undefined, content);
    expect(r.status).toBe('pass');                    // no longer condemned
    expect(r.judge?.provenance).toBe('stale');        // …but distinguishable in the data
    expect(r.judge?.verdict).toBe('fail');
    expect(r.judge?.note).toMatch(/no longer holds/i);
    expect(r.judge?.note).toMatch(/UNJUDGED, not judged-and-passed/);
  });

  it('a LEGACY verdict degrades to unknown-provenance: still applied, but labelled', () => {
    const r = bridgeJudgeVerdict(pass, [verdict()], undefined, content);
    expect(r.status).toBe('fail');
    expect(r.judge?.provenance).toBe('unknown');
    expect(r.reason).toContain('unverified provenance');
  });

  it('a superseded-rubric fail neither condemns nor disappears', () => {
    const r = bridgeJudgeVerdict(pass, [verdict({ rubricVersion: RUBRIC_VERSION - 1 })], undefined, content);
    expect(r.status).toBe('pass');
    expect(r.judge?.provenance).toBe('superseded');
    expect(r.judge?.note).toMatch(/re-judge/i);
  });

  it('a current binding wins over a stale one for the same step', () => {
    const r = bridgeJudgeVerdict(
      pass,
      [verdict({ judge: 'llm-panel', contentHash: stepContentHash({ price: 1 }) }), verdict({ contentHash: content.hash })],
      undefined, content,
    );
    expect(r.status).toBe('fail');
    expect(r.judge?.provenance).toBe('current');
  });

  it('no verdicts at all leaves the result — and its `judge` field — untouched', () => {
    const r = bridgeJudgeVerdict(pass, [], undefined, content);
    expect(r).toEqual(pass);
    expect(r.judge).toBeUndefined();
  });
});

describe('resolveStepAcceptance — end-to-end binding', () => {
  it('condemns while the content matches, and clears once the step is re-produced', () => {
    const judged = { price: 100 };
    const v = verdict({ contentHash: stepContentHash(judged) });

    const before = resolveStepAcceptance({ catalogId: 'items', step: 'Economy', local: pass, verdicts: [v], data: judged });
    expect(before.status).toBe('fail');

    const after = resolveStepAcceptance({ catalogId: 'items', step: 'Economy', local: pass, verdicts: [v], data: { price: 120 } });
    expect(after.status).toBe('pass');
    expect(after.judge?.provenance).toBe('stale');
  });
});
