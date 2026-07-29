import { describe, it, expect, beforeEach } from 'vitest';
import { useLabPipelineStore, SERVER_MISSING_REASON, type LabStepArtifact } from '@/components/layout-lab/labPipelineStore';

/**
 * `refreshEntity` is the lab's EXPLICIT reconciliation with the server — the escape from
 * add-only hydration, which can only ever add. The two things it must get right are in
 * tension, so both are pinned here:
 *
 *  - it must ADOPT server truth (content included) and REMOVE a step the server dropped,
 *    otherwise a stale step reads green forever;
 *  - it must never destroy local work the server has not got.
 */

const at = (iso: string) => `2026-07-${iso}T00:00:00Z`;

const serverArtifact = (data: Record<string, unknown>, when = at('20'), extra: Partial<LabStepArtifact> = {}): LabStepArtifact =>
  ({ done: true, data, ueAssets: [], at: when, status: 'pass', tier: 'L0', ...extra });

const steps = () => useLabPipelineStore.getState().byEntity.e1 ?? {};

/** Put the store in the state a normal load leaves it in: hydrated FROM the server. */
function hydratedFromServer(step: string, data: Record<string, unknown>, when = at('10')) {
  useLabPipelineStore.getState().hydrateEntity('e1', [{ step, artifact: serverArtifact(data, when) }]);
}

describe('labPipelineStore.refreshEntity — adopt', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });

  it('adopts changed server CONTENT for a step that was hydrated from the server', () => {
    hydratedFromServer('Economy', { price: 10 });
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', [
      { step: 'Economy', artifact: serverArtifact({ price: 250 }, at('20')) },
    ]);
    expect(steps().Economy.data).toEqual({ price: 250 });
    expect(outcome.adopted).toEqual(['Economy']);
    expect(outcome.kept).toEqual([]);
  });

  it('reports an identical server row as unchanged (the happy path costs nothing)', () => {
    hydratedFromServer('Economy', { price: 10 });
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', [
      { step: 'Economy', artifact: serverArtifact({ price: 10 }, at('10')) },
    ]);
    expect(outcome).toEqual({ adopted: [], removed: [], kept: [], unchanged: 1 });
  });

  it('adds a step the server has and the browser has never seen', () => {
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', [
      { step: 'Art', artifact: serverArtifact({ icon: 'blade' }) },
    ]);
    expect(steps().Art.data).toEqual({ icon: 'blade' });
    expect(outcome.adopted).toEqual(['Art']);
  });

  it('preserves the local candidate archive when adopting (as adoptServer does)', () => {
    const genHistory = { batches: [{ id: 'b1', candidates: [] }], selectedId: 'b1' };
    hydratedFromServer('Icon 2D Art', { selected: 'old', genHistory });
    useLabPipelineStore.getState().refreshEntity('e1', [
      { step: 'Icon 2D Art', artifact: serverArtifact({ selected: 'srv' }, at('20')) },
    ]);
    const d = steps()['Icon 2D Art'].data;
    expect(d.selected).toBe('srv');
    expect(d.genHistory).toEqual(genHistory);
  });
});

describe('labPipelineStore.refreshEntity — reconcile a deleted server row', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });

  it('REMOVES a server-derived step the server no longer has', () => {
    hydratedFromServer('Economy', { price: 10 });
    hydratedFromServer('Art', { icon: 'blade' });
    // The server now only holds Economy — Art was deleted by another session.
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', [
      { step: 'Economy', artifact: serverArtifact({ price: 10 }, at('10')) },
    ]);
    expect(Object.keys(steps())).toEqual(['Economy']);
    expect(outcome.removed).toEqual(['Art']);
  });

  it('KEEPS a locally-produced step the server never received, and says why', () => {
    useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 999 } });
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', []);
    expect(steps().Economy.data).toEqual({ price: 999 }); // NOT destroyed
    expect(outcome.kept).toEqual(['Economy']);
    expect(outcome.removed).toEqual([]);
    expect(steps().Economy.syncError).toBe(SERVER_MISSING_REASON);
  });

  it('never removes a legacy artifact that predates the serverSeen stamp (no proof either way)', () => {
    useLabPipelineStore.setState({ byEntity: { e1: { Economy: { done: true, data: { price: 1 }, ueAssets: [], at: at('01') } } } });
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', []);
    expect(steps().Economy).toBeTruthy();
    expect(outcome.kept).toEqual(['Economy']);
  });
});

describe('labPipelineStore.refreshEntity — never overwrites unsaved local work', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });

  it('keeps a step whose write-through is on record as failed', () => {
    useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 999 } });
    useLabPipelineStore.getState().setSyncError('e1', 'Economy', 'Not saved to the server: HTTP 500');
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', [
      { step: 'Economy', artifact: serverArtifact({ price: 10 }, at('01')) },
    ]);
    expect(steps().Economy.data).toEqual({ price: 999 });
    expect(outcome.kept).toEqual(['Economy']);
  });

  it('keeps a local produce that is STRICTLY newer than the server row', () => {
    hydratedFromServer('Economy', { price: 10 }, at('10'));
    useLabPipelineStore.setState((s) => ({
      byEntity: { e1: { Economy: { ...s.byEntity.e1.Economy, data: { price: 777 }, at: at('25') } } },
    }));
    const outcome = useLabPipelineStore.getState().refreshEntity('e1', [
      { step: 'Economy', artifact: serverArtifact({ price: 10 }, at('20')) },
    ]);
    expect(steps().Economy.data).toEqual({ price: 777 });
    expect(outcome.kept).toEqual(['Economy']);
  });
});

describe('labPipelineStore.hydrateEntity — server provenance', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });

  it('stamps serverSeen so a later refresh can tell server-derived from local-only', () => {
    hydratedFromServer('Economy', { price: 10 }, at('10'));
    expect(steps().Economy.serverSeen).toBe(at('10'));
    // A locally produced step carries no stamp.
    useLabPipelineStore.getState().produce('e1', 'Art', { data: {} });
    expect(steps().Art.serverSeen).toBeUndefined();
  });

  it('still CLEARS a stale syncError when the server row is at least as new (unchanged rule)', () => {
    useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 999 } });
    useLabPipelineStore.getState().setSyncError('e1', 'Economy', 'Not saved to the server: HTTP 500');
    useLabPipelineStore.getState().hydrateEntity('e1', [
      { step: 'Economy', artifact: serverArtifact({ price: 999 }, new Date(Date.now() + 60_000).toISOString()) },
    ]);
    expect(steps().Economy.syncError).toBeUndefined();
    expect(steps().Economy.data).toEqual({ price: 999 }); // content still add-only
  });
});
