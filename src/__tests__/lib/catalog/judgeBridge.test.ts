import { describe, it, expect } from 'vitest';
import { bridgeJudgeVerdict } from '@/lib/catalog/acceptance/judgeBridge';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import {
  listCatalogSummaries,
  listEntitySummaries,
  buildStepRecipe,
  gradeArtifact,
} from '@/lib/catalog/headless';
import { upsertVerdict } from '@/lib/status/judge-verdicts-db';

const pass = (): AcceptanceResult => ({ label: 'Shape check', status: 'pass', tier: 'L0', detail: 'ok' });

const verdict = (over: Partial<JudgeVerdict>): JudgeVerdict => ({
  catalogId: 'c', entityId: 'e1', step: 'S', judge: 'llm-panel', verdict: 'fail',
  score: 42, findings: 'generic and off-canon', model: 'sonnet-fleet-w1', rubricVersion: RUBRIC_VERSION, ...over,
});

describe('bridgeJudgeVerdict — judge → acceptance overlay (pure)', () => {
  it('a CURRENT-RUBRIC judge FAIL down-grades a checker-pass to fail + judge reason', () => {
    const r = bridgeJudgeVerdict(pass(), [verdict({})], 'llm-panel');
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('sonnet-fleet-w1');
    expect(r.reason).toContain('42');
    expect(r.reason).toContain('generic and off-canon');
    // Untouched fields carry through.
    expect(r.label).toBe('Shape check');
    expect(r.tier).toBe('L0');
  });

  it('a STALE-RUBRIC verdict (< current) is ignored — no down-grade', () => {
    const r = bridgeJudgeVerdict(pass(), [verdict({ rubricVersion: RUBRIC_VERSION - 1 })], 'llm-panel');
    expect(r.status).toBe('pass');
    expect(r.reason).toBeUndefined();
  });

  it('a verdict missing rubricVersion defaults to v1 → ignored once RUBRIC_VERSION > 1', () => {
    const { rubricVersion: _drop, ...noVer } = verdict({});
    void _drop;
    const r = bridgeJudgeVerdict(pass(), [noVer as JudgeVerdict], 'llm-panel');
    expect(r.status).toBe(RUBRIC_VERSION > 1 ? 'pass' : 'fail');
  });

  it('a WRONG-judge-class verdict never speaks for the step (mirrors deriveCell)', () => {
    // Step audited as vlm; an llm-panel fail must not down-grade it.
    const r = bridgeJudgeVerdict(pass(), [verdict({ judge: 'llm-panel' })], 'vlm');
    expect(r.status).toBe('pass');
    // A human verdict is always relevant.
    const rHuman = bridgeJudgeVerdict(pass(), [verdict({ judge: 'human' })], 'vlm');
    expect(rHuman.status).toBe('fail');
  });

  it('with no known judge class, every current-rubric verdict is relevant', () => {
    const r = bridgeJudgeVerdict(pass(), [verdict({ judge: 'vlm' })], undefined);
    expect(r.status).toBe('fail');
  });

  it('a judge PASS never elevates (READ-ONLY, no manufactured pass); non-pass results untouched', () => {
    const passVerdict = bridgeJudgeVerdict(pass(), [verdict({ verdict: 'pass', score: 95 })], 'llm-panel');
    expect(passVerdict.status).toBe('pass');
    expect(passVerdict.reason).toBeUndefined();
    const deferred: AcceptanceResult = { label: 'Gate', status: 'deferred', tier: 'L3', detail: '', reason: 'awaits UE' };
    const r = bridgeJudgeVerdict(deferred, [verdict({})], 'llm-panel');
    expect(r.status).toBe('deferred');
    expect(r.reason).toBe('awaits UE');
  });
});

describe('headless gradeArtifact — bridge wired through the DB', () => {
  // Find any (catalog, entity, step) whose checker returns a genuine `pass` under a
  // synthetic entity, so we can prove the judge FAIL down-grades a real checker-pass.
  function findPassingStep(): { catalogId: string; step: string; data: Record<string, unknown> } | null {
    for (const c of listCatalogSummaries()) {
      if (!c.registered || !c.entityCount) continue;
      const ent = listEntitySummaries(c.catalogId)[0];
      if (!ent) continue;
      for (const step of c.steps) {
        const recipe = buildStepRecipe(c.catalogId, ent.id, step, undefined, []);
        if (!recipe.example) continue;
        // Regrade the example under a SYNTHETIC entity (excluded from the /status map).
        const synth = `test-headless-bridge-${c.catalogId}`;
        const g = gradeArtifact(c.catalogId, step, recipe.example.data, synth);
        if (g.graded && g.result?.status === 'pass') return { catalogId: c.catalogId, step, data: recipe.example.data };
      }
    }
    return null;
  }

  it('a current-rubric judge FAIL down-grades a live checker-pass; a stale verdict does not', () => {
    const found = findPassingStep();
    expect(found).not.toBeNull();
    const { catalogId, step, data } = found!;
    const entityId = `test-headless-bridge-${catalogId}`;

    // Baseline: checker passes, no verdict yet.
    expect(gradeArtifact(catalogId, step, data, entityId).result?.status).toBe('pass');

    // A STALE-rubric fail must NOT change the grade.
    upsertVerdict({
      catalogId, entityId, step, judge: 'human', verdict: 'fail', score: 10,
      findings: 'stale', model: 'old', rubricVersion: RUBRIC_VERSION - 1,
    });
    expect(gradeArtifact(catalogId, step, data, entityId).result?.status).toBe('pass');

    // A CURRENT-rubric fail down-grades the pass to fail with the judge reason.
    upsertVerdict({
      catalogId, entityId, step, judge: 'human', verdict: 'fail', score: 33,
      findings: 'off-canon content', model: 'human-review', rubricVersion: RUBRIC_VERSION,
    });
    const bridged = gradeArtifact(catalogId, step, data, entityId).result;
    expect(bridged?.status).toBe('fail');
    expect(bridged?.reason).toContain('off-canon content');
  });
});
