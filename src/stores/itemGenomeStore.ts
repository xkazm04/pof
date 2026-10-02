'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ItemGenome, TraitGene } from '@/types/item-genome';
import { sanitizeItemGenome, createItemId } from '@/lib/item-dna/defaults';
import { inheritGenomes, evolveGenome } from '@/lib/item-dna/rolling-engine';
import { PRESET_GENOMES, createGenome } from '@/components/modules/core-engine/sub_inventory/dna-genome/data';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface ItemGenomeState {
  /** All saved item genomes (presets + custom + bred + evolved) */
  genomes: ItemGenome[];
  /** Currently selected genome id */
  selectedId: string;
  /** Ids of genomes selected for comparison (max 4) */
  compareIds: string[];
  /** Breeding-lab parent selections */
  breedParentA: string | null;
  breedParentB: string | null;
  /** Transient (never persisted): the rolled offspring awaiting Keep / Re-roll / Discard */
  breedPreview: ItemGenome | null;

  /* ── Actions ── */
  setSelectedId: (id: string) => void;
  setBreedParentA: (id: string | null) => void;
  setBreedParentB: (id: string | null) => void;
  toggleCompareId: (id: string) => void;
  clearCompareIds: () => void;

  addGenome: (genome: ItemGenome) => void;
  deleteGenome: (id: string) => void;
  updateGenome: (id: string, updater: (g: ItemGenome) => ItemGenome) => void;
  importGenome: (genome: ItemGenome) => void;
  duplicateGenome: (id: string) => void;
  /** Roll an offspring of the selected parents into breedPreview; writes nothing */
  previewBreed: () => string | null;
  /** Replace the open preview with a fresh roll of the same parents */
  rerollBreed: () => string | null;
  /** Append the previewed offspring to the library and select it */
  keepBreed: () => string | null;
  /** Drop the previewed offspring */
  discardBreed: () => void;
  /** Preview + keep in one step (kept for callers that commit immediately) */
  breedSelected: () => string | null;
  evolveById: (id: string, xp: number) => boolean;
  resetToPresets: () => void;
}

/* ── Initial state factory ────────────────────────────────────────────────── */

function createInitialGenomes(): ItemGenome[] {
  return PRESET_GENOMES.map((g) => ({ ...g, id: createItemId(), isPreset: true }));
}

/**
 * Roll one offspring of two parents. The child inherits item type, rarity floor and
 * mutation profile from the dominant parent (the one inheritGenomes names), so two
 * Armor parents breed Armor rather than createGenome's 'Weapon' default.
 */
function rollOffspring(pA: ItemGenome, pB: ItemGenome): ItemGenome {
  const result = inheritGenomes(pA, pB);
  const dominant = result.dominantParent === 'A' ? pA : pB;
  const child = createGenome(`${pA.name} x ${pB.name}`, dominant.color, {
    traits: result.traits as TraitGene[],
    description: `Bred from ${pA.name} + ${pB.name}`,
    tags: ['bred'],
    itemType: dominant.itemType,
    minRarity: dominant.minRarity,
    mutation: { ...dominant.mutation },
  });
  return {
    ...child,
    parents: [
      { id: pA.id, name: pA.name, color: pA.color },
      { id: pB.id, name: pB.name, color: pB.color },
    ],
  };
}

/** A preview never outlives a parent it names. */
function previewSurvives(preview: ItemGenome | null, removedId: string): ItemGenome | null {
  return preview?.parents?.some((p) => p.id === removedId) ? null : preview;
}

/* ── Store ─────────────────────────────────────────────────────────────────── */

