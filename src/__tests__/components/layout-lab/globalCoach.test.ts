import { describe, it, expect, vi } from 'vitest';
import type { StepDisplayStatus, StepDrift } from '@/components/layout-lab/hooks/useEntityArtifacts';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// Same deterministic trick the matrixRows test uses: each step's accept reads __status
// from its data, so deriveEntityArtifacts (which buildGlobalCoach reuses) is exercised
// exactly, without depending on any real catalog's acceptance logic.
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  }),
}));

import {
  pickEntityIssue,
  rankCoachCandidates,
  buildGlobalCoach,
  type CoachCandidate,
  type CoachCatalogInput,
} from '@/components/layout-lab/globalCoachModel';

const statuses = (arr: StepDisplayStatus[]) => (_s: string, i: number) => arr[i];
const noDrift = new Map<string, StepDrift>();
const steps = ['A', 'B', 'C', 'D'];

describe('pickEntityIssue — ladder fail > drift > pending > deferred', () => {
  it('prefers the first failed step above everything', () => {
    const issue = pickEntityIssue(steps, statuses(['pass', 'deferred', 'fail', 'pending']), new Map([['A', { local: 'pass', server: 'fail' } as StepDrift]]));
    expect(issue).toEqual({ step: 'C', index: 2, priority: 'fail' });
  });

  it('prefers drift over pending/deferred when nothing failed', () => {
    const issue = pickEntityIssue(steps, statuses(['pass', 'pending', 'deferred', 'pass']), new Map([['C', { local: 'pass', server: 'fail' } as StepDrift]]));
    expect(issue).toEqual({ step: 'C', index: 2, priority: 'drift' });
  });

  it('prefers pending over deferred when nothing failed/drifted', () => {
    const issue = pickEntityIssue(steps, statuses(['pass', 'deferred', 'pending', 'deferred']), noDrift);
    expect(issue).toEqual({ step: 'C', index: 2, priority: 'pending' });
  });

  it('falls back to the first deferred step', () => {
    const issue = pickEntityIssue(steps, statuses(['pass', 'pass', 'deferred', 'deferred']), noDrift);
    expect(issue).toEqual({ step: 'C', index: 2, priority: 'deferred' });
  });

  it('returns null for a config-complete entity (all pass, no drift)', () => {
    expect(pickEntityIssue(steps, statuses(['pass', 'pass', 'pass', 'pass']), noDrift)).toBeNull();
  });
});

describe('rankCoachCandidates — ordering + slicing', () => {
  const c = (priority: CoachCandidate['priority'], entityId: string): CoachCandidate => ({
    catalogId: 'cat', catalogLabel: 'Cat', entityId, entityName: entityId, step: 'S', stepIndex: 0, priority,
  });

  it('orders fail > drift > pending > deferred', () => {
    const ranked = rankCoachCandidates([c('deferred', 'a'), c('pending', 'b'), c('fail', 'c'), c('drift', 'd')], 10);
    expect(ranked.map((x) => x.priority)).toEqual(['fail', 'drift', 'pending', 'deferred']);
  });

  it('is stable within a priority — ties keep insertion order', () => {
    const ranked = rankCoachCandidates([c('fail', 'first'), c('fail', 'second'), c('fail', 'third')], 10);
    expect(ranked.map((x) => x.entityId)).toEqual(['first', 'second', 'third']);
  });

  it('slices to the top N', () => {
    const ranked = rankCoachCandidates([c('fail', 'a'), c('pending', 'b'), c('deferred', 'c')], 2);
    expect(ranked.map((x) => x.entityId)).toEqual(['a', 'b']);
  });
});

describe('buildGlobalCoach — cross-catalog aggregation via deriveEntityArtifacts', () => {
  const entity = (id: string): LabEntity => ({ id, name: id.toUpperCase(), lifecycle: 'planned', data: {} });
  const localArt = (status: string): LabStepArtifact => ({ done: true, data: { __status: status }, ueAssets: [], at: '' });

  const catalogInput = (
    catalogId: string,
    catalogLabel: string,
    entities: LabEntity[],
    localByEntity: Record<string, Record<string, LabStepArtifact>>,
  ): CoachCatalogInput => ({
    catalogId, catalogLabel, steps: ['A', 'B'], entities,
    serverByEntity: new Map<string, Map<string, PipelineArtifact>>(),
    localByEntity,
  });

  it('surfaces the most-urgent step per entity and ranks them across catalogs', () => {
    // catalog X: e-x has a failed gate. catalog Y: e-y is all pending (nothing produced).
    const inputs = [
      catalogInput('x', 'Catalog X', [entity('e-x')], { 'e-x': { A: localArt('pass'), B: localArt('fail') } }),
      catalogInput('y', 'Catalog Y', [entity('e-y')], {}), // no artifacts → pending
    ];
    const ranked = buildGlobalCoach(inputs, 5);
    expect(ranked).toHaveLength(2);
    // fail (catalog X) outranks pending (catalog Y).
    expect(ranked[0]).toMatchObject({ catalogId: 'x', entityId: 'e-x', priority: 'fail', step: 'B', stepIndex: 1 });
    expect(ranked[1]).toMatchObject({ catalogId: 'y', entityId: 'e-y', priority: 'pending', step: 'A', stepIndex: 0 });
  });

  it('omits config-complete entities and respects topN', () => {
    const inputs = [
      catalogInput('x', 'Catalog X', [entity('done')], { done: { A: localArt('pass'), B: localArt('pass') } }),
      catalogInput('y', 'Catalog Y', [entity('todo')], { todo: { A: localArt('fail') } }),
    ];
    const ranked = buildGlobalCoach(inputs, 5);
    expect(ranked.map((r) => r.entityId)).toEqual(['todo']); // 'done' contributes nothing
  });
});
