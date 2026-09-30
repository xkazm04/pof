'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  CatalogEntityBase, AbilityEntry, ItemEntry, LifecycleRecord, StoredCatalogEntity,
} from '@/lib/catalog/types';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { mergePersistedDrafts, type PersistedRow } from '@/lib/catalog/persistedHydration';
import {
  planSeedMerge, persistableSeedState, resolveSeedFindings, type SeedFinding, type SeedRef,
} from '@/lib/catalog/seedSync';

/** The shipped code seeds — what every persisted copy is classified against (`seedSync.ts`). */
const SHIPPED = seedAllCatalogs();
const NO_DRIFT: SeedFinding[] = [];

/**
 * A one-shot draft in the browser store. `browserOnly` is set when the server-side persist
 * (`POST /api/catalog-entities`) did NOT succeed: the entity then exists here and nowhere
 * else, so `seededEntities` cannot resolve it and none of its gates can run. That is
 * surfaced in the catalog tree rather than swallowed — a silent local fallback is exactly
 * the "absence reads as exemption" defect the durable-entities work removes.
 */
export type DraftCatalogEntity = StoredCatalogEntity & {
  browserOnly?: boolean;
  persistError?: string;
};

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
  /**
   * Draft entities staged for a one-shot produce step, keyed by catalogId then entityId.
   *
   * This map is a CACHE of the `catalog_entities` rows (`/api/catalog-entities`), not the
   * record. It used to be the only place a user-created entity existed — while its ~11
   * pipeline artifacts went to SQLite — so the server could never resolve the entity again
   * and every gate silently exempted it.
   */
  draftEntitiesByCatalog: Record<string, Record<string, DraftCatalogEntity>>;
  addDraft: (catalogId: string, entity: DraftCatalogEntity) => void;
  /** Mark a draft browser-only — the server refused it or never received it. Never silent. */
  markDraftBrowserOnly: (catalogId: string, entityId: string, reason: string) => void;
  removeDraft: (catalogId: string, entityId: string) => void;
  /**
   * Fill the draft cache from the server's `catalog_entities` rows (see
   * `mergePersistedDrafts`). Without it a persisted entity — another session's one-shot, an
   * ingest — resolved for every server gate and was invisible in the lab.
   */
  hydratePersisted: (rows: PersistedRow[]) => { added: number; shadowed: string[] };
  /** `catalog/id` → content hash of the code seed each persisted copy was written against. */
  seedHashes: Record<string, string>;
  /** Persisted copies that differ from the shipped seed and need a decision (never persisted). */
  seedDrift: SeedFinding[];
  /** The shipped seed wins (overlays kept); a retired orphan is removed. */
  adoptShippedSeeds: (refs: SeedRef[]) => void;
  /** The browser copy stays; the current seed hash is recorded so it stops asking. */
  keepMine: (refs: SeedRef[]) => void;
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

      markDraftBrowserOnly: (catalogId, entityId, reason) =>
        set((s) => {
          const cur = s.draftEntitiesByCatalog[catalogId]?.[entityId];
          // Zustand v5: return the SAME state on a no-op so subscribers do not re-render.
          if (!cur || (cur.browserOnly === true && cur.persistError === reason)) return s;
          return {
            draftEntitiesByCatalog: {
              ...s.draftEntitiesByCatalog,
              [catalogId]: {
                ...(s.draftEntitiesByCatalog[catalogId] ?? {}),
                [entityId]: { ...cur, browserOnly: true, persistError: reason },
              },
            },
          };
        }),

      hydratePersisted: (rows) => {
        let result = { added: 0, shadowed: [] as string[] };
        set((s) => {
          const merged = mergePersistedDrafts(s.draftEntitiesByCatalog, s.entitiesByCatalog, rows);
          result = { added: merged.added, shadowed: merged.shadowed };
          return { draftEntitiesByCatalog: merged.drafts };
        });
        return result;
      },

      removeDraft: (catalogId, entityId) =>
        set((s) => {
          const next = { ...(s.draftEntitiesByCatalog[catalogId] ?? {}) };
          delete next[entityId];
          return { draftEntitiesByCatalog: { ...s.draftEntitiesByCatalog, [catalogId]: next } };
        }),

      seedHashes: {},
      seedDrift: NO_DRIFT,
      adoptShippedSeeds: (refs) => set((s) => resolveSeedFindings(s, refs, 'adopt', SHIPPED)),
      keepMine: (refs) => set((s) => resolveSeedFindings(s, refs, 'keep', SHIPPED)),
    }),
    {
      name: 'pof-catalog',
      storage: createJSONStorage(() => localStorage),
      // Version STAYS 0 (no bump, no migrate): a blob without `seedHashes` IS the legacy case
      // and classifies as `unrecorded` (kept, asks). zustand 5 discards a version-mismatched
      // blob that has no `migrate`, so a bump would make a revert silently drop local rows and
      // browser-only drafts that exist nowhere else.
      version: 0,
      // Persist only what the code cannot rebuild: entities that differ from their code seed
      // (overlays, edits, local rows) with their seed provenance, plus the drafts. Pristine seeds
      // used to be mirrored whole (503 entities) and then shadowed every later seed correction.
      partialize: (s) => ({
        ...persistableSeedState(s.entitiesByCatalog, SHIPPED, s.seedHashes),
        draftEntitiesByCatalog: s.draftEntitiesByCatalog,
      }),
      // Per ENTITY, never per catalog (a catalog spread hid new seeds in existing catalogs), and
      // by provenance, never "persisted wins": an untouched copy follows the code, an edit is
      // kept, and a copy that cannot be told apart asks (`seedDrift` → SeedDriftNotice).
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<CatalogState, 'entitiesByCatalog' | 'draftEntitiesByCatalog' | 'seedHashes'>> | undefined;
        const plan = planSeedMerge(SHIPPED, p?.entitiesByCatalog ?? {}, p?.seedHashes ?? {});
        return {
          ...current,
          entitiesByCatalog: plan.entities,
          seedHashes: plan.recorded,
          seedDrift: plan.findings.length ? plan.findings : NO_DRIFT,
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
