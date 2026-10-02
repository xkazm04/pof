/**
 * A failed produce is not an artifact.
 *
 * A produce that fails on a step with no prior record leaves a not-done failure marker
 * (`{ done: false, data: {}, error }`). Every reader used to treat the marker's mere PRESENCE
 * as produced content and grade its empty data: a fabricated pass on checker-less steps, a
 * phantom deferred gate the coach offered to drain, a server row shadowed in the matrix, and
 * a refresh that reported the empty failure as unsaved local work. One step-record rule
 * (`stepRecord.ts`) decodes the record for every reader; these cases pin it on real
 * catalogs (spellbook, audio) through the real checkers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { resolveCatalogSteps } from '@/components/layout-lab/catalogManifest';
import { deriveEntityArtifacts } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { buildMatrixRows } from '@/components/layout-lab/matrixRows';
import { buildCatalogCandidates, buildCatalogCandidatesFromSummary, deriveEntityFromSummary } from '@/components/layout-lab/globalCoachModel';
import { pickNextActionableStep } from '@/components/layout-lab/nextActionableStep';
import { buildProduceLog } from '@/components/layout-lab/produceLog';
import { toStepSummary } from '@/components/layout-lab/stepSummary';
import { summarizeEntity } from '@/lib/catalog/rollup';
import { useLabPipelineStore, type LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const ERR = 'CLI exited with code 1';
const BRIEF = 'Concept Brief';
const marker = (): LabStepArtifact =>
  ({ done: false, data: {}, ueAssets: [], at: '2026-09-30T10:00:00.000Z', error: ERR, errorAt: '2026-09-30T10:00:00.000Z' });
const entity = (id = 'e1'): LabEntity => ({ id, name: id.toUpperCase(), lifecycle: 'planned', data: {} });
const goodBrief = { brief: 'x'.repeat(400) };
const serverRow = (catalogId: string, step: string): PipelineArtifact => ({
  catalogId, entityId: 'e1', step, data: goodBrief, ueAssets: [], status: 'pass', tier: 'L0', updatedAt: '2026-09-30T09:00:00.000Z',
});

describe('a failure marker is never graded as content', () => {
  it('spellbook Concept Brief: a marker-only step reads unproduced and has no artifact row', () => {
    const steps = resolveCatalogSteps('spellbook');
    const d = deriveEntityArtifacts('spellbook', entity(), steps, { [BRIEF]: marker() }, {});
    expect(d.displayStatus(BRIEF, steps.indexOf(BRIEF))).toBe('unproduced');
    expect(d.artifactByStep.has(BRIEF)).toBe(false);
  });

  it('audio Audio: a marker on a checker-less step is not a fabricated pass', () => {
    const steps = resolveCatalogSteps('audio');
    expect(steps).toContain('Audio');
    const d = deriveEntityArtifacts('audio', entity(), steps, { Audio: marker() }, {});
    expect(d.displayStatus('Audio', steps.indexOf('Audio'))).toBe('unproduced');
  });

  it('spellbook Test Gate: a marker is not a phantom deferred gate in the rollup', () => {
    const steps = resolveCatalogSteps('spellbook');
    expect(steps).toContain('Test Gate');
    const d = deriveEntityArtifacts('spellbook', entity(), steps, { 'Test Gate': marker() }, {});
    expect(summarizeEntity(d.artifacts, steps.length).deferred).toBe(0);
  });

  it('a local marker never shadows the server row (matrix and blob-free coach path)', () => {
    const steps = resolveCatalogSteps('spellbook');
    const server = new Map([['e1', new Map([[BRIEF, serverRow('spellbook', BRIEF)]])]]);
    const rows = buildMatrixRows('spellbook', [entity()], server, { e1: { [BRIEF]: marker() } }, steps);
    expect(rows[0].statusByStep(BRIEF)).toBe('pass');
    const summary = new Map([[BRIEF, toStepSummary(serverRow('spellbook', BRIEF))]]);
    const derived = deriveEntityFromSummary('spellbook', 'e1', steps, { [BRIEF]: marker() }, summary);
    expect(derived.displayStatus(BRIEF, 0)).toBe('pass');
  });

  it('the produce error reaches both coaches through the one hint channel', async () => {
    const steps = resolveCatalogSteps('spellbook');
    const local: Record<string, Record<string, LabStepArtifact>> = { e1: { [BRIEF]: marker() } };
    const full = buildCatalogCandidates({ catalogId: 'spellbook', catalogLabel: 'Spellbook', steps, entities: [entity()], serverByEntity: new Map(), localByEntity: local });
    const thin = buildCatalogCandidatesFromSummary({ catalogId: 'spellbook', catalogLabel: 'Spellbook', steps, entities: [entity()], summaryByEntity: new Map(), localByEntity: local });
    for (const list of [full, thin]) {
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ step: BRIEF, stepIndex: 0 });
      expect(list[0].reason).toContain(ERR);
    }
    // Per-entity coach: Baseline's verdictOf → settlementOf → coachActionFor → next.plainHint.
    const { coachVerdictOf } = await import('@/components/layout-lab/stepRecord');
    const d = deriveEntityArtifacts('spellbook', entity(), steps, local.e1, {});
    const next = pickNextActionableStep(steps, d.displayStatus, d.driftByStep, (s) => coachVerdictOf(d.artifactByStep.get(s), local.e1[s]));
    expect(next?.step).toBe(BRIEF);
    expect(next?.plainHint).toContain(ERR);
  });
});

describe('the store reads a marker as no content', () => {
  const srv = (): { step: string; artifact: LabStepArtifact } =>
    ({ step: BRIEF, artifact: { done: true, data: goodBrief, ueAssets: [], status: 'pass', at: '2026-09-30T09:00:00Z' } });
  const art = (e: string) => useLabPipelineStore.getState().byEntity[e]?.[BRIEF];
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });

  it('hydrateEntity adopts the server content onto a marker and keeps the failure', () => {
    useLabPipelineStore.getState().fail('e1', BRIEF, ERR);
    useLabPipelineStore.getState().hydrateEntity('e1', [srv()]);
    const a = art('e1')!;
    expect(a.done).toBe(true);
    expect(String(a.data.brief)).toHaveLength(400);
    expect(a.error).toBe(ERR);
  });

  it('refreshEntity adopts onto a marker, and a marker-only step is neither kept nor stamped', () => {
    useLabPipelineStore.getState().fail('e1', BRIEF, ERR);
    const o1 = useLabPipelineStore.getState().refreshEntity('e1', [srv()]);
    expect(o1.adopted).toEqual([BRIEF]);
    expect(o1.kept).toEqual([]);
    useLabPipelineStore.getState().fail('e2', BRIEF, ERR);
    const o2 = useLabPipelineStore.getState().refreshEntity('e2', []);
    expect(o2.kept).toEqual([]);
    expect(art('e2')?.syncError).toBeUndefined();
  });
});

describe('[guard] what already read the record correctly stays put', () => {
  it('the produce log decodes a marker as a failed run with no content', () => {
    const log = buildProduceLog([BRIEF], { [BRIEF]: marker() });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ step: BRIEF, outcome: 'failed', reason: ERR, hasContent: false });
  });

  it('a produced step that later failed keeps its checker-graded status', () => {
    const steps = resolveCatalogSteps('spellbook');
    const produced: LabStepArtifact = { done: true, data: goodBrief, ueAssets: [], at: '2026-09-30T09:00:00.000Z' };
    const clean = deriveEntityArtifacts('spellbook', entity(), steps, { [BRIEF]: produced }, {});
    const failedAfter = deriveEntityArtifacts('spellbook', entity(), steps, { [BRIEF]: { ...produced, error: ERR, errorAt: '2026-09-30T10:00:00.000Z' } }, {});
    expect(clean.displayStatus(BRIEF, 0)).toBe('pass');
    expect(failedAfter.displayStatus(BRIEF, 0)).toBe('pass');
  });
});
