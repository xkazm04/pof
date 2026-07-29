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

function srv(step: string, status: PipelineArtifact['status'], data: Record<string, unknown> = {}): PipelineArtifact {
  return { catalogId: 'items', entityId: 'e1', step, data, ueAssets: [], status };
}

/** The server row a `seed({ step: {status, tier} })` local artifact was synced FROM — same
 *  content, so only the verdict can differ. Content drift is asserted explicitly below. */
function srvMatching(step: string, status: PipelineArtifact['status'], local: { status?: string; tier?: string }): PipelineArtifact {
  return srv(step, status, { ...(local.status ? { __status: local.status } : {}), ...(local.tier ? { __tier: local.tier } : {}) });
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

  it('returns empty artifacts when there is no catalogId (but still counts real produce state)', () => {
    // No catalogId → no acceptance can be resolved, so no derived artifacts; `done` still
    // reflects the real produce state (the step was produced into the local store).
    const { artifacts, done } = deriveEntityArtifacts(undefined, entity, ['A'], seed({ A: {} }), {});
    expect(artifacts).toEqual([]);
    expect(done).toBe(1);
  });

  it('displayStatus reflects the artifact status, mapping pending for produced-but-pending', () => {
    const steps = ['A', 'B'];
    const { displayStatus } = deriveEntityArtifacts('items', entity, steps, seed({ A: { status: 'fail' }, B: { status: 'pending' } }), {});
    expect(displayStatus('A', 0)).toBe('fail');
    expect(displayStatus('B', 1)).toBe('pending'); // produced but pending acceptance
  });

  it('a step with NO artifact reads as unproduced — never a heuristic pass (lifecycle is ignored)', () => {
    // A `verified` non-Items entity with no produced artifacts used to fabricate all-pass
    // via the lifecycle fraction; now every unproduced step is honestly `unproduced`.
    const verified: LabEntity = { ...entity, lifecycle: 'verified' };
    const steps = ['A', 'B'];
    const { displayStatus, done } = deriveEntityArtifacts('bestiary', verified, steps, undefined, {});
    expect(displayStatus('A', 0)).toBe('unproduced');
    expect(displayStatus('B', 1)).toBe('unproduced');
    expect(done).toBe(0); // nothing was actually produced
  });

  it('distinguishes unproduced (no artifact) from pending (produced, acceptance resolving)', () => {
    const steps = ['A', 'B'];
    // A produced but acceptance-pending; B never produced.
    const { displayStatus } = deriveEntityArtifacts('bestiary', entity, steps, seed({ A: { status: 'pending' } }), {});
    expect(displayStatus('A', 0)).toBe('pending');
    expect(displayStatus('B', 1)).toBe('unproduced');
  });
});

