/**
 * scan-sweep --challenge catalog-browser-ui/B — the Matrix triage model. The board ranks its
 * rows by the SAME ladder the coaches use (`COACH_LADDER`) with the entity id as the total-order
 * tiebreaker, filters to one rung or to one column's status, and counts carry their predicate.
 */
import { describe, it, expect, vi } from 'vitest';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { StepDisplayStatus } from '@/components/layout-lab/hooks/useEntityArtifacts';
import type { CoachPriority } from '@/components/layout-lab/coachLadder';

// Each step grades to its data's `__status` (the matrixRows.test trick).
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  }),
}));

import { buildMatrixRows, type MatrixRow } from '@/components/layout-lab/matrixRows';
import { rankMatrixRows, filterMatrixRows, tallyRungs, describePredicate } from '@/components/layout-lab/matrixTriage';

const STEPS = ['Brief', 'Test Gate', 'Sprite Render'];

/** A row whose ladder pick is `priority` (at `step`) and whose cells read `cells`. */
function row(id: string, priority: CoachPriority | null, cells: Record<string, StepDisplayStatus> = {}, notMine: string[] = []): MatrixRow {
  const own = STEPS.filter((s) => !notMine.includes(s));
  const step = Object.keys(cells).find((s) => cells[s] === priority) ?? own[0];
  return {
    id, name: id.toUpperCase(),
    statusByStep: (s) => cells[s] ?? 'pass',
    applies: (s) => own.includes(s),
    stepIndex: (s) => own.indexOf(s),
    rollup: { done: 0, total: own.length, configComplete: priority === null, deferred: 0 } as MatrixRow['rollup'],
    blockers: [],
    issue: priority ? { step, index: own.indexOf(step), priority } : null,
  };
}

const FIVE = [
  row('e1', 'unproduced', { Brief: 'unproduced' }),
  row('e2', 'deferred', { 'Test Gate': 'deferred' }),
  row('e3', 'fail', { Brief: 'fail', 'Test Gate': 'deferred' }),
  row('e4', null),
  row('e5', 'deferred', { 'Test Gate': 'deferred' }),
];

describe('rankMatrixRows — the coach ladder is the board order', () => {
  it('orders by COACH_LADDER rank, then entity id; storage order cannot change it', () => {
    expect(rankMatrixRows(FIVE).map((r) => r.id)).toEqual(['e3', 'e2', 'e5', 'e1', 'e4']);
    expect(rankMatrixRows([...FIVE].reverse()).map((r) => r.id)).toEqual(['e3', 'e2', 'e5', 'e1', 'e4']);
  });
});

describe('buildMatrixRows exposes the coaches\' pick as row.issue', () => {
  const entity: LabEntity = { id: 'e1', name: 'E1', lifecycle: 'planned', data: {} };
  const srv = (step: string, status: PipelineArtifact['status']): PipelineArtifact =>
    ({ catalogId: 'c', entityId: 'e1', step, data: { __status: status }, ueAssets: [], status });
  const local = (status: string): LabStepArtifact => ({ done: true, data: { __status: status }, ueAssets: [], at: '' });

  it('an entity with one local-vs-server drift and one deferred step reads drift (same pick the coaches make)', () => {
    const server = new Map([['e1', new Map([['A', srv('A', 'fail')], ['B', srv('B', 'deferred')]])]]);
    const [r] = buildMatrixRows('c', [entity], server, { e1: { A: local('pass') } }, ['A', 'B']);
    expect(r.statusByStep('B')).toBe('deferred');
    expect(r.issue).toEqual({ step: 'A', index: 0, priority: 'drift' });
  });
});

describe('filterMatrixRows + tallyRungs + describePredicate', () => {
  it('a rung predicate keeps exactly that rung; tallies count the UNFILTERED set; the caption carries the predicate', () => {
    const p = { kind: 'rung', rung: 'deferred' } as const;
    const shown = filterMatrixRows(FIVE, p);
    expect(shown.map((r) => r.id)).toEqual(['e2', 'e5']);
    expect(tallyRungs(FIVE)).toEqual({ fail: 1, drift: 0, pending: 0, deferred: 2, unproduced: 1, none: 1 });
    expect(describePredicate(p, shown.length, FIVE.length)).toBe('2 of 5 · deferred');
  });

  it('a column predicate keeps rows whose cell reads that status; a step not in the row\'s pipeline never counts', () => {
    const rows = [
      row('a', 'deferred', { 'Test Gate': 'deferred' }),
      row('b', 'fail', { Brief: 'fail', 'Test Gate': 'pass' }),
      // Not this entity's step: its statusByStep would read 'unproduced', but it does not apply.
      row('c', 'unproduced', { 'Sprite Render': 'unproduced', 'Test Gate': 'deferred' }, ['Test Gate']),
      row('d', 'deferred', { 'Test Gate': 'deferred', Brief: 'deferred' }),
    ];
    const p = { kind: 'column', step: 'Test Gate', status: 'deferred' } as const;
    expect(filterMatrixRows(rows, p).map((r) => r.id)).toEqual(['a', 'd']);
    const unproduced = { kind: 'column', step: 'Sprite Render', status: 'unproduced' } as const;
    expect(filterMatrixRows([row('x', null, {}, ['Sprite Render'])], unproduced)).toEqual([]);
    expect(describePredicate(p, 2, 4)).toBe('2 of 4 · Test Gate: deferred');
  });
});
