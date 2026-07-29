import { describe, it, expect, vi } from 'vitest';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/**
 * ONE acceptance truth — the regression guard for the divergence this consolidation closed.
 *
 * Before `resolveStepAcceptance` existed, the step BANNER applied the judge bridge while the
 * rail, matrix, both coaches and the entity rollup stopped after the server overlay. A step a
 * current-rubric judge had condemned therefore showed a green rail dot next to its own red
 * banner, and `/status` (which bridges) sided with the banner against the rail.
 *
 * Each surface is exercised through the function it actually calls:
 *   banner → `resolveStepAcceptance` (what `useStepAcceptance` calls after its checker)
 *   rail   → `deriveEntityArtifacts().displayStatus`
 *   matrix → `buildMatrixRows().statusByStep`
 *   coach  → `buildGlobalCoach()` candidate priority
 */

// Deterministic checker: each step reports the status seeded into its produce data, so the
// merge rules are exercised without depending on any real catalog's acceptance logic.
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  }),
}));

import { resolveStepAcceptance, verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import { deriveEntityArtifacts } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { buildMatrixRows } from '@/components/layout-lab/matrixRows';
import { buildGlobalCoach, type CoachCatalogInput } from '@/components/layout-lab/globalCoachModel';

const CATALOG = 'items';
const STEP = 'Economy';
const steps = [STEP, 'Art'];
const entity: LabEntity = { id: 'e1', name: 'Ember Blade', lifecycle: 'planned', data: {} };

/** Both steps' checkers PASS — only the judge condemns `Economy`. */
const localSteps: Record<string, LabStepArtifact> = {
  [STEP]: { done: true, data: { __status: 'pass' }, ueAssets: [], at: '' },
  Art: { done: true, data: { __status: 'pass' }, ueAssets: [], at: '' },
};

/** A CURRENT-rubric `human` verdict: always relevant, whatever the step's audited class. */
const judgeFail: JudgeVerdict = {
  catalogId: CATALOG, entityId: entity.id, step: STEP,
  judge: 'human', verdict: 'fail', score: 41,
  findings: 'price/power ratio contradicts the sibling Attributes row',
  model: 'opus-judge', rubricVersion: RUBRIC_VERSION,
};

describe('one acceptance truth — a judge-failed step reads the same on every surface', () => {
  it('banner, rail, matrix and coach all report fail for the judged step', () => {
    // Banner (useStepAcceptance's merge, given its checker's pass).
    const banner = resolveStepAcceptance({
      catalogId: CATALOG, step: STEP,
      local: { label: STEP, status: 'pass', tier: 'L0', detail: '' },
      verdicts: verdictsForStep([judgeFail], entity.id, STEP),
    });
    expect(banner.status).toBe('fail');
    expect(banner.reason).toContain('judge');

    // Rail.
    const { displayStatus } = deriveEntityArtifacts(CATALOG, entity, steps, localSteps, {}, {}, [judgeFail]);
    expect(displayStatus(STEP, 0)).toBe('fail');
    // The unjudged sibling is untouched — the bridge condemns content, not the entity.
    expect(displayStatus('Art', 1)).toBe('pass');

    // Matrix.
    const rows = buildMatrixRows(
      CATALOG, [entity], new Map<string, Map<string, PipelineArtifact>>(),
      { [entity.id]: localSteps }, steps, [judgeFail],
    );
    expect(rows[0].statusByStep(STEP)).toBe('fail');
    expect(rows[0].blockers.map((b) => b.step)).toEqual([STEP]);
    expect(rows[0].rollup.configComplete).toBe(false);

    // Coach.
    const inputs: CoachCatalogInput[] = [{
      catalogId: CATALOG, catalogLabel: 'Items', steps, entities: [entity],
      serverByEntity: new Map<string, Map<string, PipelineArtifact>>(),
      localByEntity: { [entity.id]: localSteps },
    }];
    const ranked = buildGlobalCoach(inputs, 5, [judgeFail]);
    expect(ranked[0]).toMatchObject({ entityId: entity.id, step: STEP, priority: 'fail' });
    expect(ranked[0].reason).toContain('judge');

    // …and all four agree with each other, not merely with the expectation above.
    expect(new Set([banner.status, displayStatus(STEP, 0), rows[0].statusByStep(STEP)]).size).toBe(1);
  });

  it('with NO verdicts every surface keeps the checker pass (no fabricated condemnation)', () => {
    const { displayStatus } = deriveEntityArtifacts(CATALOG, entity, steps, localSteps, {}, {}, []);
    const rows = buildMatrixRows(CATALOG, [entity], new Map(), { [entity.id]: localSteps }, steps, []);
    expect(displayStatus(STEP, 0)).toBe('pass');
    expect(rows[0].statusByStep(STEP)).toBe('pass');
    expect(rows[0].rollup.configComplete).toBe(true);
  });

  it('surfaces bridge-vs-server divergence as drift (the pre-bridge comparison hid it)', () => {
    // The server row still carries the PURE checker pass (write paths persist raw, by design),
    // while the judge condemns the same content → the screen says fail, the server says pass.
    const srv: PipelineArtifact = { catalogId: CATALOG, entityId: entity.id, step: STEP, data: {}, ueAssets: [], status: 'pass' };
    const { driftByStep } = deriveEntityArtifacts(CATALOG, entity, steps, localSteps, { [STEP]: srv }, {}, [judgeFail]);
    expect(driftByStep.get(STEP)).toEqual({ local: 'fail', server: 'pass' });
  });

  it('a server-resolved deferred gate is reconciliation, never drift', () => {
    const gateSteps: Record<string, LabStepArtifact> = {
      [STEP]: { done: true, data: { __status: 'deferred' }, ueAssets: [], at: '' },
    };
    const srv: PipelineArtifact = { catalogId: CATALOG, entityId: entity.id, step: STEP, data: {}, ueAssets: [], status: 'pass' };
    const { driftByStep, displayStatus } = deriveEntityArtifacts(CATALOG, entity, [STEP], gateSteps, { [STEP]: srv });
    expect(displayStatus(STEP, 0)).toBe('pass');
    expect(driftByStep.size).toBe(0);
  });
});
