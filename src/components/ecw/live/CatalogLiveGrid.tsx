'use client';

import { useMemo } from 'react';
import { CATALOG_SECTIONS, type CatalogSection } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { LifecycleState } from '@/lib/catalog/types';

const LIFECYCLE_COLOR: Record<LifecycleState, string> = {
  planned: STATUS_NEUTRAL, scaffolded: STATUS_NEUTRAL, generated: STATUS_NEUTRAL,
  wired: STATUS_NEUTRAL, verified: STATUS_SUCCESS, failed: STATUS_ERROR,
};

function groupByCategory(sections: CatalogSection[]): [string, CatalogSection[]][] {
  const map = new Map<string, CatalogSection[]>();
  for (const s of sections) {
    const cat = s.category ?? 'Other';
    const arr = map.get(cat) ?? [];
    arr.push(s);
    map.set(cat, arr);
  }
  return [...map.entries()];
}

/**
 * Live State catalog view: every catalog grouped by spreadsheet category, with
 * per-entity lifecycle/test status — what is actually progressing toward in-engine.
 * All 30 catalogs (incl. the Catalog Pipeline Expansion rows) appear automatically.
 */
export function CatalogLiveGrid() {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const groups = useMemo(() => groupByCategory(CATALOG_SECTIONS), []);

  return (
    <div className="space-y-6 max-w-5xl">
      {groups.map(([category, sections]) => (
        <section key={category}>
          <h2 className="text-sm font-semibold text-text mb-2">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sections.map((s) => {
              const entities = Object.values(entitiesByCatalog[s.catalogId] ?? {});
              const verified = entities.filter((e) => e.lifecycle === 'verified').length;
              return (
                <div key={s.catalogId} className="rounded-lg border border-border/40 bg-surface-deep p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text">{s.label}</span>
                    <span className="text-2xs text-text-muted">{verified}/{entities.length} verified</span>
                  </div>
                  {entities.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {entities.slice(0, 6).map((e) => (
                        <li key={e.id} className="flex items-center gap-2 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: LIFECYCLE_COLOR[e.lifecycle] }} />
                          <span className="text-text truncate">{e.name}</span>
                          <span className="text-text-muted ml-auto">{e.lastTestResult ?? e.lifecycle}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
