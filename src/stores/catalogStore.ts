'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { CatalogEntityBase, AbilityEntry } from '@/lib/catalog/types';
import { seedSpellbookEntries } from '@/lib/catalog/seed-spellbook';

interface CatalogState {
  /** entitiesByCatalog[catalogId][entityId] */
  entitiesByCatalog: Record<string, Record<string, CatalogEntityBase>>;
  setEntities: (catalogId: string, entities: CatalogEntityBase[]) => void;
}

function indexById(entities: CatalogEntityBase[]): Record<string, CatalogEntityBase> {
  const map: Record<string, CatalogEntityBase> = {};
  for (const e of entities) map[e.id] = e;
  return map;
}

function buildInitial(): Record<string, Record<string, CatalogEntityBase>> {
  return { spellbook: indexById(seedSpellbookEntries()) };
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      entitiesByCatalog: buildInitial(),
      setEntities: (catalogId, entities) =>
        set((s) => ({
          entitiesByCatalog: { ...s.entitiesByCatalog, [catalogId]: indexById(entities) },
        })),
    }),
    {
      name: 'pof-catalog',
      storage: createJSONStorage(() => localStorage),
      // Re-seed any catalog the persisted blob is missing, so newly-added seed
      // entries appear after a code update without wiping persisted ones.
      merge: (persisted, current) => {
        const p = (persisted as Partial<CatalogState> | undefined)?.entitiesByCatalog ?? {};
        return {
          ...current,
          entitiesByCatalog: { ...current.entitiesByCatalog, ...p },
        };
      },
    },
  ),
);

/** All entities in a catalog (array). Uses useShallow to keep a stable snapshot. */
export function useCatalogEntities(catalogId: string): CatalogEntityBase[] {
  return useCatalogStore(
    useShallow((s) => Object.values(s.entitiesByCatalog[catalogId] ?? {})),
  );
}

/** A single entity by id. */
export function useCatalogEntity(
  catalogId: string,
  id: string,
): CatalogEntityBase | undefined {
  return useCatalogStore((s) => s.entitiesByCatalog[catalogId]?.[id]);
}

/** Typed convenience for the spellbook catalog. */
export function useSpellbookEntries(): AbilityEntry[] {
  return useCatalogStore(
    useShallow((s) => Object.values(s.entitiesByCatalog.spellbook ?? {}) as AbilityEntry[]),
  );
}
