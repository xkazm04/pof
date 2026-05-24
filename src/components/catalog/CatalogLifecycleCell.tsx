'use client';

import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { LifecycleState } from '@/lib/catalog/types';

export interface CatalogLifecycleCellProps {
  lifecycle: LifecycleState;
  ueAssetCount: number;
  busy?: boolean;
  /** When provided, renders a "(Re)generate" button next to the badge + count. */
  onRegenerate?: () => void;
}

/**
 * Reusable cell rendering a catalog entity's lifecycle badge + generated-asset
 * count, with an optional "(Re)generate" button. Sections drop it into their
 * existing UI to surface the catalog lifecycle columns without restructuring.
 */
export function CatalogLifecycleCell({
  lifecycle, ueAssetCount, busy, onRegenerate,
}: CatalogLifecycleCellProps) {
  return (
    <div className="flex items-center gap-2">
      <LifecycleBadge state={lifecycle} />
      <span className="text-2xs font-mono text-text-muted">{ueAssetCount} assets</span>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={busy}
          className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded border border-border/50 text-text-muted hover:text-text disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? 'Generating…' : '(Re)generate'}
        </button>
      )}
    </div>
  );
}
