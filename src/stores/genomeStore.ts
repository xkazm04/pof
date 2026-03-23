'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CharacterGenome } from '@/types/character-genome';
import {
  PRESET_GENOMES,
  createGenome,
  createId,
  sanitizeGenome,
} from '@/lib/genome/defaults';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface GenomeState {
  /** All user genomes */
  genomes: CharacterGenome[];
  /** Currently active genome id */
  activeId: string;
  /** Ids of genomes selected for comparison (max 4) */
  compareIds: string[];

  /* ── Actions ── */
  setActiveId: (id: string) => void;
  toggleCompareId: (id: string) => void;
  clearCompareIds: () => void;

  addGenome: (genome: CharacterGenome) => void;
  deleteGenome: (id: string) => void;
  updateGenome: (id: string, updater: (g: CharacterGenome) => CharacterGenome) => void;
  importGenome: (genome: CharacterGenome) => void;
  resetToPresets: () => void;
}

/* ── Initial state factory ────────────────────────────────────────────────── */

function createInitialGenomes(): CharacterGenome[] {
  return PRESET_GENOMES.map((g) => ({ ...g, id: createId() }));
}

/* ── Store ─────────────────────────────────────────────────────────────────── */

export const useGenomeStore = create<GenomeState>()(
  persist(
    (set, get) => ({
      genomes: createInitialGenomes(),
      activeId: '',
      compareIds: [],

      setActiveId: (id) => set({ activeId: id }),

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
          activeId: genome.id,
        }));
      },

      deleteGenome: (id) => {
        const { genomes, activeId, compareIds } = get();
        if (genomes.length <= 1) return;
        const remaining = genomes.filter((g) => g.id !== id);
        const nextActiveId = activeId === id
          ? remaining[0].id
          : activeId;
        set({
          genomes: remaining,
          activeId: nextActiveId,
          compareIds: compareIds.filter((x) => x !== id),
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
          activeId: genome.id,
        }));
      },

      resetToPresets: () => {
        const fresh = createInitialGenomes();
        set({
          genomes: fresh,
          activeId: fresh[0].id,
          compareIds: [],
        });
      },
    }),
    {
      name: 'pof-genomes',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        genomes: state.genomes,
        activeId: state.activeId,
        compareIds: state.compareIds,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<GenomeState> | undefined;
        if (!raw?.genomes || !Array.isArray(raw.genomes) || raw.genomes.length === 0) {
          // Nothing persisted or corrupt — use fresh defaults
          const fresh = createInitialGenomes();
          return {
            ...current,
            genomes: fresh,
            activeId: fresh[0].id,
            compareIds: [],
          };
        }

        // Sanitize each genome on rehydration to handle schema evolution
        const sanitized: CharacterGenome[] = [];
        for (const entry of raw.genomes) {
          const result = sanitizeGenome(entry);
          if ('genome' in result) {
            // Preserve the original id if it existed
            const originalId = (entry as unknown as Record<string, unknown>).id;
            if (typeof originalId === 'string' && originalId.length > 0) {
              result.genome.id = originalId;
            }
            sanitized.push(result.genome);
          }
          // Skip irrecoverably invalid entries
        }

        if (sanitized.length === 0) {
          const fresh = createInitialGenomes();
          return {
            ...current,
            genomes: fresh,
            activeId: fresh[0].id,
            compareIds: [],
          };
        }

        // Validate activeId — fallback to first genome if stale
        const activeId = sanitized.some((g) => g.id === raw.activeId)
          ? raw.activeId!
          : sanitized[0].id;

        // Validate compareIds — drop any stale references
        const genomeIdSet = new Set(sanitized.map((g) => g.id));
        const compareIds = Array.isArray(raw.compareIds)
          ? raw.compareIds.filter((id) => genomeIdSet.has(id))
          : [];

        return {
          ...current,
          genomes: sanitized,
          activeId,
          compareIds,
        };
      },
    },
  ),
);

/* ── Re-export helpers for convenience ────────────────────────────────────── */
export { createGenome, createId };
