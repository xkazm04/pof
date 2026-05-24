'use client';

import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { EmptyInspector } from './EmptyInspector';
import { EntityHeader } from './EntityHeader';
import { EntitySpecPanel } from './EntitySpecPanel';
import { EntityLifecyclePanel } from './EntityLifecyclePanel';
import { EntityCrossLinksPanel } from './EntityCrossLinksPanel';
import { EntityFunctionalTestPanel } from './EntityFunctionalTestPanel';
import { EntityFacetsTabStrip } from './EntityFacetsTabStrip';

interface Props {
  entity: StoredCatalogEntity | null;
}

/**
 * The universal Entity Inspector primitive. Reads any `StoredCatalogEntity`
 * and renders five generic panels (Header · Spec · Lifecycle+UE · CrossLinks ·
 * Functional Test) plus a `Facets` strip slot for per-catalog custom facets
 * (Phase 7).
 *
 * Composition only — no store mutations of its own (CrossLinks mutates
 * `ecwStore.selectEntity`, that's it). Wired into the Catalog Hub in Phase 3;
 * (Re)generate wires to CLI Rail in Phase 4.
 */
export function EntityInspector({ entity }: Props) {
  if (!entity) return <EmptyInspector />;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <EntityHeader entity={entity} />
      <EntitySpecPanel data={entity.data} />
      <EntityLifecyclePanel entity={entity} />
      <EntityCrossLinksPanel entity={entity} />
      <EntityFunctionalTestPanel entity={entity} />
      <EntityFacetsTabStrip />
    </div>
  );
}
