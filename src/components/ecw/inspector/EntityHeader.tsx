'use client';

import { ChevronRight } from 'lucide-react';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

/**
 * Inspector header: categoryPath breadcrumb · entity name (h2) · lifecycle
 * badge. Used at the top of EntityInspector. (Re)generate button lives here in
 * Phase 4 once CLI rail integration lands.
 */
export function EntityHeader({ entity }: { entity: StoredCatalogEntity }) {
  return (
    <header className="flex flex-col gap-2 px-4 py-3 border-b border-border/40">
      <nav aria-label="entity breadcrumb" className="flex items-center gap-1 text-2xs font-mono uppercase tracking-wider text-text-muted">
        {entity.categoryPath.map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 opacity-60" />}
            <span>{seg}</span>
          </span>
        ))}
      </nav>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text truncate">{entity.name}</h2>
        <LifecycleBadge state={entity.lifecycle} />
      </div>
    </header>
  );
}
