'use client';

import { useMemo } from 'react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { BestiaryEntry, StoredCatalogEntity } from '@/lib/catalog/types';
import type { ArchetypeConfig } from '../_shared/data';

interface PrimaryArchetypeLifecycleProps {
  expandedArchetype: string | null;
  filteredArchetypes: ArchetypeConfig[];
}

// useGeneration needs a concrete entity, but the bestiary catalog can be
// genuinely empty (before seeding/fetch resolves) — then `primaryEntry` is
// undefined. The (Re)generate affordance stays gated on a real `primaryEntry`
// via the early return below, so this placeholder is never actually
// dispatched (same pattern as CatalogGearTab's EMPTY_ITEM_ENTRY).
const EMPTY_BESTIARY_ENTRY: StoredCatalogEntity = {
  id: '',
  catalogId: 'bestiary',
  name: '',
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
};

/**
 * folder-09 R3 UI: lifecycle + (Re)generate for the primary archetype.
 * Resolves the primary entry (expanded archetype, else first filtered, else first entry),
 * and renders the catalog lifecycle cell with a regenerate hook.
 */
export function PrimaryArchetypeLifecycle({
  expandedArchetype, filteredArchetypes,
}: PrimaryArchetypeLifecycleProps) {
  const bestiaryEntries = useCatalogEntities('bestiary') as BestiaryEntry[];
  const entryByArchetypeId = useMemo(
    () => new Map(bestiaryEntries.map((e) => [e.data.id, e])),
    [bestiaryEntries],
  );
  const primaryArchetypeId = expandedArchetype ?? filteredArchetypes[0]?.id;
  const primaryEntry =
    (primaryArchetypeId != null ? entryByArchetypeId.get(primaryArchetypeId) : undefined)
    ?? bestiaryEntries[0];
  const gen = useGeneration(primaryEntry ?? EMPTY_BESTIARY_ENTRY);

  if (!primaryEntry) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
        {primaryEntry.data.label ?? primaryEntry.data.id}
      </span>
      <CatalogLifecycleCell
        lifecycle={primaryEntry.lifecycle}
        ueAssetCount={primaryEntry.ueAssets?.length ?? 0}
        busy={gen.isRunning}
        onRegenerate={gen.nextStep ? () => gen.generate() : undefined}
      />
    </div>
  );
}
