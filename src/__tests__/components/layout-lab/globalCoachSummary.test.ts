/**
 * The coach's ranking is a refactor of its INPUT, not of the ladder.
 *
 * `useGlobalCoach` used to download every produce body in the project (7.41 MB against the
 * real `~/.pof/pof.db`) to rank a top-5 list. It now reads the blob-free verdict projection.
 * These cases pin the two derivations against each other on a fixture catalog — same
 * artifacts, two projections, byte-identical candidates — and state the ONE place they can
 * legitimately differ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// Same deterministic trick globalCoach.test.ts uses: each step's accept reads `__status`
// from its data, so BOTH derivations are exercised exactly without depending on any real
// catalog's acceptance logic.
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
    ...(data.__reason ? { reason: data.__reason as string } : {}),
  }),
}));

import {
  buildCatalogCandidates,
  buildCatalogCandidatesFromSummary,
  groupSummaryByEntity,
  rankCoachCandidates,
} from '@/components/layout-lab/globalCoachModel';
import { toStepSummary } from '@/components/layout-lab/stepSummary';

const STEPS = ['A', 'B', 'C'];
const entity = (id: string): LabEntity => ({ id, name: id.toUpperCase(), lifecycle: 'planned', data: {} });

/** A server row whose PERSISTED status matches what its data grades to — what the artifacts
 *  POST route guarantees for every registered pipeline (it re-grades every write). */
const row = (entityId: string, step: string, status: string, extra: Partial<PipelineArtifact> = {}): PipelineArtifact => ({
  catalogId: 'fix', entityId, step,
  data: { __status: status, seed: `${entityId}/${step}` },
  ueAssets: [`/Game/${entityId}/${step}`],
  status: status as PipelineArtifact['status'], tier: 'L0',
  updatedAt: '2026-08-17T10:00:00.000Z',
  ...extra,
});

function bothPaths(arts: PipelineArtifact[], entities: LabEntity[], localByEntity: Record<string, Record<string, LabStepArtifact>> = {}) {
  const serverByEntity = new Map<string, Map<string, PipelineArtifact>>();
  for (const a of arts) {
    const r = serverByEntity.get(a.entityId) ?? new Map<string, PipelineArtifact>();
    r.set(a.step, a);
    serverByEntity.set(a.entityId, r);
  }
  const shared = { catalogId: 'fix', catalogLabel: 'Fixture', steps: STEPS, entities, localByEntity };
  return {
    full: rankCoachCandidates(buildCatalogCandidates({ ...shared, serverByEntity }), 99),
    summary: rankCoachCandidates(
      buildCatalogCandidatesFromSummary({ ...shared, summaryByEntity: groupSummaryByEntity(arts.map(toStepSummary)) }),
      99,
    ),
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('coach ranking — blob-free input vs full artifacts', () => {
  it('produces the identical ranked candidate list for a fixture catalog', () => {
    const arts = [
      row('e1', 'A', 'pass'), row('e1', 'B', 'fail'), row('e1', 'C', 'pass'),
      row('e2', 'A', 'pass'), row('e2', 'B', 'deferred'),
      row('e3', 'A', 'pass'), row('e3', 'B', 'pass'), row('e3', 'C', 'pass'),
    ];
    const { full, summary } = bothPaths(arts, [entity('e1'), entity('e2'), entity('e3'), entity('e4')]);

    // Sanity: the fixture actually exercises the ladder (fail > deferred > unproduced),
    // and the config-complete entity contributes nothing.
    expect(full.map((c) => `${c.entityId}:${c.priority}`)).toEqual(['e1:fail', 'e2:deferred', 'e4:unproduced']);
    expect(summary).toEqual(full);
  });

  it('carries the same concrete reason on a failed step', () => {
    const failing = row('e1', 'B', 'fail');
    failing.data.__reason = 'price/power 1.43x out of band';
    failing.reason = 'price/power 1.43x out of band';
    const { full, summary } = bothPaths([row('e1', 'A', 'pass'), failing], [entity('e1')]);
    expect(full[0].reason).toBe('price/power 1.43x out of band');
    expect(summary).toEqual(full);
  });

  it('reports CONTENT drift identically — the fingerprint survives the blob-free payload', () => {
    const arts = [row('e1', 'A', 'pass'), row('e1', 'B', 'pass'), row('e1', 'C', 'pass')];
    // Local holds the same VERDICT but different produced content — invisible to a
    // status-only comparison, caught by `labContentHash` vs the summary's `driftHash`.
    const local: Record<string, Record<string, LabStepArtifact>> = {
      e1: {
        A: { done: true, data: { __status: 'pass', seed: 'e1/A' }, ueAssets: ['/Game/e1/A'], at: '2026-08-17T10:00:00.000Z' },
        B: { done: true, data: { __status: 'pass', seed: 'CHANGED' }, ueAssets: ['/Game/e1/B'], at: '2026-08-17T10:00:00.000Z' },
        C: { done: true, data: { __status: 'pass', seed: 'e1/C' }, ueAssets: ['/Game/e1/C'], at: '2026-08-17T10:00:00.000Z' },
      },
    };
    const { full, summary } = bothPaths(arts, [entity('e1')], local);
    expect(full).toHaveLength(1);
    expect(full[0]).toMatchObject({ step: 'B', priority: 'drift' });
    expect(full[0].reason).toContain('the produced content differs from the server');
    expect(summary).toEqual(full);
  });

  it('reports STATUS drift identically', () => {
    // The server condemned B; the local artifact still grades `pass`. The step SHOWS pass,
    // so nothing is on the `fail` rung — `drift` is what the coach must surface.
    const arts = [row('e1', 'A', 'pass'), row('e1', 'B', 'fail'), row('e1', 'C', 'pass')];
    const local: Record<string, Record<string, LabStepArtifact>> = {
      e1: { B: { done: true, data: { __status: 'pass' }, ueAssets: [], at: '2026-08-17T11:00:00.000Z' } },
    };
    const { full, summary } = bothPaths(arts, [entity('e1')], local);
    expect(full[0]).toMatchObject({ step: 'B', priority: 'drift', reason: 'local reads pass, server says fail' });
    expect(summary).toEqual(full);
  });

  it('an entity with nothing anywhere reads `unproduced` on both paths', () => {
    const { full, summary } = bothPaths([], [entity('ghost')]);
    expect(full[0]).toMatchObject({ entityId: 'ghost', priority: 'unproduced', step: 'A' });
    expect(full[0].reason).toBeUndefined();
    expect(summary).toEqual(full);
  });

  it('DOCUMENTED divergence: a server-only step reports the PERSISTED verdict, not a client re-grade', () => {
    // The one shape where the two inputs disagree: a row whose stored status does not match
    // what its data grades to. The artifacts POST route re-grades every write, so this only
    // occurs for a catalog the server cannot grade (the bespoke `items` specs) — measured at
    // 31 of 817 rows on the real DB, all of them in `items`.
    const stale = row('e1', 'B', 'fail');
    stale.status = 'pass'; // the server stored `pass`; the checker now says `fail`
    const { full, summary } = bothPaths([row('e1', 'A', 'pass'), stale, row('e1', 'C', 'pass')], [entity('e1')]);
    expect(full[0]).toMatchObject({ step: 'B', priority: 'fail' }); // client re-grade
    expect(summary).toEqual([]); // the persisted verdict says this entity is complete
  });
});
