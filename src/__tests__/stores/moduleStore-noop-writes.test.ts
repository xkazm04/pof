/**
 * A write that changes nothing is not a mutation: no debounced database save and
 * no new references for subscribers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModuleStore } from '@/stores/moduleStore';
import { autoSaveLifecycle, cancelAutoSave } from '@/services/ProjectModuleBridge';

const store = () => useModuleStore.getState();

beforeEach(() => {
  cancelAutoSave();
  useModuleStore.setState({ checklistProgress: {}, checklistCompletedAt: {}, scanResults: {} });
});

describe('setChecklistItem', () => {
  it('schedules no save when the item already has that value', () => {
    useModuleStore.setState({ checklistProgress: { 'arpg-combat': { 'acb-1': true } } });
    store().setChecklistItem('arpg-combat', 'acb-1', true);
    expect(autoSaveLifecycle.isActive()).toBe(false);
  });

  it('schedules a save on a real change', () => {
    store().setChecklistItem('arpg-combat', 'acb-1', true);
    expect(autoSaveLifecycle.isActive()).toBe(true);
    cancelAutoSave();
  });
});

describe('addScanFindings', () => {
  const finding = (id: string) => ({ id, file: 'A.cpp', description: 'same', severity: 'low' }) as never;

  it('dedupes inside one batch, as it does against stored findings', () => {
    store().addScanFindings('arpg-combat', [finding('1'), finding('2')]);
    expect(store().scanResults['arpg-combat']).toHaveLength(1);
  });
});

describe('scan finding no-ops', () => {
  const stored = { id: 'f1', file: 'A.cpp', description: 'x', severity: 'low', resolvedAt: '2026-01-01T00:00:00.000Z' } as never;

  it('resolving an already resolved finding keeps its first timestamp and reference', () => {
    useModuleStore.setState({ scanResults: { 'arpg-combat': [stored] } });
    const before = store().scanResults;
    store().resolveScanFinding('arpg-combat', 'f1');
    expect(store().scanResults).toBe(before);
  });

  it('an unknown finding id changes nothing', () => {
    useModuleStore.setState({ scanResults: { 'arpg-combat': [stored] } });
    const before = store().scanResults;
    store().resolveScanFinding('arpg-combat', 'nope');
    expect(store().scanResults).toBe(before);
  });

  it('clearing an already empty module changes nothing', () => {
    useModuleStore.setState({ scanResults: { 'arpg-combat': [] } });
    const before = store().scanResults;
    store().clearScanFindings('arpg-combat');
    expect(store().scanResults).toBe(before);
  });

  it('resolving an open finding stamps it', () => {
    useModuleStore.setState({ scanResults: { 'arpg-combat': [{ id: 'f2', file: 'B', description: 'y' } as never] } });
    store().resolveScanFinding('arpg-combat', 'f2');
    expect(store().scanResults['arpg-combat'][0].resolvedAt).toBeTruthy();
  });
});
