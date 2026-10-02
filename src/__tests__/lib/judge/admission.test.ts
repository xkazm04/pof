/**
 * The judge verdict admission door + the read-side defence for rows stamped under a rubric
 * this build does not hold.
 *
 * Honest-floor rule (binding): a tightening only ever removes a PASS's power, never a FAIL's.
 *  - write side: a future-rubric PASS and a current-rubric non-human PASS below the shippable
 *    band are refused; a FAIL at any score, and a future-rubric FAIL, are admitted.
 *  - read side: selection still keeps the newest rubric PRESENT; a future-rubric row reads
 *    `unknown` provenance — it can condemn (fail) but never elevate (pass).
 */
import { describe, it, expect } from 'vitest';
import { admitJudgeVerdict } from '@/lib/judge/admission';
import { BANDS, RUBRIC_VERSION, isCurrentRubric, newestRubricVerdicts } from '@/lib/judge/rubrics';
import { rubricStanding } from '@/lib/judge/verdictStanding';
import { verdictProvenance, judgedContentOf, unverifiedReason } from '@/lib/catalog/acceptance/judgeBridge';
import { deriveCell, type StepFact } from '@/lib/status/statusModel';
import { stepContentHash } from '@/lib/judge/contentHash';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

const FUTURE = RUBRIC_VERSION + 1;

const claim = (over: Partial<JudgeVerdict>): JudgeVerdict => ({
  catalogId: 'items', entityId: 'e1', step: 'Concept Brief', judge: 'llm-panel', verdict: 'pass',
  score: 95, findings: 'fifteen plus characters of findings', model: 'm', rubricVersion: RUBRIC_VERSION, ...over,
});

describe('admitJudgeVerdict — the write door', () => {
  it('refuses a PASS stamped under a rubric this build does not hold, naming both versions', () => {
    const r = admitJudgeVerdict(claim({ rubricVersion: FUTURE }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.join(' ')).toContain(`rubric v${FUTURE} is not in force (current v${RUBRIC_VERSION})`);
  });

  it('refuses a current-rubric non-human PASS below the shippable band', () => {
    const r = admitJudgeVerdict(claim({ score: BANDS.shippable - 5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.join(' ')).toContain(String(BANDS.shippable));
  });

  it('[honest floor] admits a FAIL at any score — a stricter condemnation is never refused', () => {
    expect(admitJudgeVerdict(claim({ verdict: 'fail', score: 95 })).ok).toBe(true);
    expect(admitJudgeVerdict(claim({ verdict: 'fail', score: 95, rubricVersion: FUTURE })).ok).toBe(true);
  });

  it('[guard] admits every existing writer shape', () => {
    // batch-inject.mjs / power-icon: vlm, no rubric stamp (v1), pass at 70
    expect(admitJudgeVerdict(claim({ judge: 'vlm', rubricVersion: undefined, score: 70 })).ok).toBe(true);
    // content-binding tests: human fail 41 at the current rubric
    expect(admitJudgeVerdict(claim({ judge: 'human', verdict: 'fail', score: 41 })).ok).toBe(true);
    // judge-run.ts: band-derived verdicts at the current rubric
    expect(admitJudgeVerdict(claim({ score: BANDS.shippable })).ok).toBe(true);
    expect(admitJudgeVerdict(claim({ verdict: 'fail', score: 62 })).ok).toBe(true);
    // a human reviewer is not a band-derived judge
    expect(admitJudgeVerdict(claim({ judge: 'human', score: 85 })).ok).toBe(true);
  });
});

describe('read side — a future-rubric row can condemn, never elevate', () => {
  const DATA = { brief: 'a written concept brief', budget: 42 };
  const HASH = stepContentHash(DATA);
  const fact: StepFact = {
    catalogId: 'items', step: 'Brief', trueEngine: 'Claude', deliverable: 'text-config',
    generatorWired: true, judge: 'llm-panel', checkerMeaningful: false, note: 'prose brief',
  };
  const held: PipelineArtifact = {
    catalogId: 'items', entityId: 'e1', step: 'Brief', data: DATA, ueAssets: [], status: 'pass', tier: 'L0',
  };
  const v = (verdict: 'pass' | 'fail', rubricVersion: number, score: number): JudgeVerdict =>
    claim({ step: 'Brief', verdict, rubricVersion, score, contentHash: HASH });

  it('[guard] selection keeps the newest rubric PRESENT (unchanged) — a future fail still speaks', () => {
    expect(newestRubricVerdicts([v('pass', RUBRIC_VERSION, 95), v('fail', FUTURE, 40)]).map((x) => x.verdict)).toEqual(['fail']);
  });

  it('a future-rubric verdict is not the current rubric and reads `unknown` provenance, bound or not', () => {
    const future = v('pass', FUTURE, 95);
    expect(isCurrentRubric(future)).toBe(false);
    expect(verdictProvenance(future, judgedContentOf(DATA))).toBe('unknown');
    expect(unverifiedReason(future)).toContain(`rubric v${FUTURE}`);
  });

  it('rubricStanding names a future rubric honestly', () => {
    expect(rubricStanding(v('pass', FUTURE, 95))).toContain(`rubric v${FUTURE} is not in force here (v${RUBRIC_VERSION})`);
    expect(rubricStanding(v('pass', RUBRIC_VERSION, 95))).toBeNull();
  });

  it('[guard] [v4 pass 95 current, v5 fail] → condemned, not verified', () => {
    const c = deriveCell('Brief', 'Claude', [held], fact, [v('pass', RUBRIC_VERSION, 95), v('fail', FUTURE, 40)]);
    expect(c.grade).toBe('attention');
    expect(c.judged?.verdict).toBe('fail');
  });

  it('[v4 fail, v5 pass] → not elevated; the future pass reads `unknown`', () => {
    const c = deriveCell('Brief', 'Claude', [held], fact, [v('fail', RUBRIC_VERSION, 40), v('pass', FUTURE, 95)]);
    expect(c.grade).not.toBe('verified');
    expect(c.judgeAttribution?.provenance).toBe('unknown');
    expect(c.judgeAttribution?.applied).toBe(false);
  });
});
