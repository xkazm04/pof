import { describe, it, expect, beforeEach } from 'vitest';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';
import { createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';
import { ACCENT_ORANGE } from '@/lib/chart-colors';
import type { ItemGenome } from '@/types/item-genome';

/**
 * Acceptance for scan-sweep --challenge card inventory-genome-economy/B (cases 2-8):
 * breeding is the Item DNA lab's one random operation, so it previews first and
 * writes nothing to the library until the designer keeps the roll.
 */

type PreviewApi = {
  breedPreview: ItemGenome | null;
  previewBreed: () => string | null;
  rerollBreed: () => string | null;
  keepBreed: () => string | null;
  discardBreed: () => void;
};

const store = () => useItemGenomeStore.getState() as ReturnType<typeof useItemGenomeStore.getState> & PreviewApi;

function byName(name: string): ItemGenome {
  const g = store().genomes.find((x) => x.name === name);
  if (!g) throw new Error(`preset ${name} missing`);
  return g;
}

function pickParents(a: string, b: string) {
  store().setBreedParentA(byName(a).id);
  store().setBreedParentB(byName(b).id);
}

describe('useItemGenomeStore — breed preview', () => {
  beforeEach(async () => {
    globalThis.localStorage.clear();
    await useItemGenomeStore.persist.rehydrate();
    store().resetToPresets();
  });

  it('case 2: previewBreed stages a child with lineage and touches neither the library nor the selection', () => {
    pickParents('Warrior Blade', 'Mage Staff');
    const before = store().genomes.length;
    const selectedBefore = store().selectedId;
    const id = store().previewBreed();
    const preview = store().breedPreview;
    expect(preview).not.toBeNull();
    expect(preview!.id).toBe(id);
    expect(preview!.parents!.map((p) => p.id)).toEqual([byName('Warrior Blade').id, byName('Mage Staff').id]);
    expect(store().genomes).toHaveLength(before);
    expect(store().selectedId).toBe(selectedBefore);
  });

  it('case 3: rerollBreed replaces the preview with a fresh roll and still writes nothing', () => {
    pickParents('Warrior Blade', 'Mage Staff');
    const before = store().genomes.length;
    store().previewBreed();
    const first = store().breedPreview!;
    store().rerollBreed();
    const second = store().breedPreview!;
    expect(second).not.toBe(first);
    expect(second.id).not.toBe(first.id);
    expect(store().genomes).toHaveLength(before);
  });

  it('case 4: keepBreed appends exactly the previewed genome, selects it and closes the preview', () => {
    pickParents('Warrior Blade', 'Mage Staff');
    const before = store().genomes.length;
    const previewId = store().previewBreed();
    const keptId = store().keepBreed();
    const { genomes, selectedId, breedPreview } = store();
    expect(genomes).toHaveLength(before + 1);
    expect(genomes[genomes.length - 1].id).toBe(previewId);
    expect(keptId).toBe(previewId);
    expect(selectedId).toBe(previewId);
    expect(breedPreview).toBeNull();
  });

  it('case 5: discardBreed drops the preview and leaves the library exactly as it was', () => {
    pickParents('Warrior Blade', 'Mage Staff');
    const snapshot = structuredClone(store().genomes);
    store().previewBreed();
    store().discardBreed();
    expect(store().breedPreview).toBeNull();
    expect(store().genomes).toEqual(snapshot);
  });

  it('case 6: Guardian Plate x Rogue Leather (both Armor) previews an Armor child', () => {
    pickParents('Guardian Plate', 'Rogue Leather');
    store().previewBreed();
    expect(store().breedPreview!.itemType).toBe('Armor');
  });

  it('case 7: deleting a (non-preset) parent named by an open preview closes the preview', () => {
    const custom = createGenome('Custom Parent', ACCENT_ORANGE, { itemType: 'Accessory' });
    store().addGenome(custom);
    store().setBreedParentA(custom.id);
    store().setBreedParentB(byName('Warrior Blade').id);
    store().previewBreed();
    expect(store().breedPreview).not.toBeNull();
    store().deleteGenome(custom.id);
    expect(store().genomes.find((g) => g.id === custom.id)).toBeUndefined();
    expect(store().breedPreview).toBeNull();
  });

  it('case 8 [guard]: breedPreview is never persisted, and breedSelected still appends a child with lineage', () => {
    pickParents('Warrior Blade', 'Mage Staff');
    const partialize = useItemGenomeStore.persist.getOptions().partialize!;
    const persisted = partialize(useItemGenomeStore.getState()) as Record<string, unknown>;
    expect(Object.keys(persisted)).not.toContain('breedPreview');

    const before = store().genomes.length;
    const childId = store().breedSelected();
    const child = store().genomes.find((g) => g.id === childId);
    expect(store().genomes).toHaveLength(before + 1);
    expect(child!.parents).toHaveLength(2);
  });
});
