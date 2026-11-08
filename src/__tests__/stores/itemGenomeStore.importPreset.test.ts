import { describe, it, expect, beforeEach } from 'vitest';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';
import { sanitizeItemGenome } from '@/lib/item-dna/defaults';

const STORAGE_KEY = 'pof-item-genomes';

/**
 * An imported build code is user data, never a preset: a code carrying
 * isPreset:true must not become a sticky genome the store refuses to delete.
 * The persist merge still keeps the flag for real presets.
 */
describe('imported genome preset flag', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('an imported isPreset:true genome is deletable', async () => {
    await useItemGenomeStore.persist.rehydrate();
    const res = sanitizeItemGenome({ name: 'Crafted Code', isPreset: true });
    if ('error' in res) throw new Error(res.error);
    useItemGenomeStore.getState().importGenome(res.genome);
    const id = useItemGenomeStore.getState().genomes.find((g) => g.name === 'Crafted Code')!.id;

    useItemGenomeStore.getState().deleteGenome(id);

    expect(useItemGenomeStore.getState().genomes.some((g) => g.id === id)).toBe(false);
  });

  it('the persist merge keeps the flag on real presets', async () => {
    await useItemGenomeStore.persist.rehydrate();
    const presets = useItemGenomeStore.getState().genomes.filter((g) => g.isPreset);
    expect(presets.length).toBeGreaterThan(0);
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { genomes: presets, selectedId: presets[0].id }, version: 0 }),
    );
    await useItemGenomeStore.persist.rehydrate();
    const after = useItemGenomeStore.getState().genomes;
    expect(after.filter((g) => g.isPreset).length).toBe(presets.length);
  });
});
