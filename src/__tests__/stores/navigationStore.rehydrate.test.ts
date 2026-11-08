/**
 * A persisted address is an untrusted read: an id the registry no longer declares
 * (renamed module, hand-edited blob) must not reach the shell.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from '@/stores/navigationStore';

async function rehydrate(state: Record<string, unknown>) {
  localStorage.setItem('pof-navigation', JSON.stringify({ state, version: 0 }));
  await useNavigationStore.persist.rehydrate();
  return useNavigationStore.getState();
}

beforeEach(() => {
  localStorage.removeItem('pof-navigation');
  useNavigationStore.setState({ activeCategory: null, activeSubModule: null, sidebarMode: 'full', moduleTabs: {} });
});

describe('navigationStore rehydration', () => {
  it('drops an unregistered category and sub-module', async () => {
    const s = await rehydrate({ activeCategory: 'ghost', activeSubModule: 'ghost-module' });
    expect(s.activeCategory).toBeNull();
    expect(s.activeSubModule).toBeNull();
  });

  it('keeps a registered address, including the plan pseudo-module', async () => {
    const s = await rehydrate({ activeCategory: 'core-engine', activeSubModule: 'core-engine-plan' });
    expect(s.activeCategory).toBe('core-engine');
    expect(s.activeSubModule).toBe('core-engine-plan');
  });

  it('keeps a special category', async () => {
    const s = await rehydrate({ activeCategory: 'evaluator', activeSubModule: null });
    expect(s.activeCategory).toBe('evaluator');
  });

  it('keeps the rest of the persisted blob and the actions', async () => {
    const s = await rehydrate({ activeCategory: 'content', activeSubModule: null, l1Expanded: true, moduleTabs: { audio: 'mix' } });
    expect(s.l1Expanded).toBe(true);
    expect(s.moduleTabs).toEqual({ audio: 'mix' });
    expect(typeof s.navigateToModule).toBe('function');
  });
});
