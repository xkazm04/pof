'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CharacterGenome } from '@/types/character-genome';
import type { GenomeCheckpoint } from '@/types/genome-checkpoint';
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
  /** Named, restorable snapshots — keyed by `genomeId`. Flat for simple persist. */
  checkpoints: GenomeCheckpoint[];

  /* ── Actions ── */
  setActiveId: (id: string) => void;
  toggleCompareId: (id: string) => void;
  clearCompareIds: () => void;

  addGenome: (genome: CharacterGenome) => void;
  deleteGenome: (id: string) => void;
  updateGenome: (id: string, updater: (g: CharacterGenome) => CharacterGenome) => void;
  importGenome: (genome: CharacterGenome) => void;
  resetToPresets: () => void;

  /** Checkpoint actions */
  createCheckpoint: (genomeId: string, name: string, note?: string) => GenomeCheckpoint | null;
  renameCheckpoint: (checkpointId: string, name: string) => void;
  deleteCheckpoint: (checkpointId: string) => void;
  restoreCheckpoint: (checkpointId: string) => void;
}

/* ── Initial state factory ────────────────────────────────────────────────── */

function createInitialGenomes(): CharacterGenome[] {
  const taken = new Set<string>();
  return PRESET_GENOMES.map((g) => {
    let id = createId();
    while (taken.has(id)) id = createId();
    taken.add(id);
    return { ...g, id };
  });
}

/**
 * Return `genome` with an id guaranteed not to collide with `existing`.
 * createId() is an 8-char Math.random string with no built-in uniqueness check,
 * so without this guard a collision (or an empty id) would make
 * updateGenome/deleteGenome silently mutate or remove the WRONG genome.
 */
function withUniqueId(genome: CharacterGenome, existing: Iterable<string>): CharacterGenome {
  const taken = new Set(existing);
  if (genome.id && !taken.has(genome.id)) return genome;
  let id = createId();
  while (!id || taken.has(id)) id = createId();
  return { ...genome, id };
}

/* ── Store ─────────────────────────────────────────────────────────────────── */

