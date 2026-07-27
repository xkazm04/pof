'use client';

/**
 * Global entity type-ahead for the Item Focus tab: matches any catalog's entity by
 * name or id and refocuses the view onto the pick. The whole entity universe is already
 * client-side in the catalog store (seeded from seedAllCatalogs), so this is a pure
 * in-memory filter — no API.
 *
 * The combobox itself (ARIA wiring, ↓/↑/Home/End/Enter/Escape, capped-but-stated hit
 * list, honest empty states, live region) is the shared
 * {@link SearchCombobox} — the same primitive the lab-wide search uses, so the two
 * search surfaces cannot drift apart. This file supplies only the entity domain.
 */
import { useCallback, useMemo } from 'react';
import { useCatalogStore } from '@/stores/catalogStore';
import { SearchCombobox, type SearchHit } from '@/components/layout-lab/ui/SearchCombobox';

interface Hit {
  catalogId: string;
  entityId: string;
}

export function EntitySearch({ onFocus }: { onFocus: (catalogId: string, entityId: string) => void }) {
  // Select the stable store slice, then flatten into a search index in a memo. (Selecting
  // a freshly-built array here would defeat useSyncExternalStore's snapshot caching.)
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const all = useMemo(() => {
    const out: { hay: string; hit: SearchHit<Hit> }[] = [];
    for (const [catalogId, byId] of Object.entries(entitiesByCatalog)) {
      for (const e of Object.values(byId)) {
        out.push({
          hay: `${e.name} ${e.id}`.toLowerCase(),
          hit: {
            key: `${catalogId}:${e.id}`,
            label: e.name,
            // A row matched on id alone would otherwise look unrelated to the query.
            detail: e.id,
            meta: catalogId,
            payload: { catalogId, entityId: e.id },
          },
        });
      }
    }
    return out;
  }, [entitiesByCatalog]);

  const search = useCallback(
    (needle: string) => all.filter((r) => r.hay.includes(needle)).map((r) => r.hit),
    [all],
  );

  return (
    <div style={{ maxWidth: 520, marginBottom: 'var(--lab-s4)' }}>
      <SearchCombobox<Hit>
        search={search}
        onSelect={(h) => onFocus(h.payload.catalogId, h.payload.entityId)}
        idPrefix="status-entity-search"
        ariaLabel="Search entity to focus"
        placeholder="Search any entity — name or id…"
        noun="entity"
        hintKeys="↑↓ browse · ↵ focus · esc clear"
        emptyUniverse={all.length === 0}
      />
    </div>
  );
}
