'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  CatalogEntityBase, AbilityEntry, ItemEntry, LifecycleRecord, StoredCatalogEntity,
} from '@/lib/catalog/types';
import { seedAllCatalogs } from '@/lib/catalog/sections';

interface CatalogState {
  /** entitiesByCatalog[catalogId][entityId] */
  entitiesByCatalog: Record<string, Record<string, CatalogEntityBase>>;
  setEntities: (catalogId: string, entities: CatalogEntityBase[]) => void;
  /** Insert/replace a single entity in a catalog (used by the catalog "Add Item" flow). */
  addEntity: (catalogId: string, entity: CatalogEntityBase) => void;
  /**
   * NOTE — there is deliberately no `applyLifecycle` here.
   *
   * It advanced an entity's lifecycle IN THE CLIENT STORE through `resolveTransition`, and it
   * had zero production callers: nothing in the app ever called it, so its only effect was to
   * keep a tested-but-uncalled lifecycle mutator alive next to a display path that must never
   * move a verdict. Lifecycle is DERIVED server-side from persisted artifacts
   * (`GET /api/catalog/lifecycle` → `deriveEntityLifecycle`, where `verified` is reachable only
   * through a drained L3/L4 gate) and read for display via `useDerivedLifecycle`. Advancing it
   * belongs to the server (`POST /api/catalog`), which owns the same gate; a client-side mutator
   * could only ever produce a second, drift-prone copy of it.
   */
  /** Merge server-side lifecycle records over seeded entities (called on load). */
  loadLifecycle: (records: LifecycleRecord[]) => void;
  /** Draft entities staged for a one-shot produce step, keyed by catalogId then entityId. */
  draftEntitiesByCatalog: Record<string, Record<string, StoredCatalogEntity>>;
  addDraft: (catalogId: string, entity: StoredCatalogEntity) => void;
  removeDraft: (catalogId: string, entityId: string) => void;
}

function indexById(entities: CatalogEntityBase[]): Record<string, CatalogEntityBase> {
  const map: Record<string, CatalogEntityBase> = {};
  for (const e of entities) map[e.id] = e;
  return map;
}

function buildInitial(): Record<string, Record<string, CatalogEntityBase>> {
  return seedAllCatalogs();
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      entitiesByCatalog: buildInitial(),
      setEntities: (catalogId, entities) =>
        set((s) => ({
          entitiesByCatalog: { ...s.entitiesByCatalog, [catalogId]: indexById(entities) },
        })),

      addEntity: (catalogId, entity) =>
        set((s) => ({
          entitiesByCatalog: {
            ...s.entitiesByCatalog,
            [catalogId]: { ...(s.entitiesByCatalog[catalogId] ?? {}), [entity.id]: entity },
          },
        })),

      loadLifecycle: (records) =>
        set((s) => {
          if (records.length === 0) return s;
          let changed = false;
          const next = { ...s.entitiesByCatalog };
          for (const r of records) {
            const ent = next[r.catalogId]?.[r.entityId];
            if (!ent) continue;
            changed = true;
            next[r.catalogId] = {
              ...next[r.catalogId],
              [r.entityId]: {
                ...ent,
                lifecycle: r.lifecycle,
                ueAssets: r.ueAssets,
                ...(r.lastTestResult ? { lastTestResult: r.lastTestResult } : {}),
                ...(r.lastVerifiedAt ? { lastVerifiedAt: r.lastVerifiedAt } : {}),
              },
            };
          }
          return changed ? { entitiesByCatalog: next } : s;
        }),

      draftEntitiesByCatalog: {},

      addDraft: (catalogId, entity) =>
        set((s) => ({
          draftEntitiesByCatalog: {
            ...s.draftEntitiesByCatalog,
            [catalogId]: { ...(s.draftEntitiesByCatalog[catalogId] ?? {}), [entity.id]: entity },
          },
        })),

      removeDraft: (catalogId, entityId) =>
        set((s) => {
          const next = { ...(s.draftEntitiesByCatalog[catalogId] ?? {}) };
          delete next[entityId];
          return { draftEntitiesByCatalog: { ...s.draftEntitiesByCatalog, [catalogId]: next } };
        }),
    }),
    {
      name: 'pof-catalog',
      storage: createJSONStorage(() => localStorage),
      // Re-seed any seed ENTITY the persisted blob is missing, so newly-added seed entries
      // appear after a code update without wiping persisted ones.
      //
      // The merge has to run one level deeper than it looks. A per-CATALOG spread
      // (`{...current.entitiesByCatalog, ...persisted.entitiesByCatalog}`) replaces each
      // seeded catalog wholesale with whatever the persisted blob holds for it, so a newly
      // seeded entity added to an EXISTING catalog never appeared for a returning user —
      // only an entirely new catalog id did. Merging per entity keeps the persisted row
      // authoritative where it exists (edits, lifecycle, ueAssets survive) while letting new
      // seed entities through.
      merge: (persisted, current) => {
        const p = persisted as Partial<CatalogState> | undefined;
        const persistedByCatalog = p?.entitiesByCatalog ?? {};
        const entitiesByCatalog: Record<string, Record<string, CatalogEntityBase>> = { ...current.entitiesByCatalog };
        for (const [catalogId, entities] of Object.entries(persistedByCatalog)) {
          entitiesByCatalog[catalogId] = { ...(entitiesByCatalog[catalogId] ?? {}), ...entities };
        }
        return {
          ...current,
          entitiesByCatalog,
          draftEntitiesByCatalog: { ...(p?.draftEntitiesByCatalog ?? {}) },
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

/** Typed convenience for the items catalog. */
export function useItemEntries(): ItemEntry[] {
  return useCatalogStore(
    useShallow((s) => Object.values(s.entitiesByCatalog.items ?? {}) as ItemEntry[]),
  );
}
