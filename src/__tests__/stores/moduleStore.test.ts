import { describe, it, expect, beforeEach } from 'vitest';
import { useModuleStore } from '@/stores/moduleStore';
// localStorage mock is installed by vitest setupFiles (src/__tests__/setup.ts)

function resetStore() {
  useModuleStore.setState({
    moduleHistory: {},
    moduleHealth: {},
    checklistProgress: {},
  });
}

describe('useModuleStore', () => {
  beforeEach(resetStore);

  describe('setChecklistItem', () => {
    it('sets an item to checked', () => {
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
      const progress = useModuleStore.getState().checklistProgress;
      expect(progress['arpg-combat']?.['hit-detection']).toBe(true);
    });

    it('sets an item to unchecked', () => {
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', false);
      const progress = useModuleStore.getState().checklistProgress;
      expect(progress['arpg-combat']?.['hit-detection']).toBe(false);
    });

    it('returns same state when value already matches', () => {
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
      const before = useModuleStore.getState();
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
      const after = useModuleStore.getState();
      expect(before.checklistProgress).toBe(after.checklistProgress);
    });

    it('does not affect other modules', () => {
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
      useModuleStore.getState().setChecklistItem('arpg-inventory', 'grid-layout', true);
      const progress = useModuleStore.getState().checklistProgress;
      expect(progress['arpg-combat']?.['hit-detection']).toBe(true);
      expect(progress['arpg-inventory']?.['grid-layout']).toBe(true);
    });
  });

  describe('toggleChecklistItem', () => {
    it('toggles unchecked to checked', () => {
      useModuleStore.getState().toggleChecklistItem('arpg-combat', 'hit-detection');
      expect(useModuleStore.getState().checklistProgress['arpg-combat']?.['hit-detection']).toBe(true);
    });

    it('toggles checked to unchecked', () => {
      useModuleStore.getState().setChecklistItem('arpg-combat', 'hit-detection', true);
      useModuleStore.getState().toggleChecklistItem('arpg-combat', 'hit-detection');
      expect(useModuleStore.getState().checklistProgress['arpg-combat']?.['hit-detection']).toBe(false);
    });

    it('double toggle returns to original state', () => {
      useModuleStore.getState().toggleChecklistItem('arpg-combat', 'hit-detection');
      useModuleStore.getState().toggleChecklistItem('arpg-combat', 'hit-detection');
      expect(useModuleStore.getState().checklistProgress['arpg-combat']?.['hit-detection']).toBe(false);
    });
  });

  describe('addHistoryEntry', () => {
    it('appends entry to module history', () => {
      const entry = { id: 't1', moduleId: 'arpg-combat' as const, prompt: 'Test', timestamp: Date.now(), status: 'completed' as const };
      useModuleStore.getState().addHistoryEntry(entry);
      const history = useModuleStore.getState().moduleHistory['arpg-combat'];
      expect(history).toHaveLength(1);
      expect(history![0].id).toBe('t1');
    });

    it('appends multiple entries in order', () => {
      const e1 = { id: 't1', moduleId: 'arpg-combat' as const, prompt: 'First', timestamp: 1, status: 'completed' as const };
      const e2 = { id: 't2', moduleId: 'arpg-combat' as const, prompt: 'Second', timestamp: 2, status: 'failed' as const };
      useModuleStore.getState().addHistoryEntry(e1);
      useModuleStore.getState().addHistoryEntry(e2);
      const history = useModuleStore.getState().moduleHistory['arpg-combat']!;
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('t1');
      expect(history[1].id).toBe('t2');
    });
  });
});
