import { describe, it, expect, beforeEach } from 'vitest';
import { useLabPipelineStore, type LabStepArtifact } from '@/components/layout-lab/labPipelineStore';

const server = (data: Record<string, unknown>): LabStepArtifact => ({ done: true, data, ueAssets: ['/Game/X'], at: '2026-07-10T00:00:00Z' });

const stepData = (entityId: string, step: string) =>
  useLabPipelineStore.getState().byEntity[entityId]?.[step]?.data as Record<string, unknown> | undefined;

describe('labPipelineStore.adoptServer', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); });

  it('overwrites the local step with the server artifact so the derived status can match server truth', () => {
    useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 999 } });
    useLabPipelineStore.getState().adoptServer('e1', 'Economy', server({ price: 120 }));
    expect(stepData('e1', 'Economy')).toEqual({ price: 120 });
    expect(useLabPipelineStore.getState().byEntity['e1'].Economy.ueAssets).toEqual(['/Game/X']);
  });

  it('preserves the local candidate history by default (never silently destroyed)', () => {
    const genHistory = { batches: [{ id: 'b1', candidates: [] }], selectedId: 'b1' };
    useLabPipelineStore.getState().produce('e1', 'Icon 2D Art', { data: { selected: 'old', genHistory } });
    // Server truth has a DIFFERENT (or absent) history — the local archive must survive.
    useLabPipelineStore.getState().adoptServer('e1', 'Icon 2D Art', server({ selected: 'srv', genHistory: { batches: [], selectedId: null } }));
    const d = stepData('e1', 'Icon 2D Art')!;
    expect(d.selected).toBe('srv');          // server verdict adopted
    expect(d.genHistory).toEqual(genHistory); // local archive preserved
  });

  it('replaces the candidate history only on explicit user confirmation', () => {
    const localHistory = { batches: [{ id: 'b1', candidates: [] }], selectedId: 'b1' };
    const serverHistory = { batches: [{ id: 'b9', candidates: [] }], selectedId: 'b9' };
    useLabPipelineStore.getState().produce('e1', 'Icon 2D Art', { data: { genHistory: localHistory } });
    useLabPipelineStore.getState().adoptServer('e1', 'Icon 2D Art', server({ genHistory: serverHistory }), { replaceHistory: true });
    expect(stepData('e1', 'Icon 2D Art')!.genHistory).toEqual(serverHistory);
  });

  it('hydrateEntity stays add-only — a server record never clobbers a locally-produced step', () => {
    useLabPipelineStore.getState().produce('e1', 'Economy', { data: { price: 999 } });
    useLabPipelineStore.getState().hydrateEntity('e1', [
      { step: 'Economy', artifact: server({ price: 1 }) },       // already local → ignored
      { step: 'Material', artifact: server({ roughness: 0.4 }) }, // new → added
    ]);
    expect(stepData('e1', 'Economy')).toEqual({ price: 999 }); // local preserved
    expect(stepData('e1', 'Material')).toEqual({ roughness: 0.4 }); // backfilled
  });
});