describe('deriveEntityArtifacts — server↔local drift', () => {
  const steps = ['Economy'];

  it('flags drift when a concrete local verdict contradicts a concrete server verdict', () => {
    // Local recompute says pass; the server re-graded the same step to fail. Add-only
    // hydration keeps the local `pass` on screen, so this MUST surface as drift.
    const { driftByStep, artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Economy: { status: 'pass' } }), { Economy: srvMatching('Economy', 'fail', { status: 'pass' }) });
    expect(driftByStep.get('Economy')).toEqual({ kind: 'status', local: 'pass', server: 'fail' });
    expect(artifactByStep.get('Economy')?.status).toBe('pass'); // display stays local (no auto-clobber)
  });

  it('does NOT flag drift for the sanctioned deferred→server overlay (that is resolution)', () => {
    // Local deferred + server pass is the L3/L4 gate overlay, not drift — the server
    // verdict is adopted into the displayed status, and nothing needs operator action.
    const local = { status: 'deferred', tier: 'L3' };
    const { driftByStep, artifactByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Economy: local }), { Economy: srvMatching('Economy', 'pass', local) });
    expect(driftByStep.size).toBe(0);
    expect(artifactByStep.get('Economy')?.status).toBe('pass');
  });

  it('does NOT flag drift when local and server agree', () => {
    const { driftByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Economy: { status: 'pass' } }), { Economy: srvMatching('Economy', 'pass', { status: 'pass' }) });
    expect(driftByStep.size).toBe(0);
  });

  it('flags CONTENT drift when the verdicts agree but the produced data differs', () => {
    // The divergence a status-only comparison can never see: another session (or the MCP
    // submit path) rewrote the step's data and the checker still graded it `pass`.
    const { driftByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Economy: { status: 'pass' } }), {
      Economy: srv('Economy', 'pass', { __status: 'pass', goldPerHour: 42 }),
    });
    expect(driftByStep.get('Economy')).toEqual({ kind: 'content', local: 'pass', server: 'pass' });
  });

  it('flags CONTENT drift on a differing UE asset manifest (order-insensitive)', () => {
    const local = seed({ Economy: { status: 'pass' } });
    local.Economy.ueAssets = ['/Game/A', '/Game/B'];
    const reordered = srvMatching('Economy', 'pass', { status: 'pass' });
    reordered.ueAssets = ['/Game/B', '/Game/A'];
    expect(deriveEntityArtifacts('items', entity, steps, local, { Economy: reordered }).driftByStep.size).toBe(0);
    const extra = srvMatching('Economy', 'pass', { status: 'pass' });
    extra.ueAssets = ['/Game/A', '/Game/B', '/Game/C'];
    expect(deriveEntityArtifacts('items', entity, steps, local, { Economy: extra }).driftByStep.get('Economy')?.kind).toBe('content');
  });

  it('ignores the SERVER-STAMPED `_provenance` key (or every produced step would read as drifted)', () => {
    // `/api/pipeline-artifacts` POST stamps `_provenance` onto what it persists, so the row
    // that comes back ALWAYS carries a key the local artifact never had.
    const { driftByStep } = deriveEntityArtifacts('items', entity, steps, seed({ Economy: { status: 'pass' } }), {
      Economy: srv('Economy', 'pass', { __status: 'pass', _provenance: { engine: 'stub', promptVersion: '7' } }),
    });
    expect(driftByStep.size).toBe(0);
  });

  it('does NOT double-report content drift for a step whose write-through is already flagged', () => {
    // The sync-error banner + rail badge + retry already tell this story precisely.
    const local = seed({ Economy: { status: 'pass' } });
    local.Economy.syncError = 'Not saved to the server: HTTP 500';
    const { driftByStep } = deriveEntityArtifacts('items', entity, steps, local, {
      Economy: srv('Economy', 'pass', { __status: 'pass', stale: true }),
    });
    expect(driftByStep.size).toBe(0);
  });

  it('does NOT flag drift against a non-concrete server verdict (pending/deferred)', () => {
    const pendingSrv = deriveEntityArtifacts('items', entity, steps, seed({ Economy: { status: 'pass' } }), { Economy: srv('Economy', 'pending') });
    expect(pendingSrv.driftByStep.size).toBe(0);
    const deferredSrv = deriveEntityArtifacts('items', entity, steps, seed({ Economy: { status: 'pass' } }), { Economy: srv('Economy', 'deferred') });
    expect(deferredSrv.driftByStep.size).toBe(0);
  });
});

describe('deriveEntityArtifacts — stepDone / done (real produce state, no lifecycle heuristic)', () => {
  it('counts produced steps for Items, not lifecycle', () => {
    const steps = ['A', 'B', 'C'];
    const { stepDone, done } = deriveEntityArtifacts('items', entity, steps, seed({ A: {}, B: {} }), {});
    expect(stepDone('A', 0)).toBe(true);
    expect(stepDone('C', 2)).toBe(false);
    expect(done).toBe(2); // planned lifecycle is ignored
  });

  it('counts NON-Items steps by real produce state too (no lifecycle fabrication)', () => {
    const verified: LabEntity = { ...entity, lifecycle: 'verified' }; // used to fake 100%
    const steps = ['A', 'B', 'C', 'D', 'E'];
    // No produced artifacts → nothing done, regardless of the `verified` lifecycle.
    expect(deriveEntityArtifacts('bestiary', verified, steps, undefined, {}).done).toBe(0);
    // One produced step → exactly one done.
    expect(deriveEntityArtifacts('bestiary', verified, steps, seed({ B: {} }), {}).done).toBe(1);
  });
});
