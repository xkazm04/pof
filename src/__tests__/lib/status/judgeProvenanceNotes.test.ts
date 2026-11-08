import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
const fact: StepFact = {
  catalogId: 'items', step: 'Brief', trueEngine: 'Claude', deliverable: 'text-config',
  generatorWired: true, judge: 'llm-panel', checkerMeaningful: false, note: 'prose brief',
};
const art: PipelineArtifact = { catalogId: 'items', entityId: 'e1', step: 'Brief', data: DATA, ueAssets: [], status: 'pass', tier: 'L0' };
const shapePass: AcceptanceResult = { label: 'Shape check', status: 'pass', tier: 'L0', detail: 'ok' };
const fail = (over: Partial<JudgeVerdict>): JudgeVerdict => ({
  catalogId: 'items', entityId: 'e1', step: 'Brief', judge: 'llm-panel', verdict: 'fail',
  score: 31, findings: 'panel findings text', model: 'claude-opus-4-8', rubricVersion: RUBRIC_VERSION, contentHash: HASH, ...over,
});

const cases: Array<[string, Partial<JudgeVerdict>]> = [
  ['current', {}],
  ['unknown', { contentHash: undefined }],
  ['stale', { contentHash: stepContentHash({ brief: 'the OLD content', budget: 7 }) }],
  ['superseded', { rubricVersion: RUBRIC_VERSION - 1 }],
];

describe('the lab banner and /status say the same sentence for each provenance', () => {
  for (const [name, over] of cases) {
    it(`${name}: judge attribution notes are identical`, () => {
      const v = fail(over);
      const lab = bridgeJudgeVerdict(shapePass, [v], undefined, judgedContentOf(DATA)).judge;
      const map = deriveCell('Brief', 'Claude', [art], fact, [v]).judgeAttribution;
      expect(lab?.provenance).toBe(name);
      expect(map?.provenance).toBe(name);
      expect(lab?.note).toBe(map?.note);
    });
  }

  it('each provenance sentence is written in ONE source file (judgeBridge.ts)', () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8');
    const bridge = read('src/lib/catalog/acceptance/judgeBridge.ts');
    const model = read('src/lib/status/statusModel.ts');
    const anchors = [
      'Judged the content currently on record',
      'cannot be confirmed against the current content',
      'but it judged content this step no longer holds',
      'superseded rubric. Not applied',
    ];
    const sites = anchors.reduce((n, a) => n + Number(bridge.includes(a)) + Number(model.includes(a)), 0);
    expect(sites).toBe(anchors.length); // 4 sentences at 1 site each, not 8
    for (const a of anchors) expect(model.includes(a)).toBe(false);
  });
});
