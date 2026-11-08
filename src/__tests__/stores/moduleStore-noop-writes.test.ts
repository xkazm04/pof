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
    useModuleStore.setState({ checklistProgress: { 'arpg-combat': { a: true } } });
    store().setChecklistItem('arpg-combat', 'a', true);
    expect(autoSaveLifecycle.isActive()).toBe(false);
  });

  it('schedules a save on a real change', () => {
    store().setChecklistItem('arpg-combat', 'a', true);
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
