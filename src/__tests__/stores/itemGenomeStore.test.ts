import { describe, it, expect, beforeEach } from 'vitest';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';
import { ACCENT_ORANGE, OVERLAY_WHITE } from '@/lib/chart-colors';
import type { ItemGenome } from '@/types/item-genome';

const STORAGE_KEY = 'pof-item-genomes';

/* ── Helpers ────────────────────────────────────────────────────────────── */

function writePersisted(payload: unknown) {
  // jsdom provides its own localStorage; write directly to it (the same one
  // createJSONStorage reads from) instead of the unmounted setup mock.
  globalThis.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: payload, version: 0 }),
  );
}

function rehydrate() {
  // Zustand persist supports manual rehydration; calling it re-runs `merge`
  return useItemGenomeStore.persist.rehydrate();
}

describe('useItemGenomeStore', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('seeds with preset genomes when storage is empty', async () => {
    await rehydrate();
    const { genomes } = useItemGenomeStore.getState();
    expect(genomes.length).toBeGreaterThan(0);
    expect(genomes.every((g) => g.isPreset === true)).toBe(true);
    expect(genomes.find((g) => g.name === 'Warrior Blade')).toBeDefined();
  });

  it('persists added custom genomes across rehydration', async () => {
    await rehydrate();
    const initialCount = useItemGenomeStore.getState().genomes.length;

    const custom: ItemGenome = {
      id: 'custom-1',
      name: 'My Sword',
      description: 'Custom test',
      author: 'tester',
      version: '1.0.0',
      color: ACCENT_ORANGE,
      updatedAt: new Date().toISOString(),
      traits: [
        { axis: 'offensive', weight: 0.7, affinityTags: [] },
        { axis: 'defensive', weight: 0.1, affinityTags: [] },
        { axis: 'utility', weight: 0.1, affinityTags: [] },
        { axis: 'economic', weight: 0.1, affinityTags: [] },
      ],
      mutation: { mutationRate: 0.1, maxMutations: 1, wildMutation: false },
      itemType: 'Weapon',
      minRarity: 'Common',
    };
    useItemGenomeStore.getState().addGenome(custom);
    expect(useItemGenomeStore.getState().genomes).toHaveLength(initialCount + 1);
    expect(useItemGenomeStore.getState().selectedId).toBe('custom-1');

    // Simulate page reload: rehydrate triggers the merge fn
    await rehydrate();
    const after = useItemGenomeStore.getState();
    expect(after.genomes.find((g) => g.id === 'custom-1')).toBeDefined();
    expect(after.selectedId).toBe('custom-1');
  });

  it('falls back to presets when persisted state is corrupt', async () => {
    writePersisted({ genomes: 'not-an-array', selectedId: 'x' });
    await rehydrate();
    const { genomes, selectedId } = useItemGenomeStore.getState();
    expect(genomes.length).toBeGreaterThan(0);
    expect(genomes.every((g) => g.isPreset === true)).toBe(true);
    expect(genomes.some((g) => g.id === selectedId)).toBe(true);
  });

  it('drops irrecoverably invalid genome entries during rehydration', async () => {
    writePersisted({
      genomes: [
        { /* missing name */ id: 'bad', traits: [], mutation: {} },
        {
          id: 'good',
          name: 'Recovered',
          itemType: 'Weapon',
          minRarity: 'Common',
          traits: [{ axis: 'offensive', weight: 0.4 }],
          mutation: { mutationRate: 0.05 },
        },
      ],
      selectedId: 'good',
    });
    await rehydrate();
    const { genomes, selectedId } = useItemGenomeStore.getState();
    expect(genomes).toHaveLength(1);
    expect(genomes[0].id).toBe('good');
    expect(genomes[0].name).toBe('Recovered');
    expect(selectedId).toBe('good');
    // sanitize-on-rehydrate normalizes the trait array to all four axes
    expect(genomes[0].traits).toHaveLength(4);
  });

  it('falls back selectedId/compareIds to safe values when stale', async () => {
    writePersisted({
      genomes: [
        {
          id: 'g1',
          name: 'One',
          itemType: 'Weapon',
          minRarity: 'Common',
          traits: [],
          mutation: {},
        },
      ],
      selectedId: 'does-not-exist',
      compareIds: ['g1', 'gone'],
    });
    await rehydrate();
    const { genomes, selectedId, compareIds } = useItemGenomeStore.getState();
    expect(selectedId).toBe(genomes[0].id);
    expect(compareIds).toEqual(['g1']);
  });

  it('refuses to delete a preset genome', async () => {
    await rehydrate();
    const preset = useItemGenomeStore.getState().genomes.find((g) => g.isPreset)!;
    useItemGenomeStore.getState().deleteGenome(preset.id);
    expect(
      useItemGenomeStore.getState().genomes.find((g) => g.id === preset.id),
    ).toBeDefined();
  });

  it('breeds two parents into an offspring with lineage refs', async () => {
    await rehydrate();
    const [pA, pB] = useItemGenomeStore.getState().genomes;
    useItemGenomeStore.getState().setBreedParentA(pA.id);
    useItemGenomeStore.getState().setBreedParentB(pB.id);
    const childId = useItemGenomeStore.getState().breedSelected();
    expect(childId).not.toBeNull();
    const child = useItemGenomeStore.getState().genomes.find((g) => g.id === childId);
    expect(child).toBeDefined();
    expect(child!.parents).toBeDefined();
    expect(child!.parents).toHaveLength(2);
    expect(child!.parents![0].id).toBe(pA.id);
    expect(child!.parents![1].id).toBe(pB.id);
    expect(child!.isPreset).toBeFalsy();
  });

  it('duplicates a preset into a mutable custom copy', async () => {
    await rehydrate();
    const preset = useItemGenomeStore.getState().genomes[0];
    const beforeCount = useItemGenomeStore.getState().genomes.length;
    useItemGenomeStore.getState().duplicateGenome(preset.id);
    const after = useItemGenomeStore.getState().genomes;
    expect(after).toHaveLength(beforeCount + 1);
    const copy = after[after.length - 1];
    expect(copy.name).toBe(`${preset.name} (copy)`);
    expect(copy.isPreset).toBeFalsy();
    expect(copy.id).not.toBe(preset.id);
  });

  it('resetToPresets wipes custom genomes and re-seeds defaults', async () => {
    await rehydrate();
    useItemGenomeStore.getState().addGenome({
      id: 'custom-x',
      name: 'X',
      description: '',
      author: 'u',
      version: '1.0.0',
      color: OVERLAY_WHITE,
      updatedAt: new Date().toISOString(),
      traits: [
        { axis: 'offensive', weight: 0.25, affinityTags: [] },
        { axis: 'defensive', weight: 0.25, affinityTags: [] },
        { axis: 'utility', weight: 0.25, affinityTags: [] },
        { axis: 'economic', weight: 0.25, affinityTags: [] },
      ],
      mutation: { mutationRate: 0.08, maxMutations: 1, wildMutation: false },
      itemType: 'Weapon',
      minRarity: 'Common',
    });
    expect(useItemGenomeStore.getState().genomes.some((g) => g.id === 'custom-x')).toBe(true);

    useItemGenomeStore.getState().resetToPresets();
    const { genomes } = useItemGenomeStore.getState();
    expect(genomes.every((g) => g.isPreset === true)).toBe(true);
    expect(genomes.some((g) => g.id === 'custom-x')).toBe(false);
  });
});