export const useGenomeStore = create<GenomeState>()(
  persist(
    (set, get) => ({
      genomes: createInitialGenomes(),
      activeId: '',
      compareIds: [],
      checkpoints: [],

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
        set((state) => {
          const unique = withUniqueId(genome, state.genomes.map((g) => g.id));
          return {
            genomes: [...state.genomes, unique],
            activeId: unique.id,
          };
        });
      },

      deleteGenome: (id) => {
        const { genomes, activeId, compareIds, checkpoints } = get();
        if (genomes.length <= 1) return;
        const remaining = genomes.filter((g) => g.id !== id);
        const nextActiveId = activeId === id
          ? remaining[0].id
          : activeId;
        set({
          genomes: remaining,
          activeId: nextActiveId,
          compareIds: compareIds.filter((x) => x !== id),
          // Cascade: drop the deleted genome's checkpoints to avoid orphans.
          checkpoints: checkpoints.filter((c) => c.genomeId !== id),
        });
      },

      updateGenome: (id, updater) => {
        set((state) => ({
          genomes: state.genomes.map((g) => (g.id === id ? updater(g) : g)),
        }));
      },

      importGenome: (genome) => {
        set((state) => {
          const unique = withUniqueId(genome, state.genomes.map((g) => g.id));
          return {
            genomes: [...state.genomes, unique],
            activeId: unique.id,
          };
        });
      },

      resetToPresets: () => {
        const fresh = createInitialGenomes();
        set({
          genomes: fresh,
          activeId: fresh[0].id,
          compareIds: [],
          checkpoints: [],
        });
      },

      createCheckpoint: (genomeId, name, note) => {
        const trimmedName = name.trim();
        if (!trimmedName) return null;
        const target = get().genomes.find((g) => g.id === genomeId);
        if (!target) return null;
        const checkpoint: GenomeCheckpoint = {
          id: createId(),
          genomeId,
          name: trimmedName,
          createdAt: new Date().toISOString(),
          // Deep-clone via JSON so future edits don't mutate the snapshot.
          snapshot: JSON.parse(JSON.stringify(target)) as CharacterGenome,
          ...(note?.trim() ? { note: note.trim() } : {}),
        };
        set((state) => ({ checkpoints: [...state.checkpoints, checkpoint] }));
        return checkpoint;
      },

      renameCheckpoint: (checkpointId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          checkpoints: state.checkpoints.map((c) =>
            c.id === checkpointId ? { ...c, name: trimmed } : c,
          ),
        }));
      },

      deleteCheckpoint: (checkpointId) => {
        set((state) => ({
          checkpoints: state.checkpoints.filter((c) => c.id !== checkpointId),
        }));
      },

      restoreCheckpoint: (checkpointId) => {
        const checkpoint = get().checkpoints.find((c) => c.id === checkpointId);
        if (!checkpoint) return;
        const restoredAt = new Date().toISOString();
        set((state) => ({
          genomes: state.genomes.map((g) =>
            g.id === checkpoint.genomeId
              // Restore every field from the snapshot but keep the live id (the
              // user is still editing the same genome, not creating a new one)
              // and bump updatedAt so downstream "changed since" UIs refresh.
              ? { ...checkpoint.snapshot, id: g.id, updatedAt: restoredAt }
              : g,
          ),
        }));
      },
    }),
    {
      name: 'pof-genomes',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        genomes: state.genomes,
        activeId: state.activeId,
        compareIds: state.compareIds,
        checkpoints: state.checkpoints,
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
            checkpoints: [],
          };
        }

        // Sanitize each genome on rehydration to handle schema evolution
        const sanitized: CharacterGenome[] = [];
        const seenIds = new Set<string>();
        for (const entry of raw.genomes) {
          const result = sanitizeGenome(entry);
          if ('genome' in result) {
            // Preserve the original id if it existed
            const originalId = (entry as unknown as Record<string, unknown>).id;
            if (typeof originalId === 'string' && originalId.length > 0) {
              result.genome.id = originalId;
            }
            // Enforce id uniqueness across the rehydrated set: a duplicate (or
            // empty) id would make updateGenome/deleteGenome target the wrong
            // genome. Regenerate until unique.
            let id = result.genome.id;
            while (!id || seenIds.has(id)) id = createId();
            result.genome.id = id;
            seenIds.add(id);
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
            checkpoints: [],
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

        // Sanitize checkpoints: drop any with malformed snapshots or orphan genomeIds.
        // Each snapshot is re-passed through sanitizeGenome so schema evolution
        // applies retroactively (older saves don't poison the restore button).
        const checkpoints: GenomeCheckpoint[] = [];
        if (Array.isArray(raw.checkpoints)) {
          for (const entry of raw.checkpoints as unknown[]) {
            if (!entry || typeof entry !== 'object') continue;
            const e = entry as Record<string, unknown>;
            if (typeof e.id !== 'string' || typeof e.genomeId !== 'string' || typeof e.name !== 'string'
                || typeof e.createdAt !== 'string' || !genomeIdSet.has(e.genomeId)) continue;
            const snapResult = sanitizeGenome(e.snapshot);
            if (!('genome' in snapResult)) continue;
            const originalSnapId = (e.snapshot as { id?: unknown })?.id;
            if (typeof originalSnapId === 'string' && originalSnapId.length > 0) {
              snapResult.genome.id = originalSnapId;
            }
            checkpoints.push({
              id: e.id,
              genomeId: e.genomeId,
              name: e.name,
              createdAt: e.createdAt,
              snapshot: snapResult.genome,
              ...(typeof e.note === 'string' && e.note.length > 0 ? { note: e.note } : {}),
            });
          }
        }

        return {
          ...current,
          genomes: sanitized,
          activeId,
          compareIds,
          checkpoints,
        };
      },
    },
  ),
);

/* ── Re-export helpers for convenience ────────────────────────────────────── */
export { createGenome, createId };
