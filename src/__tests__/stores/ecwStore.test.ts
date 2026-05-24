import { describe, it, expect, beforeEach } from 'vitest';
import { useEcwStore } from '@/stores/ecwStore';

describe('ecwStore', () => {
  beforeEach(() => {
    useEcwStore.setState({
      activeL1Tab: 'catalogs',
      activeCatalogId: null,
      activeEntityId: null,
      cliRailMode: 'auto',
      isPaletteOpen: false,
    });
  });

  it('defaults to catalogs tab', () => {
    expect(useEcwStore.getState().activeL1Tab).toBe('catalogs');
  });

  it('setActiveL1Tab changes the tab', () => {
    useEcwStore.getState().setActiveL1Tab('mission-control');
    expect(useEcwStore.getState().activeL1Tab).toBe('mission-control');
  });

  it('selectEntity sets catalog + entity together', () => {
    useEcwStore.getState().selectEntity('spellbook', 'ga-fireball');
    expect(useEcwStore.getState().activeCatalogId).toBe('spellbook');
    expect(useEcwStore.getState().activeEntityId).toBe('ga-fireball');
  });

  it('selectEntity(null,null) clears selection', () => {
    useEcwStore.getState().selectEntity('spellbook', 'ga-fireball');
    useEcwStore.getState().selectEntity(null, null);
    expect(useEcwStore.getState().activeCatalogId).toBeNull();
    expect(useEcwStore.getState().activeEntityId).toBeNull();
  });

  it('toggleCliRail cycles auto → wide → collapsed → auto', () => {
    expect(useEcwStore.getState().cliRailMode).toBe('auto');
    useEcwStore.getState().toggleCliRail();
    expect(useEcwStore.getState().cliRailMode).toBe('wide');
    useEcwStore.getState().toggleCliRail();
    expect(useEcwStore.getState().cliRailMode).toBe('collapsed');
    useEcwStore.getState().toggleCliRail();
    expect(useEcwStore.getState().cliRailMode).toBe('auto');
  });

  it('palette open/close', () => {
    useEcwStore.getState().setPaletteOpen(true);
    expect(useEcwStore.getState().isPaletteOpen).toBe(true);
    useEcwStore.getState().setPaletteOpen(false);
    expect(useEcwStore.getState().isPaletteOpen).toBe(false);
  });
});
