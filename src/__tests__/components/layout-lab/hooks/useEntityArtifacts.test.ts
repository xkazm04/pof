import { describe, it, expect, vi } from 'vitest';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// Control the local recompute status precisely: each step's accept reads the
// status/tier the test seeded into its produce data, so the overlay rule can be
// exercised in isolation. `NoAccept*` steps have no checker (null).
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: (_catalogId: string, step: string) => {
    if (step.startsWith('NoAccept')) return null;
    return (data: Record<string, unknown>) => ({
      label: step,
      status: (data.__status as string) ?? 'pass',
      tier: (data.__tier as string) ?? 'L0',
      detail: '',
    });
  },
}));

import { deriveEntityArtifacts } from '@/components/layout-lab/hooks/useEntityArtifacts';

const entity: LabEntity = { id: 'e1', name: 'Ember Blade', lifecycle: 'planned', data: {} };

/** Build an entitySteps map from { step: localStatus } seeds. */
function seed(steps: Record<string, { status?: string; tier?: string }>): Record<string, LabStepArtifact> {
  const out: Record<string, LabStepArtifact> = {};
  for (const [step, { status, tier }] of Object.entries(steps)) {
    out[step] = { done: true, data: { ...(status ? { __status: status } : {}), ...(tier ? { __tier: tier } : {}) }, ueAssets: [], at: '2026-06-07T00:00:00Z' };
  }
  return out;
}

function srv(step: string, status: PipelineArtifact['status']): PipelineArtifact {
  return { catalogId: 'items', entityId: 'e1', step, data: {}, ueAssets: [], status };
}

describe('deriveEntityArtifacts — server overlay rule', () => {
  const steps = ['Gate'];

  it('overlays a server pass onto a still-deferred local recompute', () => {
    const { artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Gate: { status: 'deferred', tier: 'L3' } }), { Gate: srv('Gate', 'pass') });
    expect(artifactByStep.get('Gate')?.status).toBe('pass');
  });

  it('overlays a server fail onto a still-deferred local recompute', () => {
    const { artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Gate: { status: 'deferred', tier: 'L3' } }), { Gate: srv('Gate', 'fail') });
    expect(artifactByStep.get('Gate')?.status).toBe('fail');
  });

  it('keeps deferred when the server verdict is also deferred', () => {
    const { artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Gate: { status: 'deferred' } }), { Gate: srv('Gate', 'deferred') });
    expect(artifactByStep.get('Gate')?.status).toBe('deferred');
  });

  it('keeps deferred when the server verdict is only pending', () => {
    const { artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Gate: { status: 'deferred' } }), { Gate: srv('Gate', 'pending') });
    expect(artifactByStep.get('Gate')?.status).toBe('deferred');
  });

  it('keeps deferred when there is no server verdict at all', () => {
    const { artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Gate: { status: 'deferred' } }), {});
    expect(artifactByStep.get('Gate')?.status).toBe('deferred');
  });

  it('never overrides a non-deferred local status (server only breaks the deferred tie)', () => {
    // Local recompute already passed → a contradicting server fail must NOT win.
    const { artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Gate: { status: 'pass' } }), { Gate: srv('Gate', 'fail') });
    expect(artifactByStep.get('Gate')?.status).toBe('pass');
  });
});

describe('deriveEntityArtifacts — artifacts + displayStatus', () => {
  it('defaults to pass when a step has no acceptance checker', () => {
    const { artifactByStep } = deriveEntityArtifacts('items', entity, ['NoAccept1'], seed({ NoAccept1: {} }), {});
    expect(artifactByStep.get('NoAccept1')?.status).toBe('pass');
  });

  it('only emits artifacts for produced steps and carries the tier through', () => {
    const steps = ['A', 'B', 'C'];
    const { artifacts, artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ A: { status: 'pass', tier: 'L2' }, C: { status: 'fail' } }), {});
    expect(artifacts.map((a) => a.step)).toEqual(['A', 'C']); // B never produced
    expect(artifactByStep.get('A')?.tier).toBe('L2');
  });

  it('returns empty artifacts when there is no catalogId', () => {
    const { artifacts, done } = deriveEntityArtifacts(undefined, entity, ['A'], seed({ A: {} }), {});
    expect(artifacts).toEqual([]);
    expect(done).toBe(0);
  });

  it('displayStatus reflects the artifact status, mapping pending for produced-but-pending', () => {
    const steps = ['A', 'B'];
    const { displayStatus } = deriveEntityArtifacts('items', entity, steps, seed({ A: { status: 'fail' }, B: { status: 'pending' } }), {});
    expect(displayStatus('A', 0)).toBe('fail');
    expect(displayStatus('B', 1)).toBe('pending'); // produced but pending acceptance
  });

  it('displayStatus falls back to the stepDone heuristic for steps without an artifact', () => {
    // Non-Items catalog with a `verified` entity → labStepsDone marks every step done → pass.
    const verified: LabEntity = { ...entity, lifecycle: 'verified' };
    const steps = ['A', 'B'];
    const { displayStatus, done } = deriveEntityArtifacts('bestiary', verified, steps, undefined, {});
    expect(displayStatus('A', 0)).toBe('pass');
    expect(done).toBe(2);
  });
});

describe('deriveEntityArtifacts — stepDone / done', () => {
  it('counts Items steps by real produce state, not lifecycle', () => {
    const steps = ['A', 'B', 'C'];
    const { stepDone, done } = deriveEntityArtifacts('items', entity, steps, seed({ A: {}, B: {} }), {});
    expect(stepDone('A', 0)).toBe(true);
    expect(stepDone('C', 2)).toBe(false);
    expect(done).toBe(2); // planned lifecycle is ignored for Items
  });

  it('counts non-Items steps by the lifecycle heuristic', () => {
    const planned: LabEntity = { ...entity, lifecycle: 'planned' }; // 12% of 5 → ~1 step
    const steps = ['A', 'B', 'C', 'D', 'E'];
    const { done } = deriveEntityArtifacts('bestiary', planned, steps, undefined, {});
    expect(done).toBe(1);
  });
});
