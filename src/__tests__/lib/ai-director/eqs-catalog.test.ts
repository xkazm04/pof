import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import {
  EQS_CATALOG,
  eqsComponent,
  runtimeTestOrder,
} from '@/lib/ai-director/eqs-catalog';
import {
  runSquadSimulation,
  PRESET_FORMATIONS,
  DEFAULT_DIRECTOR_CONFIG,
} from '@/lib/ai-director/squad-engine';
import { EQS_COMPONENTS } from '@/components/modules/game-systems/EQSComponentInventory/eqsComponents';
import { PIPELINES } from '@/components/modules/game-systems/EQSPipelineDiagram/constants';
import { PipelineView } from '@/components/modules/game-systems/SquadChoreographyEditor/PipelineView';
import type { ComposedEQSStep } from '@/types/squad-tactics';

// One EQS component catalog: every pipeline surface (inventory, pipeline
// diagram, squad director) reads component identity from `eqs-catalog`, and the
// squad's composed pipeline is derived from the roles it actually allocates.

function composed(formationId: string): ComposedEQSStep[] {
  const formation = PRESET_FORMATIONS.find((f) => f.id === formationId);
  if (!formation) throw new Error(`no preset ${formationId}`);
  const r = runSquadSimulation({ ...DEFAULT_DIRECTOR_CONFIG, formation });
  if (!r.ok) throw new Error(r.error.message);
  return r.data.composedPipeline;
}

const byLabel = (steps: ComposedEQSStep[], label: string) => {
  const step = steps.find((s) => s.label === label);
  if (!step) throw new Error(`no step ${label} in ${steps.map((s) => s.label).join(', ')}`);
  return step;
};

describe('squad composed pipeline is derived from the allocated roles', () => {
  it('director step lists roles in the engine allocation (priority) order, not declaration order', () => {
    const director = composed('ambush').find((s) => s.kind === 'director');
    expect(director?.description).toContain('aggressor → flanker → ambusher');
  });

  it('ambush carries the ambusher role\'s declared generator and test', () => {
    const ids = composed('ambush').map((s) => s.componentId);
    expect(ids).toContain('gen-cover-positions');
    expect(ids).toContain('test-line-of-sight');
  });

  it('[guard] pincer has no CoverPositions / LineOfSight step (no role declares them)', () => {
    const classes = composed('pincer').map((s) => s.cppClass);
    expect(classes).not.toContain('UEnvQueryGenerator_CoverPositions');
    expect(classes).not.toContain('UEnvQueryTest_LineOfSight');
  });
});

describe('every pipeline step references the catalog by id', () => {
  it('squad and diagram steps with a cppClass resolve in EQS_CATALOG with equal identity', () => {
    const steps = [
      ...PRESET_FORMATIONS.flatMap((f) => composed(f.id)),
      ...PIPELINES.flatMap((p) => p.steps),
    ].filter((s) => s.cppClass);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const entry = EQS_CATALOG.find((c) => c.id === step.componentId);
      expect(entry, `${step.label} → ${step.componentId}`).toBeDefined();
      expect(step.cppClass).toBe(entry!.cppClass);
      expect(step.kind).toBe(entry!.kind);
      expect(step.cost).toBe(entry!.cost);
    }
  });

  it('catalog holds the squad-only components as proposed; the inventory is exactly its source entries', () => {
    expect(eqsComponent('ctx-squad-allies')).toMatchObject({
      cppClass: 'UEnvQueryContext_SquadAllies', status: 'proposed',
    });
    expect(eqsComponent('test-ally-separation')).toMatchObject({
      cppClass: 'UEnvQueryTest_AllySeparation', status: 'proposed',
    });
    const sourceClasses = EQS_CATALOG.filter((c) => c.status === 'source').map((c) => c.cppClass);
    expect(EQS_COMPONENTS.map((c) => c.cppClass)).toEqual(sourceClasses);
    // [guard] the inventory shows the same 8 components in the same order as before.
    expect(EQS_COMPONENTS.map((c) => c.cppClass)).toEqual([
      'UEnvQueryContext_TargetActor',
      'UEnvQueryGenerator_AttackPositions',
      'UEnvQueryGenerator_PatrolPoints',
      'UEnvQueryGenerator_CoverPositions',
      'UEnvQueryTest_FlankAngle',
      'UEnvQueryTest_PathExists',
      'UEnvQueryTest_LineOfSight',
      'UEnvQueryTest_ElevationAdvantage',
    ]);
  });

  it('squad PathExists carries the catalog cost, so the cost-sorted runtime order runs it last', () => {
    const steps = composed('ambush');
    expect(byLabel(steps, 'PathExists').cost).toBe('High');
    const runtime = runtimeTestOrder(steps);
    expect(runtime.length).toBeGreaterThan(1);
    expect(runtime[runtime.length - 1].label).toBe('PathExists');
  });

  it('marks steps the TS allocator does not model as simulated:false', () => {
    const steps = [...composed('ambush'), ...composed('wolf-pack')];
    for (const label of ['CoverPositions', 'LineOfSight', 'PathExists']) {
      expect(byLabel(steps, label).simulated, label).toBe(false);
    }
    for (const label of ['AttackPositions', 'FlankAngle', 'AllySeparation', 'Distance']) {
      expect(byLabel(steps, label).simulated, label).toBe(true);
    }
  });
});

describe('squad PipelineView surfaces the catalog facts', () => {
  it('badges UE5-only steps and names the cost-sorted runtime order when it differs', () => {
    const formation = PRESET_FORMATIONS.find((f) => f.id === 'ambush')!;
    const r = runSquadSimulation({ ...DEFAULT_DIRECTOR_CONFIG, formation });
    if (!r.ok) throw new Error(r.error.message);
    render(createElement(PipelineView, { result: r.data }));
    // CoverPositions, LineOfSight, PathExists
    expect(screen.getAllByTestId('squad-step-unsimulated')).toHaveLength(3);
    expect(screen.getByTestId('squad-pipeline-runtime-order').textContent)
      .toContain('FlankAngle (Low) → AllySeparation (Low) → LineOfSight (High) → PathExists (High)');
  });
});
