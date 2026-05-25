'use client';

import { Monitor } from 'lucide-react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { GraphNode } from '@/types/unique-tab-improvements';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Screen Flow detail facet — Phase 7b. Renders the screen node's label and
 * group. The richer FlowGraph + screen node tree from the legacy
 * ScreenFlowMap lands as a Phase 10-F enhancement.
 */
export function ScreenFlowDetailFacet({ entity }: Props) {
  const data = entity.data as GraphNode | undefined;

  if (!data || typeof data !== 'object' || !('label' in data)) {
    return (
      <div className="px-4 py-3 text-xs text-text-muted/70 italic">
        No screen data for this entity.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Monitor className="w-4 h-4 text-text-muted" />
        <span className="font-semibold text-text">{data.label}</span>
        <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface text-text-muted">
          {data.group ?? 'uncategorized'}
        </span>
      </div>

      <p className="text-2xs text-text-muted/70 italic">
        Phase 10-F enhancement: FlowGraph + node tree + dialogue editor.
      </p>
    </div>
  );
}

registerFacet('screen-flow', { id: 'detail', label: 'Detail', Component: ScreenFlowDetailFacet });
