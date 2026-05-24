'use client';

import { useMemo } from 'react';
import { useEcwStore } from '@/stores/ecwStore';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { CatalogEntityBase } from '@/lib/catalog/types';

interface Props {
  catalogId: string;
  entities: CatalogEntityBase[];
}

/**
 * Left-pane tree for the CatalogDetailView. Groups entities by `categoryPath[0]`
 * (depth-1 grouping for Phase 3; deeper hierarchies + per-catalog tree
 * definitions land in Phase 7 with module migration). Click selects the entity
 * via `ecwStore.selectEntity`. Selected entity gets `aria-current=true` and a
 * visual highlight.
 */
export function EntityTree({ catalogId, entities }: Props) {
  const activeEntityId = useEcwStore((s) => s.activeEntityId);
  const selectEntity = useEcwStore((s) => s.selectEntity);

  // Group by first categoryPath segment. Entities without a path go to "Uncategorized".
  const groups = useMemo(() => {
    const out: Record<string, CatalogEntityBase[]> = {};
    for (const e of entities) {
      const head = e.categoryPath[0] ?? 'Uncategorized';
      (out[head] ??= []).push(e);
    }
    return Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
  }, [entities]);

  if (entities.length === 0) {
    return <p className="text-xs text-text-muted/70 italic px-3 py-4">No entities in this catalog.</p>;
  }

  return (
    <nav className="flex-1 overflow-auto px-2 py-2 space-y-3" aria-label="Entity tree">
      {groups.map(([groupName, groupEntities]) => (
        <div key={groupName}>
          <div className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted px-2 py-1">
            {groupName} <span className="text-text-muted/60">({groupEntities.length})</span>
          </div>
          <ul className="space-y-0.5">
            {groupEntities.map((entity) => {
              const isActive = activeEntityId === entity.id;
              return (
                <li key={entity.id}>
                  <button
                    onClick={() => selectEntity(catalogId, entity.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`focus-ring w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left ${
                      isActive ? 'bg-surface text-text' : 'text-text-muted hover:text-text hover:bg-surface/40'
                    }`}
                  >
                    <span className="flex-1 truncate">{entity.name}</span>
                    <LifecycleBadge state={entity.lifecycle} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
