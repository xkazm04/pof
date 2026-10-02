import { describe, it, expect, beforeEach } from 'vitest';
import { useLabRunnerStore, batchRunId, type DrainRun } from '@/components/layout-lab/labRunnerStore';
import { drainLane } from '@/components/layout-lab/activityModel';
import { emptyBatchSummary } from '@/components/layout-lab/batchDrainModel';

/**
 * Drain runs are owned by the lab's runner store, keyed by run id — never by the component
 * that started them, and never by whichever catalog the viewer currently has open. These cases
 * pin the store's contract: begin / cancel / finish / dismiss, the derived `localDrain` the lease
 * poll skips on, and the drain lane read straight off the runs.
 */

const store = () => useLabRunnerStore.getState();
const runs = (): DrainRun[] => Object.values(store().runs);
const FREE = { held: false, scope: null, since: null, scopes: [] };

beforeEach(() => { useLabRunnerStore.setState({ runs: {}, localDrain: null }); });

describe('labRunnerStore — keyed drain runs', () => {
  it('begins a batch run keyed by catalog and derives localDrain from it', () => {
    expect(store().beginRun({ id: batchRunId('items'), kind: 'batch', catalogId: 'items', entityIds: ['e1', 'e2'], scope: 'items · 2 sets' })).toBe(true);
    const run = store().runs[batchRunId('items')];
    expect(run).toMatchObject({ kind: 'batch', catalogId: 'items', phase: 'running', cancelRequested: false, cancelEffect: null });
    expect(run.entityIds).toEqual(['e1', 'e2']);
    expect(store().localDrain).toBe('items · 2 sets');
  });

  it('refuses a second begin of a run that is still running (no overlapping drains under one id)', () => {
    store().beginRun({ id: batchRunId('items'), kind: 'batch', catalogId: 'items', entityIds: ['e1'], scope: 'items · 1 set' });
    expect(store().beginRun({ id: batchRunId('items'), kind: 'batch', catalogId: 'items', entityIds: ['e1', 'e2'], scope: 'items · 2 sets' })).toBe(false);
    expect(store().runs[batchRunId('items')].entityIds).toEqual(['e1']);
  });

  it('a batch on catalog B is its own run while catalog A runs (no silent ignore)', () => {
    store().beginRun({ id: batchRunId('items'), kind: 'batch', catalogId: 'items', entityIds: ['e1'], scope: 'items · 1 set' });
    expect(store().beginRun({ id: batchRunId('spellbook'), kind: 'batch', catalogId: 'spellbook', entityIds: ['s1'], scope: 'spellbook · 1 set' })).toBe(true);
    expect(runs()).toHaveLength(2);
  });

  it('dismissRun(<items run id>) falls the lane back to the lease-derived state', () => {
    const id = batchRunId('items');
    store().beginRun({ id, kind: 'batch', catalogId: 'items', entityIds: ['e1', 'e2'], scope: 'items · 2 sets' });
    store().finishRun(id, { summary: { ...emptyBatchSummary(), ran: 2, passed: 1, failed: 1, entitiesRun: 2 }, cancelEffect: null });
    expect(drainLane({ runs: runs(), lease: FREE, leaseProbe: 'ok' }).state).toBe('attention');

    store().dismissRun(id);
    expect(store().runs[id]).toBeUndefined();
    expect(drainLane({ runs: runs(), lease: FREE, leaseProbe: 'ok' }).state).toBe('idle');
  });

  it('dismissRun is ignored while the run is live (a running drain cannot be dismissed)', () => {
    const id = batchRunId('items');
    store().beginRun({ id, kind: 'batch', catalogId: 'items', entityIds: ['e1'], scope: 'items · 1 set' });
    store().dismissRun(id);
    expect(store().runs[id].phase).toBe('running');
  });

  it('requestCancel on a running batch reaches the lane label from the run\'s own flag', () => {
    const id = batchRunId('items');
    store().beginRun({ id, kind: 'batch', catalogId: 'items', entityIds: ['e1', 'e2'], scope: 'items · 2 sets' });
    expect(store().requestCancel(id)).toBe(true);
    expect(store().runs[id].cancelRequested).toBe(true);
    const lane = drainLane({ runs: runs(), lease: null, leaseProbe: 'unpolled' });
    expect(lane.state).toBe('running-here');
    expect(lane.label).toContain('cancel requested');
  });

  it('requestCancel outside a live run is a no-op', () => {
    const id = batchRunId('items');
    expect(store().requestCancel(id)).toBe(false);
    store().beginRun({ id, kind: 'batch', catalogId: 'items', entityIds: ['e1'], scope: 'items · 1 set' });
    store().finishRun(id, { summary: emptyBatchSummary(), cancelEffect: null });
    expect(store().requestCancel(id)).toBe(false);
    expect(store().runs[id].cancelRequested).toBe(false);
  });

  it('a concurrent entity drain finishing leaves the batch lane running-here (no string-ownership guard)', () => {
    const id = batchRunId('items');
    store().beginRun({ id, kind: 'batch', catalogId: 'items', entityIds: ['e1', 'e2'], scope: 'items · 2 sets' });
    store().requestCancel(id);
    store().beginRun({ id: 'items/e9', kind: 'entity', catalogId: 'items', entityIds: ['e9'], scope: 'items/e9' });
    store().finishRun('items/e9', null); // an entity drain drops its run when it ends

    expect(store().runs['items/e9']).toBeUndefined();
    const lane = drainLane({ runs: runs(), lease: null, leaseProbe: 'unpolled' });
    expect(lane.state).toBe('running-here');
    expect(lane.label).toContain('items · 2 sets');
    expect(lane.label).toContain('cancel requested');
    expect(store().localDrain).toContain('items · 2 sets');
  });

  it('localDrain clears only when no run is live', () => {
    store().beginRun({ id: batchRunId('items'), kind: 'batch', catalogId: 'items', entityIds: ['e1'], scope: 'items · 1 set' });
    store().beginRun({ id: 'items/e9', kind: 'entity', catalogId: 'items', entityIds: ['e9'], scope: 'items/e9' });
    store().finishRun(batchRunId('items'), { summary: emptyBatchSummary(), cancelEffect: null });
    expect(store().localDrain).toBe('items/e9');
    store().finishRun('items/e9', null);
    expect(store().localDrain).toBeNull();
  });
});
