import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { bridgeJudgeVerdict, judgedContentOf } from '@/lib/catalog/acceptance/judgeBridge';
import { deriveCell, type StepFact } from '@/lib/status/statusModel';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { stepContentHash } from '@/lib/judge/contentHash';

afterEach(cleanup);

const DATA = { brief: 'a written concept brief', budget: 42 };
const HASH = stepContentHash(DATA);

const fail = (over: Partial<JudgeVerdict>): JudgeVerdict => ({
  catalogId: 'items', entityId: 'e1', step: 'Brief', judge: 'llm-panel', verdict: 'fail',
  score: 31, findings: 'panel findings text', model: 'claude-opus-4-8', rubricVersion: RUBRIC_VERSION, ...over,
});

// Same two fails, unverifiable one FIRST: a human verdict with no content binding (unknown) and a
// confirmed llm-panel verdict bound to the content on record (current).
const unknownFirst = [fail({ judge: 'human', model: 'a-person' }), fail({ contentHash: HASH })];
const currentFirst = [unknownFirst[1], unknownFirst[0]];

const fact: StepFact = {
  catalogId: 'items', step: 'Brief', trueEngine: 'Claude', deliverable: 'text-config',
  generatorWired: true, judge: 'llm-panel', checkerMeaningful: false, note: 'prose brief',
};
const art: PipelineArtifact = { catalogId: 'items', entityId: 'e1', step: 'Brief', data: DATA, ueAssets: [], status: 'pass', tier: 'L0' };
const shapePass: AcceptanceResult = { label: 'Shape check', status: 'pass', tier: 'L0', detail: 'ok' };

describe('the strongest condemnation is the one reported, on both surfaces', () => {
  for (const [name, order] of [['unknown first', unknownFirst], ['current first', currentFirst]] as const) {
    it(`bridgeJudgeVerdict attributes the CURRENT fail (${name})`, () => {
      const r = bridgeJudgeVerdict(shapePass, order, undefined, judgedContentOf(DATA));
      expect(r.status).toBe('fail');
      expect(r.judge?.provenance).toBe('current');
      expect(r.reason).not.toContain('unverified provenance');
    });

    it(`deriveCell attributes the CURRENT fail (${name})`, () => {
      const c = deriveCell('Brief', 'Claude', [art], fact, order);
      expect(c.grade).toBe('attention');
      expect(c.judgeAttribution?.provenance).toBe('current');
    });
  }

  it('an unknown fail alone still condemns, labelled unverified', () => {
    const r = bridgeJudgeVerdict(shapePass, [unknownFirst[0]], undefined, judgedContentOf(DATA));
    expect(r.status).toBe('fail');
    expect(r.judge?.provenance).toBe('unknown');
  });
});