export const useItemGenomeStore = create<ItemGenomeState>()(
  persist(
    (set, get) => ({
      genomes: createInitialGenomes(),
      selectedId: '',
      compareIds: [],
      breedParentA: null,
      breedParentB: null,
      breedPreview: null,

      setSelectedId: (id) => set({ selectedId: id }),
      // Changing a parent invalidates a preview rolled from the old pair.
      setBreedParentA: (id) => set((s) => ({ breedParentA: id, breedPreview: id === s.breedParentA ? s.breedPreview : null })),
      setBreedParentB: (id) => set((s) => ({ breedParentB: id, breedPreview: id === s.breedParentB ? s.breedPreview : null })),

      toggleCompareId: (id) => {
        const prev = get().compareIds;
        if (prev.includes(id)) {
          set({ compareIds: prev.filter((x) => x !== id) });
        } else if (prev.length < 4) {
          set({ compareIds: [...prev, id] });
        }
      },

      clearCompareIds: () => set({ compareIds: [] }),

      addGenome: (genome) => {
        set((state) => ({
          genomes: [...state.genomes, genome],
          selectedId: genome.id,
        }));
      },

      deleteGenome: (id) => {
        const { genomes, selectedId, compareIds, breedParentA, breedParentB, breedPreview } = get();
        if (genomes.length <= 1) return;
        const target = genomes.find((g) => g.id === id);
        if (target?.isPreset) return; // presets are sticky
        const remaining = genomes.filter((g) => g.id !== id);
        const nextSelectedId = selectedId === id ? remaining[0].id : selectedId;
        set({
          genomes: remaining,
          selectedId: nextSelectedId,
          compareIds: compareIds.filter((x) => x !== id),
          breedParentA: breedParentA === id ? null : breedParentA,
          breedParentB: breedParentB === id ? null : breedParentB,
          breedPreview: previewSurvives(breedPreview, id),
        });
      },

      updateGenome: (id, updater) => {
        set((state) => ({
          genomes: state.genomes.map((g) => (g.id === id ? updater(g) : g)),
        }));
      },

      importGenome: (genome) => {
        set((state) => ({
          genomes: [...state.genomes, genome],
          selectedId: genome.id,
        }));
      },

      duplicateGenome: (id) => {
        const source = get().genomes.find((g) => g.id === id);
        if (!source) return;
        const copy: ItemGenome = {
          ...source,
          id: createItemId(),
          name: `${source.name} (copy)`,
          isPreset: false,
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          genomes: [...state.genomes, copy],
          selectedId: copy.id,
        }));
      },

      previewBreed: () => {
        const { genomes, breedParentA, breedParentB } = get();
        if (!breedParentA || !breedParentB || breedParentA === breedParentB) return null;
        const pA = genomes.find((g) => g.id === breedParentA);
        const pB = genomes.find((g) => g.id === breedParentB);
        if (!pA || !pB) return null;
        const child = rollOffspring(pA, pB);
        set({ breedPreview: child });
        return child.id;
      },

      rerollBreed: () => get().previewBreed(),

      keepBreed: () => {
        const preview = get().breedPreview;
        if (!preview) return null;
        set((state) => ({
          genomes: [...state.genomes, preview],
          selectedId: preview.id,
          breedPreview: null,
        }));
        return preview.id;
      },

      discardBreed: () => set({ breedPreview: null }),

      breedSelected: () => {
        if (!get().previewBreed()) return null;
        return get().keepBreed();
      },

      evolveById: (id, xp) => {
        const source = get().genomes.find((g) => g.id === id);
        if (!source) return false;
        const { evolved, tierChanged } = evolveGenome(source, xp);
        set((state) => ({
          genomes: state.genomes.map((g) => (g.id === id ? evolved : g)),
        }));
        return tierChanged;
      },

      resetToPresets: () => {
        const fresh = createInitialGenomes();
        set({
          genomes: fresh,
          selectedId: fresh[0].id,
          compareIds: [],
          breedParentA: null,
          breedParentB: null,
          breedPreview: null,
        });
      },
    }),
    {
      name: 'pof-item-genomes',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        genomes: state.genomes,
        selectedId: state.selectedId,
        compareIds: state.compareIds,
        breedParentA: state.breedParentA,
        breedParentB: state.breedParentB,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<ItemGenomeState> | undefined;
        if (!raw?.genomes || !Array.isArray(raw.genomes) || raw.genomes.length === 0) {
          const fresh = createInitialGenomes();
          return {
            ...current,
            genomes: fresh,
            selectedId: fresh[0].id,
            compareIds: [],
            breedParentA: null,
            breedParentB: null,
          };
        }

        // Sanitize each genome on rehydration to handle schema evolution
        const sanitized: ItemGenome[] = [];
        for (const entry of raw.genomes) {
          const result = sanitizeItemGenome(entry);
          if ('genome' in result) {
            const original = entry as unknown as Record<string, unknown>;
            const originalId = original.id;
            if (typeof originalId === 'string' && originalId.length > 0) {
              result.genome.id = originalId;
            }
            // Preserve preset flag explicitly (sanitizeItemGenome already passes it)
            if (original.isPreset === true) {
              result.genome.isPreset = true;
            }
            sanitized.push(result.genome);
          }
        }

        if (sanitized.length === 0) {
          const fresh = createInitialGenomes();
          return {
            ...current,
            genomes: fresh,
            selectedId: fresh[0].id,
            compareIds: [],
            breedParentA: null,
            breedParentB: null,
          };
        }

        const genomeIdSet = new Set(sanitized.map((g) => g.id));
        const selectedId = sanitized.some((g) => g.id === raw.selectedId)
          ? raw.selectedId!
          : sanitized[0].id;
        const compareIds = Array.isArray(raw.compareIds)
          ? raw.compareIds.filter((id) => genomeIdSet.has(id))
          : [];
        const breedParentA = typeof raw.breedParentA === 'string' && genomeIdSet.has(raw.breedParentA)
          ? raw.breedParentA
          : null;
        const breedParentB = typeof raw.breedParentB === 'string' && genomeIdSet.has(raw.breedParentB)
          ? raw.breedParentB
          : null;

        return {
          ...current,
          genomes: sanitized,
          selectedId,
          compareIds,
          breedParentA,
          breedParentB,
        };
      },
    },
  ),
);

/* ── Re-export helpers for convenience ────────────────────────────────────── */
export { createItemId };
