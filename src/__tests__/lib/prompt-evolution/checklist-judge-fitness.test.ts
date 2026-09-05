import { describe, it, expect } from 'vitest';
import { computeVariantFitness } from '@/lib/prompt-evolution/judge-fitness';
import {
  createABTest,
  readFitness,
  pickVariant,
  evaluateTestWithBasis,
  recordTrial,
  MIN_JUDGED_VERDICTS_PER_VARIANT,
  type JudgeScores,
} from '@/lib/prompt-evolution/ab-testing';
import { CHECKLIST_RUNS_CATALOG_ID } from '@/lib/cli-task-handlers';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { ABTest } from '@/types/prompt-evolution';

/**
 * Checklist dispatches are the most common thing a user runs, and they were
 * scored ONLY by a boolean the run wrote about itself: `/api/checklist/complete`
 * books the A/B trial with `success = completed !== false`. A checklist wrote no
 * artifact and the judge fleet enumerates catalogs from `step-facts.json`, so no
 * verdict could ever exist for one — the loop was optimising a self-report
 * (ai-registry `software-engineering/quality-gates`).
 *
 * Phase 1: an experimental checklist run files its work product as a
 * `checklist-runs` artifact, which makes a verdict possible, which makes a
 * judged basis possible.
 */

/** A checklist run's artifact: catalog `checklist-runs`, entity = module, step = item. */
function runArtifact(moduleId: string, itemId: string, variantId: string): PipelineArtifact {
  return {
    catalogId: CHECKLIST_RUNS_CATALOG_ID,
    entityId: moduleId,
    step: itemId,
    data: { _provenance: { engine: 'Claude', promptVersion: 'q3', promptVariantId: variantId } },
    ueAssets: [],
    status: 'pending',
  } as unknown as PipelineArtifact;
}

function runVerdict(moduleId: string, itemId: string, score: number, pass: boolean): JudgeVerdict {
  return {
    catalogId: CHECKLIST_RUNS_CATALOG_ID,
    entityId: moduleId,
    step: itemId,
    score,
    verdict: pass ? 'pass' : 'fail',
  } as unknown as JudgeVerdict;
}

describe('computeVariantFitness — checklist-runs', () => {
  it('resolves a checklist variant fitness once a checklist-runs verdict exists', () => {
    const artifacts = [
      runArtifact('arpg-combat', 'combat-hit-detect', 'var-a'),
      runArtifact('arpg-combat', 'combat-dodge', 'var-b'),
    ];
    const verdicts = [
      runVerdict('arpg-combat', 'combat-hit-detect', 88, true),
      runVerdict('arpg-combat', 'combat-dodge', 41, false),
    ];

    const fitness = computeVariantFitness(artifacts, verdicts);
    const a = fitness.find((f) => f.variantId === 'var-a')!;
    const b = fitness.find((f) => f.variantId === 'var-b')!;

    expect(a.avgScore).toBe(88);
    expect(a.passRate).toBe(1);
    expect(b.avgScore).toBe(41);
    expect(b.passRate).toBe(0);
  });

  it('reports null — never 0 — for a variant whose runs nobody judged', () => {
    const fitness = computeVariantFitness(
      [runArtifact('materials', 'mat-1', 'var-unjudged')],
      [],
    );
    expect(fitness[0].avgScore).toBeNull();
    expect(fitness[0].passRate).toBeNull();
  });
});

// ── The basis the A/B decision rests on ─────────────────────────────────────

function testWithTrials(aTrials: number, aWins: number, bTrials: number, bWins: number): ABTest {
  let t = createABTest('arpg-combat', 'combat-hit-detect', 'var-a', 'var-b', 3);
  for (let i = 0; i < aTrials; i++) t = recordTrial(t, 'A', i < aWins, 1000);
  for (let i = 0; i < bTrials; i++) t = recordTrial(t, 'B', i < bWins, 1000);
  return t;
}

function scores(aPass: number, aVerdicts: number, bPass: number, bVerdicts: number): JudgeScores {
  return {
    'var-a': { avgScore: aPass * 100, passRate: aPass, verdicts: aVerdicts, judgedArtifacts: aVerdicts },
    'var-b': { avgScore: bPass * 100, passRate: bPass, verdicts: bVerdicts, judgedArtifacts: bVerdicts },
  };
}

describe('readFitness — which evidence is used', () => {
  it('falls back to self-reported completions with no judge scores at all', () => {
    const reading = readFitness(testWithTrials(4, 4, 4, 1));
    expect(reading.basis).toBe('self-reported');
    expect(reading.rateA).toBe(1);
    expect(reading.rateB).toBe(0.25);
    expect(reading.note).toContain('self-reported completions');
  });

  it('refuses the judged basis while EITHER arm is under the verdict floor', () => {
    const reading = readFitness(
      testWithTrials(4, 4, 4, 1),
      scores(0.2, MIN_JUDGED_VERDICTS_PER_VARIANT, 0.9, MIN_JUDGED_VERDICTS_PER_VARIANT - 1),
    );
    // Judging one arm and not the other would crown whichever was measured.
    expect(reading.basis).toBe('self-reported');
    expect(reading.note).toContain(`each arm needs ${MIN_JUDGED_VERDICTS_PER_VARIANT}`);
  });

  it('uses the judged basis when both arms clear the floor — and says so', () => {
    const reading = readFitness(testWithTrials(4, 4, 4, 1), scores(0.2, 5, 0.9, 5));
    expect(reading.basis).toBe('judge');
    // The self-report said A was perfect and B nearly failed; the judges disagree.
    expect(reading.rateA).toBe(0.2);
    expect(reading.rateB).toBe(0.9);
    expect(reading.note).toContain('judge verdicts');
  });
});

describe('pickVariant / evaluateTest consume the judged basis', () => {
  it('pickVariant exploits the JUDGED winner, not the self-reported one', () => {
    // Epsilon 0 → pure exploit, so the choice is fully determined by the basis.
    const test = testWithTrials(4, 4, 4, 1);
    expect(pickVariant(test, 0)).toBe('A'); // self-reported: A looks perfect
    expect(pickVariant(test, 0, scores(0.2, 5, 0.9, 5))).toBe('B'); // judges disagree
  });

  it('evaluateTest crowns the judged winner and names the basis', () => {
    const test = testWithTrials(6, 6, 6, 2);

    const self = evaluateTestWithBasis(test);
    expect(self.reading.basis).toBe('self-reported');
    expect(self.test.status).toBe('concluded');
    expect(self.test.winnerId).toBe('var-a');

    const judged = evaluateTestWithBasis(test, scores(0.1, 10, 0.9, 10));
    expect(judged.reading.basis).toBe('judge');
    expect(judged.test.status).toBe('concluded');
    expect(judged.test.winnerId).toBe('var-b');
  });

  it('a judged basis with too little judged volume does not conclude early', () => {
    // Both arms served enough (minTrials 3) and judged exactly at the floor, but
    // the pass rates are identical — no confidence, and 6 verdicts is below the
    // minTrials*4 volume gate, so nothing is crowned.
    const test = testWithTrials(3, 3, 3, 3);
    const judged = evaluateTestWithBasis(test, scores(0.5, 3, 0.5, 3));
    expect(judged.reading.basis).toBe('judge');
    expect(judged.test.status).toBe('running');
    expect(judged.test.winnerId).toBeNull();
  });
});
