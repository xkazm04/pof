import { describe, it, expect, beforeEach } from 'vitest';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';

describe('oneShotLabStore', () => {
  beforeEach(() => {
    useOneShotLabStore.setState({ pendingNavigation: null, panelOpen: false });
  });

  it('starts empty', () => {
    expect(useOneShotLabStore.getState().pendingNavigation).toBeNull();
    expect(useOneShotLabStore.getState().panelOpen).toBe(false);
  });

  it('setPendingNavigation sets + clears', () => {
    const { setPendingNavigation } = useOneShotLabStore.getState();
    setPendingNavigation({ catalogId: 'items', entityId: 'draft-items-1' });
    expect(useOneShotLabStore.getState().pendingNavigation).toEqual({ catalogId: 'items', entityId: 'draft-items-1' });
    setPendingNavigation(null);
    expect(useOneShotLabStore.getState().pendingNavigation).toBeNull();
  });

  it('setPanelOpen toggles', () => {
    const { setPanelOpen } = useOneShotLabStore.getState();
    setPanelOpen(true);
    expect(useOneShotLabStore.getState().panelOpen).toBe(true);
    setPanelOpen(false);
    expect(useOneShotLabStore.getState().panelOpen).toBe(false);
  });
});
