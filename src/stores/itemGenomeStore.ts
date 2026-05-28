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
  breedSelected: () => string | null;
  evolveById: (id: string, xp: number) => boolean;
  resetToPresets: () => void;
}

/* ── Initial state factory ────────────────────────────────────────────────── */

function createInitialGenomes(): ItemGenome[] {
  return PRESET_GENOMES.map((g) => ({ ...g, id: createItemId(), isPreset: true }));
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

      setSelectedId: (id) => set({ selectedId: id }),
      setBreedParentA: (id) => set({ breedParentA: id }),
      setBreedParentB: (id) => set({ breedParentB: id }),

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
        const { genomes, selectedId, compareIds, breedParentA, breedParentB } = get();
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

      breedSelected: () => {
        const { genomes, breedParentA, breedParentB } = get();
        if (!breedParentA || !breedParentB || breedParentA === breedParentB) return null;
        const pA = genomes.find((g) => g.id === breedParentA);
        const pB = genomes.find((g) => g.id === breedParentB);
        if (!pA || !pB) return null;
        const result = inheritGenomes(pA, pB);
        const child = createGenome(
          `${pA.name} x ${pB.name}`,
          result.dominantParent === 'A' ? pA.color : pB.color,
          {
            traits: result.traits as TraitGene[],
            description: `Bred from ${pA.name} + ${pB.name}`,
            tags: ['bred'],
          },
        );
        const childWithLineage: ItemGenome = {
          ...child,
          parents: [
            { id: pA.id, name: pA.name, color: pA.color },
            { id: pB.id, name: pB.name, color: pB.color },
          ],
        };
        set((state) => ({
          genomes: [...state.genomes, childWithLineage],
          selectedId: childWithLineage.id,
        }));
        return childWithLineage.id;
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
