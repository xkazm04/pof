'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  CatalogEntityBase, AbilityEntry, ItemEntry, LifecycleState, TestResult, LifecycleRecord,
  StoredCatalogEntity,
} from '@/lib/catalog/types';
import { resolveTransition } from '@/lib/catalog/lifecycle';
import { seedAllCatalogs } from '@/lib/catalog/sections';

interface CatalogState {
  /** entitiesByCatalog[catalogId][entityId] */
  entitiesByCatalog: Record<string, Record<string, CatalogEntityBase>>;
  setEntities: (catalogId: string, entities: CatalogEntityBase[]) => void;
  /** Insert/replace a single entity in a catalog (used by the catalog "Add Item" flow). */
  addEntity: (catalogId: string, entity: CatalogEntityBase) => void;
  /** Advance an entity's lifecycle in-memory through the shared gate (optimistic + post-callback sync). */
  applyLifecycle: (input: {
    catalogId: string; entityId: string; nextLifecycle: LifecycleState;
    ueAssets?: string[]; testResult?: TestResult;
  }) => void;
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

      applyLifecycle: ({ catalogId, entityId, nextLifecycle, ueAssets, testResult }) =>
        set((s) => {
          const current = s.entitiesByCatalog[catalogId]?.[entityId];
          if (!current) return s;
          const resolved = resolveTransition(current.lifecycle, nextLifecycle, testResult);
          if (!resolved) return s;
          const mergedAssets = ueAssets
            ? Array.from(new Set([...(current.ueAssets ?? []), ...ueAssets]))
            : current.ueAssets;
          const updated: CatalogEntityBase = {
            ...current,
            lifecycle: resolved,
            ...(mergedAssets ? { ueAssets: mergedAssets } : {}),
            ...(testResult ? { lastTestResult: testResult } : {}),
            ...(resolved === 'verified' ? { lastVerifiedAt: new Date().toISOString() } : {}),
          };
          return {
            entitiesByCatalog: {
              ...s.entitiesByCatalog,
              [catalogId]: { ...s.entitiesByCatalog[catalogId], [entityId]: updated },
            },
          };
        }),

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
      // Re-seed any catalog the persisted blob is missing, so newly-added seed
      // entries appear after a code update without wiping persisted ones.
      merge: (persisted, current) => {
        const p = persisted as Partial<CatalogState> | undefined;
        return {
          ...current,
          entitiesByCatalog: { ...current.entitiesByCatalog, ...(p?.entitiesByCatalog ?? {}) },
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
