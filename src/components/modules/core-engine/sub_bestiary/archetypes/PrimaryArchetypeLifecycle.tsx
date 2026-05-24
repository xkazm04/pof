'use client';

import { useMemo } from 'react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { BestiaryEntry } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';
import type { ArchetypeConfig } from '../_shared/data';

interface PrimaryArchetypeLifecycleProps {
  expandedArchetype: string | null;
  filteredArchetypes: ArchetypeConfig[];
}

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
  const gen = useGeneration(primaryEntry!);
  const nextStep: GenerationStep =
    primaryEntry?.lifecycle === 'generated' ? 'wire'
      : primaryEntry?.lifecycle === 'wired' ? 'verify'
        : 'author-python';

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
        onRegenerate={() => gen.generate(nextStep)}
      />
    </div>
  );
}
