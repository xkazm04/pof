'use client';

import type { LabReference } from '@/lib/catalog/canon/profiles';
import { useMemo } from 'react';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { resolveCatalogSteps } from './catalogManifest';
import { toLabEntity } from './entityPipeline';
import type { CatalogLink, LifecycleState } from '@/lib/catalog/types';
import { useActiveGame } from '@/stores/activeGameStore';
import { entityInGame, scopeCatalogIds, statusEntitiesForGame, type CatalogScope } from '@/lib/games/scope';
import type { GameDef } from '@/lib/games/types';

export interface LabCatalog {
  catalogId: string;
  label: string;
  description: string;
  total: number;
  /**
   * Set (to the active game's title) on an OFF-manifest catalog shown under "show all
   * pipelines" — rendered greyed, "not in <title>". Absent for every catalog in the game.
   */
  notInGame?: string;
}
/**
 * There is deliberately NO `verified` here. It used to be
 * `entities.filter((e) => e.lifecycle === 'verified').length` — and every catalog seed in the
 * product hardcodes `lifecycle: 'planned'`, `catalog_lifecycle` holds zero rows, and the only
 * writer of that field lives in the legacy shell. So the count was structurally incapable of
 * being anything but `0`, rendered directly above entity dots that DO read the server-derived
 * lifecycle: one render could show a green `verified` dot inside a catalog row saying `0/3`.
 * The tree now counts from that same derivation (`useDerivedLifecycle`), and shows `—` for a
 * catalog it has no derivation for rather than a zero that reads as "nothing landed here".
 */

export interface LabGroup {
  category: string;
  catalogs: LabCatalog[];
}

/**
 * Shared data for every identity-lab variant: the registered catalogs grouped by
 * spreadsheet category, with real entity counts from the catalog store. Same source
 * the production hub + Live State use, so the prototypes show real data.
 */
export function useLabCatalogData(): LabGroup[] {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const draftEntitiesByCatalog = useCatalogStore((s) => s.draftEntitiesByCatalog);
  const { gameId, game, scope } = useGameCatalogScope();

  return useMemo(() => {
    // The game's entities: for PoF exactly the seed map (today's count); for another game its
    // seeds + persisted rows of that game (it has no code seeds of its own).
    const counted = statusEntitiesForGame(gameId, entitiesByCatalog, draftEntitiesByCatalog);
    const visible = new Set(scope.visible);
    const byCat = new Map<string, LabCatalog[]>();
    for (const s of CATALOG_SECTIONS) {
      if (!visible.has(s.catalogId)) continue;
      const entities = Object.values(counted[s.catalogId] ?? {});
      const cat: LabCatalog = {
        catalogId: s.catalogId,
        label: s.label,
        description: s.description ?? '',
        total: entities.length,
        ...(scope.offManifest.has(s.catalogId) ? { notInGame: game.title } : {}),
      };
      const arr = byCat.get(s.category ?? 'Other') ?? [];
      arr.push(cat);
      byCat.set(s.category ?? 'Other', arr);
    }
    return [...byCat.entries()].map(([category, catalogs]) => ({ category, catalogs }));
  }, [entitiesByCatalog, draftEntitiesByCatalog, gameId, game, scope]);
}

/** Every catalog the lab can open, in section order — the list a game scopes. */
export const LAB_CATALOG_IDS: readonly string[] = CATALOG_SECTIONS.map((s) => s.catalogId);

/**
 * The active game's catalog scope over the lab's sections (`scopeCatalogIds`): in-manifest
 * catalogs, plus the off-manifest ones under "show all pipelines". PoF (`manifest: 'all'`)
 * scopes to every section, unchanged.
 */
export function useGameCatalogScope(): { gameId: GameDef['id']; game: GameDef; scope: CatalogScope } {
  const { gameId, game, showAllPipelines } = useActiveGame();
  const scope = useMemo(() => scopeCatalogIds(gameId, LAB_CATALOG_IDS, showAllPipelines), [gameId, showAllPipelines]);
  return { gameId, game, scope };
}

export interface LabEntity {
  id: string;
  name: string;
  lifecycle: LifecycleState;
  data: unknown;
  /** Recorded cross-catalog edges used to attach linked reference values to produce prompts. */
  links?: CatalogLink[];
  /**
   * Canon profile its prompts are written for (`canonProfileOf`). Set by EVERY constructor —
   * a LabEntity is where provenance used to be dropped, so an ingested entity's prompts fell
   * back to PoF's world.
   */
  canonProfile?: string;
  /** Where an INGESTED entity's values came from — cited in its produce prompt (`referenceValuesBlock`). */
  reference?: LabReference;
}

export interface LabDetail {
  catalog: LabCatalog;
  entities: LabEntity[];
  steps: string[];
}

/** Per-catalog detail data for a variant's second screen: entities (the "spell
 *  selection") + the fine pipeline step list. `null` when no catalog is selected.
 *  Draft entities (one-shot staged) are merged alongside seeded entities; both are scoped
 *  to the ACTIVE game (an entity's game is derived from its canon profile). */
export function useLabDetail(catalogId: string | null): LabDetail | null {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const draftEntitiesByCatalog = useCatalogStore((s) => s.draftEntitiesByCatalog);
  const { gameId } = useActiveGame();

  return useMemo(() => {
    if (!catalogId) return null;
    const section = CATALOG_SECTIONS.find((s) => s.catalogId === catalogId);
    if (!section) return null;
    const seeded = Object.values(entitiesByCatalog[catalogId] ?? {});
    const drafts = Object.values(draftEntitiesByCatalog[catalogId] ?? {});
    // Only the active game's entities — seeded AND draft/persisted, by derived game.
    const all = [...seeded, ...drafts].filter((e) => entityInGame(e, gameId));
    return {
      catalog: {
        catalogId, label: section.label, description: section.description ?? '',
        total: all.length,
      },
      entities: all.map(toLabEntity),
      steps: resolveCatalogSteps(catalogId),
    };
  }, [catalogId, entitiesByCatalog, draftEntitiesByCatalog, gameId]);
}
