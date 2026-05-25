'use client';

import { EntityLifecyclePanel } from './EntityLifecyclePanel';
import { EntityCrossLinksPanel } from './EntityCrossLinksPanel';
import { EntitySpecPanel } from './EntitySpecPanel';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Overview surface (ECW sub-project B) — the inspector's default pipeline-switcher
 * view. Wraps the entity's metadata (tags + a headline data summary), assets +
 * lifecycle, cross-links, and the raw spec (collapsed). Composition of existing
 * panels; the always-visible Lifecycle/CrossLinks panels were moved in here.
 */
export function OverviewWorkspace({ entity }: Props) {
  const fields = summarizeEntityData(entity.data);

  return (
    <div>
      {entity.tags.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {entity.tags.map((t) => (
            <span key={t} className="text-2xs px-2 py-0.5 rounded-full bg-surface text-text-muted">
              {t}
            </span>
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <dl className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {fields.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-2 text-xs">
              <dt className="text-text-muted truncate">{f.label}</dt>
              <dd className="text-text font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <EntityLifecyclePanel entity={entity} />
      <EntityCrossLinksPanel entity={entity} />
      <EntitySpecPanel data={entity.data} />
    </div>
  );
}
