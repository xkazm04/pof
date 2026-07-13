import { describe, it, expect, vi } from 'vitest';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// Same trick as useEntityArtifacts.test: each step's accept reads __status from data,
// so the matrix's derivation (via deriveEntityArtifacts) is exercised deterministically.
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_c: string, step: string) => (data: Record<string, unknown>) => ({
    label: step, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '',
  }),
}));

import { buildMatrixRows } from '@/components/layout-lab/matrixRows';

const entity = (id: string): LabEntity => ({ id, name: id.toUpperCase(), lifecycle: 'planned', data: {} });
const srvArt = (entityId: string, step: string, status: PipelineArtifact['status']): PipelineArtifact =>
  ({ catalogId: 'c', entityId, step, data: { __status: status }, ueAssets: [], status });
const localArt = (status: string): LabStepArtifact => ({ done: true, data: { __status: status }, ueAssets: [], at: '' });

function serverMap(arts: PipelineArtifact[]): Map<string, Map<string, PipelineArtifact>> {
  const m = new Map<string, Map<string, PipelineArtifact>>();
  for (const a of arts) {
    const row = m.get(a.entityId) ?? new Map();
    row.set(a.step, a);
    m.set(a.entityId, row);
  }
  return m;
}

const steps = ['A', 'B'];

describe('buildMatrixRows — shared derivation with the rail', () => {
  it('derives server-only cells (no local produce) from server truth; absent → pending', () => {
    const rows = buildMatrixRows('c', [entity('e1')], serverMap([srvArt('e1', 'A', 'pass')]), {}, steps);
    expect(rows[0].statusByStep('A')).toBe('pass');
    expect(rows[0].statusByStep('B')).toBe('pending'); // no artifact
  });

  it('applies the add-only overlay — a local produce wins over the server record (matches the rail)', () => {
    // Server says A failed; the local store has A passing → the matrix shows the LOCAL
    // verdict, exactly as the rail does for the open entity (one status code path).
    const rows = buildMatrixRows('c', [entity('e1')], serverMap([srvArt('e1', 'A', 'fail')]), { e1: { A: localArt('pass') } }, steps);
    expect(rows[0].statusByStep('A')).toBe('pass');
  });

  it('carries the deferred→server overlay into the matrix', () => {
    // Local recompute = deferred, server ran it to pass → overlay wins in the matrix too.
    const rows = buildMatrixRows('c', [entity('e1')], serverMap([srvArt('e1', 'A', 'pass')]), { e1: { A: localArt('deferred') } }, steps);
    expect(rows[0].statusByStep('A')).toBe('pass');
  });

  it('flags a blocker on a failed cell with the accept() reason path', () => {
    const rows = buildMatrixRows('c', [entity('e1')], serverMap([srvArt('e1', 'A', 'fail')]), {}, steps);
    expect(rows[0].blockers.map((b) => b.step)).toEqual(['A']);
  });
});
